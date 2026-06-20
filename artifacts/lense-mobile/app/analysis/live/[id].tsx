import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  StyleSheet,
  Platform,
} from "react-native";
import Svg, { Line, Circle, G, Text as SvgText, Polygon } from "react-native-svg";
import { Video, type AVPlaybackStatus, ResizeMode } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  analyses as analysesApi,
  type FrameTick,
  type CoachingMoment,
  type MovementSummary,
  type FlaggedMoment,
  type TickStats,
} from "@/lib/api";
import type { JointKey } from "@/utils/analysisUtils";
import { useColors } from "@/hooks/useColors";
import { SPACING, RADIUS } from "@/constants/spacing";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONNECTIONS: [number, number][] = [
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 23], [12, 24],
  [23, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
  [27, 29], [28, 30],
];

// Each joint key maps to the MediaPipe landmark index "at" that joint
const JOINT_LM_IDX: Record<JointKey, number> = {
  leftKnee:   25,
  rightKnee:  26,
  leftHip:    23,
  rightHip:   24,
  leftElbow:  13,
  rightElbow: 14,
};

const RISK_COLOR: Record<number, string> = {
  0: "#22c55e",
  1: "#f59e0b",
  2: "#ef4444",
};
const RISK_LABEL: Record<number, string> = {
  0: "STRENGTH",
  1: "TECHNIQUE",
  2: "INJURY RISK",
};
const JOINT_DISPLAY: Record<JointKey, string> = {
  leftKnee:   "Left Knee",
  rightKnee:  "Right Knee",
  leftHip:    "Left Hip",
  rightHip:   "Right Hip",
  leftElbow:  "Left Elbow",
  rightElbow: "Right Elbow",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type EventKind = "risk" | "strength";

interface TimelineEvent {
  t: number;
  kind: EventKind;
  joints: JointKey[];
  riskLevel: number;
  tick: FrameTick;
  moment?: CoachingMoment;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function bsearchLower(ticks: FrameTick[], t: number): number {
  let lo = 0;
  let hi = ticks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((ticks[mid]?.t ?? 0) < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Linear interpolation between the two ticks bracketing `t`.
 *  Falls back to the nearest tick when only one tick exists or `t` is out of range. */
function lerpTick(ticks: FrameTick[], t: number): FrameTick | null {
  if (!ticks.length) return null;
  if (ticks.length === 1) return ticks[0] ?? null;

  const bIdx = bsearchLower(ticks, t);
  const aIdx = bIdx > 0 ? bIdx - 1 : 0;
  const a = ticks[aIdx]!;
  const b = ticks[bIdx] ?? a;

  if (a === b || b.t <= a.t) return a;

  const alpha = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
  if (alpha <= 0) return a;
  if (alpha >= 1) return b;

  const lm = a.lm.map((pa, i) => {
    const pb = b.lm[i];
    if (!pb) return pa;
    return {
      x: pa.x + (pb.x - pa.x) * alpha,
      y: pa.y + (pb.y - pa.y) * alpha,
      v: pa.v + (pb.v - pa.v) * alpha,
    };
  });

  const angles = { ...a.angles } as FrameTick["angles"];
  for (const k of Object.keys(a.angles) as (keyof FrameTick["angles"])[]) {
    const av = a.angles[k];
    const bv = b.angles[k];
    if (typeof av === "number" && typeof bv === "number") {
      (angles as Record<string, number>)[k] = av + (bv - av) * alpha;
    }
  }

  return { t, lm, angles, jr: a.jr };
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function computeVideoRect(containerW: number, containerH: number, aspect: number) {
  const cAspect = containerW / containerH;
  if (aspect > cAspect) {
    const vH = containerW / aspect;
    return { left: 0, top: (containerH - vH) / 2, width: containerW, height: vH };
  }
  const vW = containerH * aspect;
  return { left: (containerW - vW) / 2, top: 0, width: vW, height: containerH };
}

function computeTickStats(ticks: FrameTick[]): TickStats {
  const acc: Record<string, { angleSum: number; count: number; maxRisk: number; timesFlag: number }> = {};
  for (const tick of ticks) {
    for (const [j, jr] of Object.entries(tick.jr)) {
      if (!jr) continue;
      if (!acc[j]) acc[j] = { angleSum: 0, count: 0, maxRisk: 0, timesFlag: 0 };
      acc[j]!.angleSum += jr.deg;
      acc[j]!.count += 1;
      if (jr.lvl > acc[j]!.maxRisk) acc[j]!.maxRisk = jr.lvl;
      if (jr.lvl >= 1) acc[j]!.timesFlag += 1;
    }
  }
  const joints: TickStats["joints"] = {};
  for (const [j, s] of Object.entries(acc)) {
    joints[j] = { avgAngle: s.count ? s.angleSum / s.count : 0, maxRisk: s.maxRisk, timesFlag: s.timesFlag };
  }
  const duration = ticks.length > 0 ? (ticks[ticks.length - 1]?.t ?? 0) - (ticks[0]?.t ?? 0) : 0;
  return { joints, totalTicks: ticks.length, duration };
}

/** Derive risk events from frameTicks (deduplicated, max 8). */
function deriveRiskEvents(ticks: FrameTick[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const tick of ticks) {
    const joints = (Object.keys(tick.jr) as JointKey[])
      .filter((j) => (tick.jr[j]?.lvl ?? 0) >= 1)
      .sort((a, b) => (tick.jr[b]?.lvl ?? 0) - (tick.jr[a]?.lvl ?? 0));
    if (!joints.length) continue;
    const riskLevel = Math.max(...joints.map((j) => tick.jr[j]?.lvl ?? 0));
    if (!events.some((e) => Math.abs(e.t - tick.t) < 1.5)) {
      events.push({ t: tick.t, kind: "risk", joints, riskLevel, tick });
    }
  }
  return events.slice(0, 8);
}

/** Derive strength events: top-5 ticks where all joints are safe AND visibility is high. */
function deriveStrengthEvents(ticks: FrameTick[], riskEvents: TimelineEvent[]): TimelineEvent[] {
  const candidates = ticks
    .filter((tick) => {
      const jrVals = Object.values(tick.jr);
      if (jrVals.length === 0) return false;
      if (jrVals.some((jr) => (jr?.lvl ?? 0) >= 1)) return false;
      const visSum = tick.lm.reduce((s, l) => s + l.v, 0);
      return visSum / tick.lm.length > 0.65;
    })
    .sort((a, b) => {
      const aVis = a.lm.reduce((s, l) => s + l.v, 0);
      const bVis = b.lm.reduce((s, l) => s + l.v, 0);
      return bVis - aVis;
    });

  const strength: TimelineEvent[] = [];
  for (const tick of candidates) {
    const tooClose =
      riskEvents.some((e) => Math.abs(e.t - tick.t) < 1.0) ||
      strength.some((e) => Math.abs(e.t - tick.t) < 2.0);
    if (tooClose) continue;
    const joints = (Object.keys(tick.jr) as JointKey[]);
    strength.push({ t: tick.t, kind: "strength", joints, riskLevel: 0, tick });
    if (strength.length >= 5) break;
  }
  return strength;
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ label, score, color }: { label: string; score: number; color: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  return (
    <View style={ss.ringWrap}>
      <Svg width={72} height={72}>
        <Circle cx={36} cy={36} r={r} stroke="#1e1e30" strokeWidth={6} fill="none" />
        <Circle
          cx={36} cy={36} r={r}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]} pointerEvents="none">
        <Text style={[ss.ringScore, { color }]}>{score}</Text>
      </View>
      <Text style={ss.ringLabel}>{label}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LivePlaybackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const colors = useColors();

  const videoRef = useRef<Video>(null);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [frameTicks, setFrameTicks] = useState<FrameTick[]>([]);
  const [videoAspect, setVideoAspect] = useState(16 / 9);
  const [loading, setLoading] = useState(true);
  const [noData, setNoData] = useState(false);

  // ── Playback ────────────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTick, setCurrentTick] = useState<FrameTick | null>(null);

  // ── Events ──────────────────────────────────────────────────────────────────
  const [riskEvents, setRiskEvents] = useState<TimelineEvent[]>([]);
  const [strengthEvents, setStrengthEvents] = useState<TimelineEvent[]>([]);
  const allEvents = useMemo(() => [...riskEvents, ...strengthEvents].sort((a, b) => a.t - b.t), [riskEvents, strengthEvents]);
  const firedRef = useRef<Set<number>>(new Set());

  // ── Interrupt sheet ──────────────────────────────────────────────────────────
  const [activeInterrupt, setActiveInterrupt] = useState<TimelineEvent | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<TimelineEvent | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const sheetAnim = useRef(new Animated.Value(400)).current;
  const dimAnim = useRef(new Animated.Value(0)).current;

  // ── Coaching moments ────────────────────────────────────────────────────────
  const [coachingMoments, setCoachingMoments] = useState<CoachingMoment[] | null>(null);
  const [loadingMoments, setLoadingMoments] = useState(false);

  // ── Summary ─────────────────────────────────────────────────────────────────
  const [showSummary, setShowSummary] = useState(false);
  const [movementSummary, setMovementSummary] = useState<MovementSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // ── Derived geometry ────────────────────────────────────────────────────────
  const videoContainerH = useMemo(() => Math.round(screenW / videoAspect), [screenW, videoAspect]);
  const videoRect = useMemo(
    () => computeVideoRect(screenW, videoContainerH, videoAspect),
    [screenW, videoContainerH, videoAspect]
  );

  // ── Load from AsyncStorage ──────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [uri, ticksRaw, aspectRaw] = await Promise.all([
          AsyncStorage.getItem(`video_uri_${id}`),
          AsyncStorage.getItem(`frameTicks_${id}`),
          AsyncStorage.getItem(`videoAspect_${id}`),
        ]);
        if (!uri) { setNoData(true); setLoading(false); return; }
        setVideoUri(uri);
        if (aspectRaw) setVideoAspect(parseFloat(aspectRaw) || 16 / 9);
        if (ticksRaw) {
          try {
            const ticks = JSON.parse(ticksRaw) as FrameTick[];
            if (Array.isArray(ticks) && ticks.length > 0) {
              setFrameTicks(ticks);
              const rEvs = deriveRiskEvents(ticks);
              const sEvs = deriveStrengthEvents(ticks, rEvs);
              setRiskEvents(rEvs);
              setStrengthEvents(sEvs);
            }
          } catch {}
        }
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  // ── Fetch coaching moments (after frameTicks loaded) ────────────────────────
  useEffect(() => {
    if (!id || frameTicks.length === 0) return;
    setLoadingMoments(true);
    const flagged: FlaggedMoment[] = riskEvents.map((ev) => ({
      t: ev.t,
      joints: ev.joints,
      angles: Object.fromEntries(ev.joints.map((j) => [j, ev.tick.angles[j]])) as Partial<Record<JointKey, number>>,
      risks: Object.fromEntries(ev.joints.map((j) => [j, ev.tick.jr[j]?.lvl ?? 0])) as Partial<Record<JointKey, number>>,
    }));
    analysesApi.coachingMoments(id, flagged)
      .then(({ moments }) => {
        setCoachingMoments(moments);
        // Attach each moment to its closest risk event by timestamp + joint overlap
        setRiskEvents((prev) =>
          prev.map((ev) => {
            const m = moments.find(
              (cm) =>
                Math.abs(cm.timestamp - ev.t) < 2.5 &&
                cm.joints.some((j) => ev.joints.includes(j))
            );
            return m ? { ...ev, moment: m } : ev;
          })
        );
      })
      .catch(() => {})
      .finally(() => setLoadingMoments(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, frameTicks.length]);

  // ── Sheet animation helpers ─────────────────────────────────────────────────
  const openSheet = useCallback((ev: TimelineEvent) => {
    setActiveInterrupt(ev);
    setSelectedMarker(ev);
    setSheetExpanded(false);
    Animated.parallel([
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(dimAnim, { toValue: 0.5, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [dimAnim, sheetAnim]);

  const closeSheet = useCallback((then?: () => void) => {
    Animated.parallel([
      Animated.timing(sheetAnim, { toValue: 400, duration: 260, useNativeDriver: true }),
      Animated.timing(dimAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setActiveInterrupt(null);
      setSheetExpanded(false);
      then?.();
    });
  }, [dimAnim, sheetAnim]);

  // ── Interrupt actions ────────────────────────────────────────────────────────
  const continuePlayback = useCallback(() => {
    closeSheet(() => { videoRef.current?.playAsync().catch(() => {}); });
  }, [closeSheet]);

  const replayMoment = useCallback(() => {
    if (!activeInterrupt) return;
    firedRef.current.delete(activeInterrupt.t);
    const seekTo = Math.max(0, (activeInterrupt.t - 2.0) * 1000);
    closeSheet(() => {
      videoRef.current?.setPositionAsync(Math.round(seekTo))
        .then(() => videoRef.current?.playAsync().catch(() => {}))
        .catch(() => {});
    });
  }, [activeInterrupt, closeSheet]);

  const learnMore = useCallback(() => {
    setSheetExpanded(true);
  }, []);

  // ── Marker tap ───────────────────────────────────────────────────────────────
  const handleMarkerTap = useCallback((ev: TimelineEvent) => {
    const ms = Math.max(0, (ev.t - 1.0) * 1000);
    videoRef.current?.pauseAsync().catch(() => {});
    videoRef.current?.setPositionAsync(Math.round(ms)).catch(() => {});
    firedRef.current.add(ev.t);
    openSheet(ev);
  }, [openSheet]);

  // ── Timeline seek (tap on track) ─────────────────────────────────────────────
  const handleTimelineSeek = useCallback((x: number, trackWidth: number) => {
    if (duration <= 0 || trackWidth <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    videoRef.current?.setPositionAsync(Math.round(ratio * duration * 1000)).catch(() => {});
    firedRef.current.clear();
  }, [duration]);

  // ── Playback status ──────────────────────────────────────────────────────────
  const handlePlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    const pos = (status.positionMillis ?? 0) / 1000;
    const dur = (status.durationMillis ?? 0) / 1000;
    setPosition(pos);
    if (dur > 0) setDuration(dur);
    setIsPlaying(status.isPlaying ?? false);

    if (status.didJustFinish) {
      fetchMovementSummary();
      return;
    }

    setCurrentTick(lerpTick(frameTicks, pos));

    // Auto-pause only for risk events
    if (!activeInterrupt) {
      for (const ev of riskEvents) {
        if (!firedRef.current.has(ev.t) && pos >= ev.t - 0.15 && pos <= ev.t + 0.8) {
          firedRef.current.add(ev.t);
          videoRef.current?.pauseAsync().catch(() => {});
          openSheet(ev);
          break;
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameTicks, riskEvents, activeInterrupt, openSheet]);

  // ── Movement summary ─────────────────────────────────────────────────────────
  const fetchMovementSummary = useCallback(() => {
    if (!id || loadingSummary) return;
    setLoadingSummary(true);
    setShowSummary(true);
    const tickStats = frameTicks.length > 0 ? computeTickStats(frameTicks) : undefined;
    analysesApi.movementSummary(id, tickStats)
      .then(({ summary }) => setMovementSummary(summary))
      .catch(() => {})
      .finally(() => setLoadingSummary(false));
  }, [id, frameTicks, loadingSummary]);

  // ── Toggle play/pause ────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (isPlaying) videoRef.current?.pauseAsync().catch(() => {});
    else videoRef.current?.playAsync().catch(() => {});
  }, [isPlaying]);

  // ── Skeleton overlay ─────────────────────────────────────────────────────────
  const skeletonOverlay = useMemo(() => {
    if (!currentTick || !currentTick.lm.length) return null;
    const { lm, jr } = currentTick;

    const lmRisk: Record<number, number> = {};
    for (const [jKey, idx] of Object.entries(JOINT_LM_IDX)) {
      lmRisk[idx] = jr[jKey as JointKey]?.lvl ?? 0;
    }

    const proj = (idx: number) => {
      const p = lm[idx];
      if (!p || p.v < 0.3) return null;
      return { cx: videoRect.left + p.x * videoRect.width, cy: videoRect.top + p.y * videoRect.height };
    };

    const activeJoint = activeInterrupt?.joints[0];
    const activeIdx = activeJoint ? JOINT_LM_IDX[activeJoint] : null;
    const activeAngle = activeJoint ? currentTick.angles[activeJoint] : null;
    const activeColor = activeInterrupt ? (RISK_COLOR[activeInterrupt.riskLevel] ?? "#22c55e") : null;

    const connections = CONNECTIONS.map(([a, b], i) => {
      const pa = proj(a);
      const pb = proj(b);
      if (!pa || !pb) return null;
      const risk = Math.max(lmRisk[a] ?? 0, lmRisk[b] ?? 0);
      const color = risk >= 2 ? "#ef444499" : risk >= 1 ? "#f59e0b99" : colors.primary + "88";
      return <Line key={`c${i}`} x1={pa.cx} y1={pa.cy} x2={pb.cx} y2={pb.cy} stroke={color} strokeWidth={2.5} strokeLinecap="round" />;
    }).filter(Boolean);

    const dots = lm.map((p, i) => {
      if (p.v < 0.35) return null;
      const cx = videoRect.left + p.x * videoRect.width;
      const cy = videoRect.top + p.y * videoRect.height;
      const risk = lmRisk[i] ?? 0;
      const color = risk >= 2 ? "#ef4444" : risk >= 1 ? "#f59e0b" : colors.primary + "bb";
      const r = risk >= 1 ? 5 : 3.5;
      return (
        <G key={`d${i}`}>
          {risk >= 1 && <Circle cx={cx} cy={cy} r={r + 5} fill={color + "28"} />}
          <Circle cx={cx} cy={cy} r={r} fill={color} />
        </G>
      );
    }).filter(Boolean);

    // Angle label + emphasis ring on the active interrupt joint
    let interruptAnnotation = null;
    if (activeInterrupt && activeIdx !== null) {
      const pt = proj(activeIdx);
      if (pt && activeColor && activeAngle != null) {
        const labelX = pt.cx + 14;
        const labelY = pt.cy - 14;
        interruptAnnotation = (
          <G>
            {/* Pulsing emphasis ring */}
            <Circle cx={pt.cx} cy={pt.cy} r={18} fill={activeColor + "30"} stroke={activeColor} strokeWidth={1.5} />
            {/* Arrow caret */}
            <Polygon
              points={`${labelX - 5},${labelY + 4} ${labelX},${pt.cy} ${labelX + 5},${labelY + 4}`}
              fill={activeColor + "cc"}
            />
            {/* Angle label pill */}
            <Circle cx={labelX + 2} cy={labelY - 8} r={18} fill="#0e0e1a" stroke={activeColor} strokeWidth={1.5} />
            <SvgText
              x={labelX + 2}
              y={labelY - 4}
              fill={activeColor}
              fontSize={10}
              fontWeight="bold"
              textAnchor="middle"
            >
              {Math.round(activeAngle)}°
            </SvgText>
          </G>
        );
      }
    }

    return (
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {connections}
        {dots}
        {interruptAnnotation}
      </Svg>
    );
  }, [currentTick, videoRect, activeInterrupt]);

  // ── Loading / no-data ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[ss.root, ss.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={ss.loadingText}>Loading breakdown…</Text>
      </View>
    );
  }
  if (noData || !videoUri) {
    return (
      <View style={[ss.root, ss.center]}>
        <Feather name="alert-circle" size={36} color="#55556e" />
        <Text style={ss.noDataTitle}>No video available</Text>
        <Text style={ss.noDataSub}>Complete a scan first to unlock the breakdown.</Text>
        <TouchableOpacity style={[ss.outlineBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "55" }]} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={ss.outlineBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progressPct = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View style={ss.root}>
      {/* Header */}
      <View style={[ss.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={ss.iconBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <Feather name="chevron-left" size={20} color="#8888aa" />
        </TouchableOpacity>
        <Text style={ss.headerTitle}>Movement Breakdown</Text>
        {loadingMoments && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, opacity: 0.7 }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={ss.mutedText}>Loading cards…</Text>
          </View>
        )}
        <TouchableOpacity style={[ss.summaryBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]} onPress={fetchMovementSummary} activeOpacity={0.8}>
          <Feather name="bar-chart-2" size={13} color="#a78bfa" />
          <Text style={ss.summaryBtnText}>Summary</Text>
        </TouchableOpacity>
      </View>

      {/* Video + skeleton overlay */}
      <View style={[ss.videoBox, { height: videoContainerH }]}>
        <Video
          ref={videoRef}
          source={{ uri: videoUri }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={false}
          isLooping={false}
          progressUpdateIntervalMillis={100}
          onPlaybackStatusUpdate={handlePlaybackStatus}
          onReadyForDisplay={(event) => {
            const { width, height } = event.naturalSize;
            if (width > 0 && height > 0) setVideoAspect(width / height);
          }}
          onLoad={(status: AVPlaybackStatus) => {
            if (status.isLoaded && status.durationMillis) setDuration(status.durationMillis / 1000);
          }}
        />
        {skeletonOverlay}

        {/* Risk HUD (current joint reading) */}
        {currentTick && (() => {
          const flagged = (Object.entries(currentTick.jr) as [JointKey, { deg: number; lvl: number } | undefined][])
            .filter(([, jr]) => (jr?.lvl ?? 0) >= 1)
            .sort(([, a], [, b]) => (b?.lvl ?? 0) - (a?.lvl ?? 0));
          if (!flagged.length) return null;
          const [topJ, topJr] = flagged[0]!;
          const color = RISK_COLOR[topJr?.lvl ?? 0] ?? "#22c55e";
          return (
            <View style={[ss.hud, { borderColor: color + "60" }]}>
              <View style={[ss.hudDot, { backgroundColor: color }]} />
              <Text style={[ss.hudText, { color }]}>
                {JOINT_DISPLAY[topJ]}  {Math.round(topJr?.deg ?? 0)}°
              </Text>
            </View>
          );
        })()}
      </View>

      {/* Controls row */}
      <View style={ss.controls}>
        <TouchableOpacity style={[ss.playBtn, { backgroundColor: colors.primary }]} onPress={togglePlay} activeOpacity={0.8}>
          <Feather name={isPlaying ? "pause" : "play"} size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={ss.timeText}>{formatTime(position)} / {formatTime(duration)}</Text>
        <View style={{ flex: 1 }} />
        <View style={ss.legendRow}>
          <View style={[ss.legendDot, { backgroundColor: "#ef4444" }]} />
          <Text style={ss.legendText}>Risk</Text>
          <View style={[ss.legendDot, { backgroundColor: "#22c55e" }]} />
          <Text style={ss.legendText}>Strong</Text>
        </View>
      </View>

      {/* Timeline strip */}
      <View
        style={ss.timelineWrap}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => handleTimelineSeek(e.nativeEvent.locationX, screenW - 28)}
        onResponderMove={(e) => handleTimelineSeek(e.nativeEvent.locationX, screenW - 28)}
      >
        {/* Track */}
        <View style={ss.timelineTrack}>
          <View style={[ss.timelineFill, { width: `${progressPct * 100}%`, backgroundColor: colors.primary }]} />
        </View>
        {/* Event markers — each individually tappable */}
        {allEvents.map((ev) => {
          const pct = duration > 0 ? Math.min(100, (ev.t / duration) * 100) : 0;
          const color = ev.riskLevel >= 2 ? "#ef4444" : ev.riskLevel >= 1 ? "#f59e0b" : "#22c55e";
          const isSelected = selectedMarker?.t === ev.t;
          return (
            <TouchableOpacity
              key={`${ev.kind}-${ev.t}`}
              style={[ss.markerBtn, { left: `${pct}%` as any }]}
              onPress={() => handleMarkerTap(ev)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View
                style={[
                  ss.markerDot,
                  { backgroundColor: color },
                  isSelected && { borderWidth: 2.5, borderColor: "#fff", width: 14, height: 14, borderRadius: 7, marginLeft: -7, marginTop: -7 },
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Dim layer behind sheet */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: dimAnim }]}
        pointerEvents={activeInterrupt ? "auto" : "none"}
        onStartShouldSetResponder={() => !!activeInterrupt}
        onResponderGrant={() => { if (activeInterrupt?.kind === "strength") continuePlayback(); }}
      />

      {/* Interrupt / coaching card bottom sheet */}
      <Animated.View
        style={[
          ss.sheet,
          { transform: [{ translateY: sheetAnim }], paddingBottom: insets.bottom + 8 },
        ]}
      >
        {activeInterrupt && (() => {
          const ev = activeInterrupt;
          const m = ev.moment;
          const color = RISK_COLOR[ev.riskLevel] ?? "#22c55e";
          const topJ = ev.joints[0];
          const jrData = topJ ? ev.tick.jr[topJ] : undefined;
          const isStrength = ev.kind === "strength";

          return (
            <>
              <View style={ss.sheetHandle} />

              {/* Risk / strength badge */}
              <View style={[ss.badge, { backgroundColor: color + "22", borderColor: color + "55" }]}>
                <View style={[ss.badgeDot, { backgroundColor: color }]} />
                <Text style={[ss.badgeText, { color }]}>
                  {RISK_LABEL[ev.riskLevel] ?? "FLAGGED"}
                  {topJ ? ` · ${JOINT_DISPLAY[topJ]}` : ""}
                  {jrData ? `  ${Math.round(jrData.deg)}°` : ""}
                </Text>
                {m && (
                  <View style={[ss.confBadge, { borderColor: color + "44" }]}>
                    <Text style={[ss.confText, { color: color }]}>{Math.round(m.confidence * 100)}% conf</Text>
                  </View>
                )}
              </View>

              {/* Observation */}
              {m ? (
                <Text style={ss.sheetTitle}>{m.whatWeNoticed}</Text>
              ) : (
                <Text style={ss.sheetTitle}>
                  {isStrength
                    ? `Clean form at ${topJ ? JOINT_DISPLAY[topJ] : "joint"}`
                    : `Elevated angle at ${topJ ? JOINT_DISPLAY[topJ] : "joint"}`}
                </Text>
              )}

              {/* Why it matters */}
              {m && <Text style={ss.sheetSub}>{m.whyItMatters}</Text>}

              {/* Suggested fix */}
              {m && !isStrength && (
                <View style={[ss.fixRow, { borderColor: color + "44" }]}>
                  <Feather name="zap" size={12} color={color} />
                  <Text style={[ss.fixText, { color }]}>{m.suggestedFix}</Text>
                </View>
              )}

              {/* Low-confidence note */}
              {m && m.confidence < 0.70 && m.confidenceNote && (
                <Text style={ss.confNote}>{m.confidenceNote}</Text>
              )}

              {/* Expanded "Learn More" section */}
              {sheetExpanded && m && (
                <View style={ss.expandedBlock}>
                  {/* Evidence */}
                  {(m.evidence.joint || m.evidence.angle != null) && (
                    <View style={ss.evidenceRow}>
                      <Feather name="target" size={11} color={colors.primary} />
                      <Text style={ss.evidenceLabel}>Evidence · </Text>
                      <Text style={ss.evidenceValue}>
                        {m.evidence.joint ? JOINT_DISPLAY[m.evidence.joint as JointKey] ?? m.evidence.joint : ""}
                        {m.evidence.angle != null ? `  ${Math.round(m.evidence.angle)}°` : ""}
                        {m.evidence.timestamp != null ? `  @ ${formatTime(m.evidence.timestamp)}` : ""}
                      </Text>
                    </View>
                  )}
                  {/* Confidence bar */}
                  <View style={ss.confBarWrap}>
                    <Text style={ss.confBarLabel}>Confidence</Text>
                    <View style={ss.confBarTrack}>
                      <View style={[ss.confBarFill, { width: `${Math.round(m.confidence * 100)}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[ss.confBarPct, { color }]}>{Math.round(m.confidence * 100)}%</Text>
                  </View>
                  {/* Timestamp */}
                  <Text style={ss.evidenceTs}>Captured at {formatTime(ev.t)} in the video</Text>
                </View>
              )}

              {/* Action buttons */}
              <View style={ss.actionRow}>
                {!isStrength && (
                  <>
                    <TouchableOpacity style={[ss.actionBtn, ss.actionBtnGhost]} onPress={replayMoment} activeOpacity={0.8}>
                      <Feather name="rotate-ccw" size={13} color="#8888aa" />
                      <Text style={ss.actionBtnGhostText}>Replay</Text>
                    </TouchableOpacity>
                    {m && !sheetExpanded && (
                      <TouchableOpacity style={[ss.actionBtn, ss.actionBtnGhost]} onPress={learnMore} activeOpacity={0.8}>
                        <Feather name="info" size={13} color="#8888aa" />
                        <Text style={ss.actionBtnGhostText}>Learn More</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
                <TouchableOpacity
                  style={[ss.actionBtn, ss.actionBtnPrimary, { flex: 1, backgroundColor: colors.primary }]}
                  onPress={continuePlayback}
                  activeOpacity={0.85}
                >
                  <Feather name="play" size={14} color="#fff" />
                  <Text style={ss.actionBtnPrimaryText}>
                    {isStrength ? "Continue" : "Continue Playback"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          );
        })()}
      </Animated.View>

      {/* Movement Summary Modal */}
      <Modal visible={showSummary} animationType="slide" onRequestClose={() => setShowSummary(false)}>
        <View style={[ss.summaryRoot, { paddingTop: insets.top }]}>
          <View style={ss.summaryHeader}>
            <Text style={ss.summaryHeaderTitle}>Movement Summary</Text>
            <TouchableOpacity onPress={() => setShowSummary(false)} activeOpacity={0.7} style={{ padding: 4 }}>
              <Feather name="x" size={20} color="#8888aa" />
            </TouchableOpacity>
          </View>

          {loadingSummary ? (
            <View style={[ss.center, { flex: 1 }]}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={ss.loadingText}>Analysing your movement…</Text>
              <Text style={ss.mutedText}>Claude is scoring 5 quality dimensions</Text>
            </View>
          ) : movementSummary ? (
            <ScrollView
              contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Overall ring hero */}
              <View style={ss.overallHero}>
                <View style={ss.overallRingWrap}>
                  {(() => {
                    const r = 50;
                    const circ = 2 * Math.PI * r;
                    const fill = circ * (movementSummary.overallScore / 100);
                    return (
                      <Svg width={120} height={120}>
                        <Circle cx={60} cy={60} r={r} stroke="#1e1e30" strokeWidth={8} fill="none" />
                        <Circle
                          cx={60} cy={60} r={r}
                          stroke={colors.primary}
                          strokeWidth={8}
                          fill="none"
                          strokeDasharray={`${fill} ${circ - fill}`}
                          strokeLinecap="round"
                          transform="rotate(-90 60 60)"
                        />
                      </Svg>
                    );
                  })()}
                  <View style={[StyleSheet.absoluteFill, ss.center]}>
                    <Text style={[ss.overallScore, { color: colors.primary }]}>{movementSummary.overallScore}</Text>
                    <Text style={ss.overallLabel}>OVERALL</Text>
                  </View>
                </View>
                <Text style={ss.coachSummary}>{movementSummary.coachSummary}</Text>
              </View>

              {/* 5 dimension rings */}
              <View style={ss.ringsRow}>
                <ScoreRing label="Flow"        score={movementSummary.flowScore}         color={colors.primary} />
                <ScoreRing label="Efficiency"  score={movementSummary.efficiencyScore}   color="#22c55e" />
                <ScoreRing label="Control"     score={movementSummary.bodyControlScore}  color="#f59e0b" />
                <ScoreRing label="Consistency" score={movementSummary.consistencyScore}  color="#06b6d4" />
                <ScoreRing label="Rhythm"      score={movementSummary.rhythmScore}       color="#a78bfa" />
              </View>

              {/* Priority fix */}
              <View style={ss.priorityCard}>
                <View style={ss.priorityHeader}>
                  <Feather name="target" size={13} color="#ef4444" />
                  <Text style={ss.priorityLabel}>PRIORITY FIX</Text>
                </View>
                <Text style={ss.priorityText}>{movementSummary.mostImportantFix}</Text>
              </View>

              {/* Strengths */}
              <View style={ss.listBlock}>
                <View style={ss.listBlockHeader}>
                  <Feather name="trending-up" size={11} color="#22c55e" />
                  <Text style={[ss.listBlockLabel, { color: "#22c55e88" }]}>TOP STRENGTHS</Text>
                </View>
                {movementSummary.topStrengths.map((s, i) => (
                  <View key={i} style={ss.listRow}>
                    <View style={[ss.listDot, { backgroundColor: "#22c55e" }]} />
                    <Text style={ss.listText}>{s}</Text>
                  </View>
                ))}
              </View>

              {/* Improvements */}
              <View style={ss.listBlock}>
                <View style={ss.listBlockHeader}>
                  <Feather name="arrow-up-right" size={11} color="#f59e0b" />
                  <Text style={[ss.listBlockLabel, { color: "#f59e0b88" }]}>AREAS TO IMPROVE</Text>
                </View>
                {movementSummary.topImprovements.map((s, i) => (
                  <View key={i} style={ss.listRow}>
                    <View style={[ss.listDot, { backgroundColor: "#f59e0b" }]} />
                    <Text style={ss.listText}>{s}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[ss.doneBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowSummary(false)}
                activeOpacity={0.85}
              >
                <Text style={ss.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <View style={[ss.center, { flex: 1 }]}>
              <Feather name="alert-circle" size={32} color="#55556e" />
              <Text style={ss.noDataTitle}>Couldn't load summary</Text>
              <TouchableOpacity style={[ss.outlineBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "55" }]} onPress={() => setShowSummary(false)} activeOpacity={0.8}>
                <Text style={ss.outlineBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a14" },
  center: { alignItems: "center", justifyContent: "center", gap: 10 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "#0e0e1a",
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff0d",
    gap: 8,
  },
  iconBtn: {
    width: 32, height: 32,
    borderRadius: 8,
    backgroundColor: "#ffffff08",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#e8e8ff" },
  mutedText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#55556e" },
  summaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  summaryBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#a78bfa" },

  // Video
  videoBox: { width: "100%", backgroundColor: "#000", overflow: "hidden" },
  hud: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#0a0a14cc",
    borderWidth: 1,
  },
  hudDot: { width: 6, height: 6, borderRadius: 3 },
  hudText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  // Controls
  controls: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: "#0e0e1a",
  },
  playBtn: {
    width: 40, height: 40,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#8888aa", letterSpacing: 0.4 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#55556e", marginRight: 4 },

  // Timeline
  timelineWrap: {
    height: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: "#0e0e1a",
    borderTopWidth: 1,
    borderTopColor: "#ffffff08",
  },
  timelineTrack: {
    height: 3,
    backgroundColor: "#ffffff15",
    borderRadius: 2,
    overflow: "hidden",
  },
  timelineFill: { height: "100%", borderRadius: 2 },
  markerBtn: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    marginLeft: -12,
    top: 8,
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    marginTop: -5,
    borderWidth: 1.5,
    borderColor: "#0a0a14",
  },

  // Sheet
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#12122a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#ffffff12",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.5, shadowRadius: 14 },
      android: { elevation: 24 },
    }),
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ffffff30", alignSelf: "center", marginBottom: 12 },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 3.5 },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.7 },
  confBadge: {
    marginLeft: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  confText: { fontSize: 9, fontFamily: "Inter_500Medium" },
  confNote: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6b7280", marginBottom: 6, fontStyle: "italic" },

  sheetTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#e8e8ff", lineHeight: 22, marginBottom: 5 },
  sheetSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#8888aa", lineHeight: 19, marginBottom: 10 },

  fixRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#ffffff05",
  },
  fixText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 18 },

  // Expanded learn-more block
  expandedBlock: {
    borderTopWidth: 1,
    borderTopColor: "#ffffff12",
    marginTop: 8,
    paddingTop: 10,
    gap: 8,
    marginBottom: 8,
  },
  evidenceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  evidenceLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#55556e" },
  evidenceValue: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#aaaacc", flex: 1 },
  evidenceTs: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#55556e" },
  confBarWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  confBarLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#55556e", width: 72 },
  confBarTrack: { flex: 1, height: 4, backgroundColor: "#ffffff15", borderRadius: 2, overflow: "hidden" },
  confBarFill: { height: "100%", borderRadius: 2 },
  confBarPct: { fontSize: 10, fontFamily: "Inter_500Medium", width: 30, textAlign: "right" },

  // Action buttons
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  actionBtnGhost: { borderWidth: 1, borderColor: "#ffffff18", backgroundColor: "#ffffff08" },
  actionBtnGhostText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8888aa" },
  actionBtnPrimary: {},
  actionBtnPrimaryText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // Utility
  outlineBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  outlineBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#a78bfa" },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#8888aa" },
  noDataTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#e8e8ff", textAlign: "center" },
  noDataSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#55556e", textAlign: "center", paddingHorizontal: 28 },

  // Summary modal
  summaryRoot: { flex: 1, backgroundColor: "#0a0a14" },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff0d",
  },
  summaryHeaderTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#e8e8ff" },
  overallHero: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 20, gap: 14 },
  overallRingWrap: { width: 120, height: 120 },
  overallScore: { fontSize: 30, fontFamily: "Inter_700Bold" },
  overallLabel: { fontSize: 8, fontFamily: "Inter_600SemiBold", color: "#55556e", letterSpacing: 1.5 },
  coachSummary: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#aaaacc", textAlign: "center", lineHeight: 20 },
  ringsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  ringWrap: { alignItems: "center", width: 80 },
  ringScore: { fontSize: 16, fontFamily: "Inter_700Bold" },
  ringLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#8888aa", marginTop: 4 },
  priorityCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#ef444410",
    borderWidth: 1,
    borderColor: "#ef444430",
  },
  priorityHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  priorityLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#ef444488", letterSpacing: 1 },
  priorityText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#e8e8ff", lineHeight: 20 },
  listBlock: { marginHorizontal: 16, marginBottom: 16 },
  listBlockHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  listBlockLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  listDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  listText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#c0c0d8", lineHeight: 19 },
  doneBtn: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  doneBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
