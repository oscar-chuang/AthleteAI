import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from "react-native";
import Svg, { Line, Path, Polyline, Circle, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import {
  progress as progressApi,
  achievements as achievementsApi,
  profile as profileApi,
  jointTrends as jointTrendsApi,
  movementSummaryHistory as movementSummaryHistoryApi,
  analyses as analysesApi,
  type ProgressRecord,
  type AchievementRecord,
  type ProfileStats,
  type JointTrendsResponse,
  type JointDataPoint,
  type SportEntry,
  type PersonalRecordEntry,
  type JointImprovement,
  type MovementSummaryDataPoint,
} from "@/lib/api";
import { getSportConfig, JOINT_DISPLAY, SPORT_ICONS, type MetricKey } from "@/constants/sportConfig";
import JointHistorySheet from "@/components/JointHistorySheet";

const RISK_COLOR_MAP = ["#22c55e", "#f59e0b", "#ef4444"] as const;
const RISK_LABEL_MAP = ["Safe", "Caution", "High Risk"] as const;

// Movement quality dimension config — colors match the live skeleton screen
const MOVEMENT_DIMENSIONS: { key: keyof MovementSummaryDataPoint; label: string; color: string }[] = [
  { key: "flowScore",         label: "Flow",        color: "#6c63ff" },
  { key: "efficiencyScore",   label: "Efficiency",  color: "#22c55e" },
  { key: "bodyControlScore",  label: "Control",     color: "#f59e0b" },
  { key: "consistencyScore",  label: "Consistency", color: "#06b6d4" },
  { key: "rhythmScore",       label: "Rhythm",      color: "#a78bfa" },
];

const JOINT_SPARKLINE_W = 64;
const JOINT_SPARKLINE_H = 28;

function ScoreSparkline({ scores, color }: { scores: number[]; color: string }) {
  if (scores.length < 2) {
    return (
      <View style={{ width: JOINT_SPARKLINE_W, height: JOINT_SPARKLINE_H, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 9, color }}>—</Text>
      </View>
    );
  }
  const min = Math.max(0, Math.min(...scores) - 5);
  const max = Math.min(100, Math.max(...scores) + 5);
  const range = max - min || 1;
  const step = JOINT_SPARKLINE_W / (scores.length - 1);
  const pts = scores.map((v, i) => {
    const x = i * step;
    const y = JOINT_SPARKLINE_H - ((v - min) / range) * JOINT_SPARKLINE_H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const lastX = (scores.length - 1) * step;
  const lastY = JOINT_SPARKLINE_H - ((scores[scores.length - 1]! - min) / range) * JOINT_SPARKLINE_H;
  return (
    <Svg width={JOINT_SPARKLINE_W} height={JOINT_SPARKLINE_H} style={{ overflow: "visible" }}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={lastX} cy={lastY} r={3} fill={color} />
    </Svg>
  );
}

function JointSparkline({ data, color }: { data: JointDataPoint[]; color: string }) {
  if (data.length < 2) {
    return (
      <View style={{ width: JOINT_SPARKLINE_W, height: JOINT_SPARKLINE_H, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 9, color }}>—</Text>
      </View>
    );
  }
  const angles = data.map((d) => d.angle);
  const min = Math.min(...angles);
  const max = Math.max(...angles);
  const range = max - min || 1;
  const step = JOINT_SPARKLINE_W / (data.length - 1);
  const pts = data.map((d, i) => {
    const x = i * step;
    const y = JOINT_SPARKLINE_H - ((d.angle - min) / range) * JOINT_SPARKLINE_H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const lastX = (data.length - 1) * step;
  const lastY = JOINT_SPARKLINE_H - ((data[data.length - 1]!.angle - min) / range) * JOINT_SPARKLINE_H;
  return (
    <Svg width={JOINT_SPARKLINE_W} height={JOINT_SPARKLINE_H} style={{ overflow: "visible" }}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={lastX} cy={lastY} r={3} fill={color} />
    </Svg>
  );
}


const ALL_METRICS: MetricKey[] = ["overall", "technique", "power", "balance", "consistency", "mobility", "speed"];
type Period = "1W" | "1M" | "3M" | "All";

const METRIC_KEY_MAP: Record<MetricKey, keyof ProgressRecord> = {
  overall:      "overallScore",
  technique:    "techniqueScore",
  power:        "powerScore",
  balance:      "balanceScore",
  consistency:  "consistencyScore",
  mobility:     "mobilityScore",
  speed:        "speedScore",
};

const CHART_H = 160;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

function getScoreColor(score: number, colors: ReturnType<typeof useColors>) {
  if (score >= 80) return colors.success;
  if (score >= 65) return colors.primary;
  return colors.warning;
}

function getScoreBand(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 65) return "On Track";
  return "Focus Here";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function periodCutoff(period: Period): Date | null {
  if (period === "All") return null;
  const d = new Date();
  if (period === "1W") d.setDate(d.getDate() - 7);
  else if (period === "1M") d.setMonth(d.getMonth() - 1);
  else if (period === "3M") d.setMonth(d.getMonth() - 3);
  return d;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scrollTo } = useLocalSearchParams<{ scrollTo?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const trendsYRef = useRef<number>(0);

  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [selectedMovementType, setSelectedMovementType] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<MetricKey>("overall");
  const [period, setPeriod] = useState<Period>("All");

  const [allEntries, setAllEntries] = useState<ProgressRecord[]>([]);
  const [sportsList, setSportsList] = useState<SportEntry[]>([]);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [allTrends, setAllTrends] = useState<JointTrendsResponse | null>(null);
  const [allMovementHistory, setAllMovementHistory] = useState<MovementSummaryDataPoint[]>([]);
  const [personalRecords, setPersonalRecords] = useState<Record<string, PersonalRecordEntry>>({});
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [drillsDoneCount, setDrillsDoneCount] = useState(0);
  const [drillsCorrective, setDrillsCorrective] = useState<number | null>(null);
  const [drillsPerformance, setDrillsPerformance] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [selectedJoint, setSelectedJoint] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;
  const chartWidth = SCREEN_WIDTH - 56;

  // Sport config derived from selected sport
  const sportConfig = useMemo(
    () => getSportConfig(selectedSport ?? "other"),
    [selectedSport]
  );
  const accentColor = selectedSport ? sportConfig.accentColor : colors.primary;

  // Metrics available for selected sport
  const availableMetrics = useMemo(
    () => (selectedSport ? sportConfig.metrics : ALL_METRICS),
    [selectedSport, sportConfig]
  );

  // Joints available for selected sport
  const availableJoints = useMemo(
    () => (selectedSport ? sportConfig.joints : Object.keys(JOINT_DISPLAY)),
    [selectedSport, sportConfig]
  );

  // Movement types for selected sport from sports list
  const availableMovementTypes = useMemo(() => {
    if (!selectedSport) return [];
    const entry = sportsList.find((s) => s.sport === selectedSport);
    return entry?.movementTypes ?? [];
  }, [selectedSport, sportsList]);

  const loadDrillsDone = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const drillKeys = keys.filter((k) => k.startsWith("drill_done_"));
      if (drillKeys.length === 0) {
        setDrillsDoneCount(0);
        setDrillsCorrective(null);
        setDrillsPerformance(null);
        return;
      }

      const pairs = await AsyncStorage.multiGet(drillKeys);

      // Build a map of analysisId → completed tip IDs
      const analysisCompletedTips: Record<string, string[]> = {};
      let total = 0;
      for (const [key, val] of pairs) {
        if (val) {
          try {
            const ids = JSON.parse(val) as string[];
            const analysisId = key.replace("drill_done_", "");
            analysisCompletedTips[analysisId] = ids;
            total += ids.length;
          } catch {}
        }
      }
      setDrillsDoneCount(total);

      // Fetch tips for each analysis to classify drills as corrective vs performance
      try {
        const results = await Promise.allSettled(
          Object.keys(analysisCompletedTips).map((id) => analysesApi.get(id))
        );

        let corrective = 0;
        let performance = 0;

        results.forEach((result, idx) => {
          const analysisId = Object.keys(analysisCompletedTips)[idx]!;
          const completedIds = new Set(analysisCompletedTips[analysisId]);
          if (result.status === "fulfilled") {
            for (const tip of result.value.tips) {
              if (completedIds.has(tip.id)) {
                if (tip.tipType === "injury") {
                  corrective++;
                } else {
                  performance++;
                }
              }
            }
          }
        });

        // Only show breakdown if we were able to classify at least one drill
        if (corrective + performance > 0) {
          setDrillsCorrective(corrective);
          setDrillsPerformance(performance);
        } else {
          setDrillsCorrective(null);
          setDrillsPerformance(null);
        }
      } catch {
        // If tip fetching fails, show total only (no breakdown)
        setDrillsCorrective(null);
        setDrillsPerformance(null);
      }
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    setError(false);
    try {
      const [{ entries: e }, { sports }, { achievements: a }, st, tr, mh] = await Promise.all([
        progressApi.list(),
        progressApi.sports(),
        achievementsApi.list(),
        profileApi.stats().catch(() => null),
        jointTrendsApi.get().catch(() => null),
        movementSummaryHistoryApi.get().catch(() => null),
      ]);
      setAllEntries(e);
      setAchievements(a);
      if (st) setStats(st);
      if (tr) setAllTrends(tr);
      if (mh) setAllMovementHistory(mh.history);

      // Auto-select the most-common sport if not already selected
      if (sports.length > 0) {
        setSportsList(sports);
        setSelectedSport((prev) => prev ?? sports[0]!.sport);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    await loadDrillsDone();
  }, [loadDrillsDone]);

  // Load personal records and AI summary when sport/movement changes
  const loadSportSpecific = useCallback(async (sport: string | null, movementType: string | null) => {
    if (!sport) return;

    const [prResult] = await Promise.all([
      progressApi.personalRecords(sport).catch(() => null),
    ]);
    if (prResult) setPersonalRecords(prResult.records);

    // AI summary in background
    setAiSummaryLoading(true);
    setAiSummary(null);
    progressApi.summary(sport, movementType ?? undefined)
      .then(({ summary }) => setAiSummary(summary))
      .catch(() => setAiSummary(null))
      .finally(() => setAiSummaryLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    loadSportSpecific(selectedSport, selectedMovementType);
  }, [selectedSport, selectedMovementType, loadSportSpecific]);

  // Reset metric to first available when sport changes
  useEffect(() => {
    if (!availableMetrics.includes(activeMetric)) {
      setActiveMetric(availableMetrics[0] ?? "overall");
    }
  }, [availableMetrics, activeMetric]);

  // Reset movement type when sport changes
  useEffect(() => {
    setSelectedMovementType(null);
  }, [selectedSport]);

  // Scroll to trends on deep-link
  useEffect(() => {
    if (scrollTo !== "trends" || loading) return;
    const y = trendsYRef.current;
    if (y > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y, animated: true });
      }, 150);
    }
  }, [scrollTo, loading]);

  // ── Derived: entries filtered by sport + movement type + period ──────────────
  const sportEntries = useMemo(() => {
    if (!selectedSport) return allEntries;
    return allEntries.filter((e) => e.sport.toLowerCase() === selectedSport);
  }, [allEntries, selectedSport]);

  const movementEntries = useMemo(() => {
    if (!selectedMovementType) return sportEntries;
    return sportEntries.filter((e) => e.movementType === selectedMovementType);
  }, [sportEntries, selectedMovementType]);

  const filteredEntries = useMemo(() => {
    const cutoff = periodCutoff(period);
    if (!cutoff) return movementEntries;
    return movementEntries.filter((e) => new Date(e.date) >= cutoff);
  }, [movementEntries, period]);

  // ── Derived: movement summary history filtered by sport + period ─────────────
  const filteredMovementHistory = useMemo((): MovementSummaryDataPoint[] => {
    const cutoff = periodCutoff(period);
    return allMovementHistory
      .filter((d) => !selectedSport || d.sport.toLowerCase() === selectedSport)
      .filter((d) => !cutoff || new Date(d.date) >= cutoff);
  }, [allMovementHistory, selectedSport, period]);

  // ── Derived: joint trends filtered by sport + available joints ───────────────
  const filteredTrends = useMemo((): JointTrendsResponse | null => {
    if (!allTrends) return null;
    const jointsToShow = new Set(availableJoints as string[]);
    const filteredJoints: Record<string, JointDataPoint[]> = {};

    for (const [joint, history] of Object.entries(allTrends.joints)) {
      if (!jointsToShow.has(joint)) continue;
      const sportHistory = selectedSport
        ? history.filter((p) => p.sport.toLowerCase() === selectedSport)
        : history;
      if (sportHistory.length > 0) filteredJoints[joint] = sportHistory;
    }

    const filteredImprovements = allTrends.improvements.filter((imp) =>
      jointsToShow.has(imp.joint)
    );

    return { joints: filteredJoints, improvements: filteredImprovements };
  }, [allTrends, selectedSport, availableJoints]);

  // ── Score chart values ───────────────────────────────────────────────────────
  const values = filteredEntries.map(
    (p) => (p[METRIC_KEY_MAP[activeMetric]] as number | undefined) ?? p.overallScore
  );
  const minVal = values.length ? Math.max(0, Math.min(...values) - 8) : 0;
  const maxVal = values.length ? Math.min(100, Math.max(...values) + 8) : 100;
  const range = maxVal - minVal || 1;
  const lineColor = accentColor;

  function toY(val: number) {
    return CHART_H - ((val - minVal) / range) * CHART_H;
  }

  const pointSpacing = values.length > 1 ? chartWidth / (values.length - 1) : 0;
  const currentScore = values[values.length - 1] ?? 0;
  const firstScore = values[0] ?? 0;
  const gained = Math.round(currentScore - firstScore);
  const gainPct = firstScore > 0 ? Math.round((gained / firstScore) * 100) : 0;
  const sessionLog = [...filteredEntries].reverse();

  const mostImproved = (() => {
    if (!filteredTrends?.improvements?.length) return null;
    const positives = filteredTrends.improvements.filter((i) => i.improved && i.deltaDeg > 0);
    if (!positives.length) return null;
    return positives.reduce((best, cur) => (cur.deltaDeg > best.deltaDeg ? cur : best));
  })();

  // ── Achievements grouped by sport ────────────────────────────────────────────
  const groupedAchievements = useMemo(() => {
    const groups: { label: string; sport: string | null; items: AchievementRecord[] }[] = [];
    const globalItems = achievements.filter((a) => a.sport === null);
    const sportMap = new Map<string, AchievementRecord[]>();
    for (const a of achievements.filter((a) => a.sport !== null)) {
      const sp = a.sport!;
      if (!sportMap.has(sp)) sportMap.set(sp, []);
      sportMap.get(sp)!.push(a);
    }

    if (selectedSport) {
      const sportItems = sportMap.get(selectedSport) ?? [];
      if (sportItems.length > 0) {
        groups.push({ label: capitalize(selectedSport), sport: selectedSport, items: sportItems });
      }
      groups.push({ label: "All Sports", sport: null, items: globalItems });
    } else {
      for (const [sport, items] of sportMap.entries()) {
        groups.push({ label: capitalize(sport), sport, items });
      }
      groups.push({ label: "All Sports", sport: null, items: globalItems });
    }

    return groups.filter((g) => g.items.length > 0);
  }, [achievements, selectedSport]);

  const s = useMemo(() => StyleSheet.create({
    container:        { flex: 1, backgroundColor: colors.background },
    header:           { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 12 },
    title:            { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.foreground },
    subtitle:         { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 4 },
    section:          { paddingHorizontal: 20, marginBottom: 24 },
    sectionRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    sectionTitle:     { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    sectionCount:     { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    summaryRow:       { flexDirection: "row", gap: 10, marginBottom: 24, paddingHorizontal: 20 },
    summaryCard:      { flex: 1, backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    summaryValue:     { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    summaryLabel:     { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
    periodRow:        { flexDirection: "row", gap: 6, marginBottom: 14 },
    periodBtn:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    periodBtnText:    { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    metricPicker:     { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
    metricChip:       { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    metricChipText:   { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textTransform: "capitalize" },
    chartContainer:   { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16, overflow: "hidden" },
    chartHeader:      { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 12 },
    chartScore:       { fontSize: 28, fontFamily: "Inter_700Bold" },
    chartBand:        { fontSize: 12, fontFamily: "Inter_500Medium" },
    chartLabels:      { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
    chartLabel:       { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    logCard:          { backgroundColor: colors.card, borderRadius: colors.radius, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
    logIconBg:        { width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    logTitle:         { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    logMeta:          { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1, textTransform: "capitalize" },
    logMovement:      { fontSize: 11, color: colors.primary, fontFamily: "Inter_500Medium", marginTop: 2 },
    logMetrics:       { flexDirection: "row", gap: 6, marginTop: 5, flexWrap: "wrap" },
    logMetricPill:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    logMetricText:    { fontSize: 10, fontFamily: "Inter_600SemiBold" },
    scoreCircle:      { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 2 },
    scoreText:        { fontSize: 15, fontFamily: "Inter_700Bold" },
    achCard:          { backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 },
    achCardUnlocked:  { borderColor: colors.primary + "55", backgroundColor: colors.primary + "08" },
    achCardLocked:    { opacity: 0.5 },
    achTitle:         { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    achDesc:          { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1 },
    achProgress:      { fontSize: 10, color: colors.primary, fontFamily: "Inter_600SemiBold", marginTop: 3 },
    emptyCard:        { backgroundColor: colors.card, borderRadius: colors.radius, padding: 32, borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: 12 },
    emptyText:        { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" },
    emptyBtn:         { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
    emptyBtnText:     { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  }), [colors, topPad]);

  if (loading) {
    return (
      <View style={[s.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const sportSubtitle = selectedSport
    ? `${sportEntries.length} ${capitalize(selectedSport)} session${sportEntries.length === 1 ? "" : "s"}`
    : allEntries.length > 0
      ? `${allEntries.length} session${allEntries.length === 1 ? "" : "s"} logged`
      : "Track your improvement over time";

  return (
    <View style={s.container}>
      {/* Joint history bottom sheet — opened from the Joint Angle Trends section */}
      {selectedJoint && filteredTrends?.joints[selectedJoint] && (
        <JointHistorySheet
          joint={selectedJoint}
          data={[...(filteredTrends.joints[selectedJoint] ?? [])].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          )}
          onClose={() => setSelectedJoint(null)}
        />
      )}

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.title}>Progress</Text>
          <Text style={s.subtitle}>{sportSubtitle}</Text>
        </View>

        {/* ── Error banner ── */}
        {error && !refreshing && (
          <View style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.warning + "14", borderRadius: colors.radius, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.warning + "44" }}>
            <Feather name="wifi-off" size={16} color={colors.warning} />
            <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 18 }}>
              Couldn't load your progress. Pull down to try again.
            </Text>
          </View>
        )}

        {/* ── Sport Selector ── */}
        {sportsList.length >= 2 && (
          <View style={{ marginBottom: 16 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8, flexDirection: "row" }}
            >
              {sportsList.map(({ sport, count }) => {
                const isActive = selectedSport === sport;
                const cfg = getSportConfig(sport);
                const accent = cfg.accentColor;
                const iconName = (SPORT_ICONS[sport] ?? SPORT_ICONS.default) as any;
                return (
                  <TouchableOpacity
                    key={sport}
                    onPress={() => setSelectedSport(sport)}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 7,
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 24,
                      backgroundColor: isActive ? accent + "20" : colors.card,
                      borderWidth: 1.5,
                      borderColor: isActive ? accent : colors.border,
                    }}
                  >
                    <Feather name={iconName} size={13} color={isActive ? accent : colors.mutedForeground} />
                    <Text style={{ fontSize: 13, fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular", color: isActive ? accent : colors.foreground, textTransform: "capitalize" }}>
                      {sport}
                    </Text>
                    <View style={{ backgroundColor: isActive ? accent + "30" : colors.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: isActive ? accent : colors.mutedForeground }}>
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Movement Type Sub-filter ── */}
        {availableMovementTypes.length >= 2 && (
          <View style={{ marginBottom: 14, paddingHorizontal: 20 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, flexDirection: "row" }}>
              <TouchableOpacity
                onPress={() => setSelectedMovementType(null)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16,
                  backgroundColor: !selectedMovementType ? accentColor + "20" : colors.card,
                  borderWidth: 1, borderColor: !selectedMovementType ? accentColor : colors.border,
                }}
              >
                <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: !selectedMovementType ? accentColor : colors.mutedForeground }}>
                  All Movements
                </Text>
              </TouchableOpacity>
              {availableMovementTypes.map((mt) => {
                const isActive = selectedMovementType === mt;
                return (
                  <TouchableOpacity
                    key={mt}
                    onPress={() => setSelectedMovementType(isActive ? null : mt)}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16,
                      backgroundColor: isActive ? accentColor + "20" : colors.card,
                      borderWidth: 1, borderColor: isActive ? accentColor : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: isActive ? accentColor : colors.mutedForeground }}>
                      {mt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── AI Summary Card ── */}
        {selectedSport && (aiSummary || aiSummaryLoading) && (
          <View style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: accentColor + "12", borderRadius: colors.radius, padding: 16, borderWidth: 1, borderColor: accentColor + "44" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: aiSummaryLoading ? 0 : 8 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: accentColor + "25", alignItems: "center", justifyContent: "center" }}>
                <Feather name="bar-chart-2" size={15} color={accentColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: accentColor, textTransform: "uppercase", letterSpacing: 0.6 }}>
                  AI Progress Insight
                </Text>
                {selectedMovementType && (
                  <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }}>
                    {selectedMovementType}
                  </Text>
                )}
              </View>
            </View>
            {aiSummaryLoading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <ActivityIndicator size="small" color={accentColor} />
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                  Generating insight…
                </Text>
              </View>
            ) : aiSummary ? (
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 20 }}>
                {aiSummary}
              </Text>
            ) : null}
          </View>
        )}

        {/* ── Streak & Weekly Pulse ── */}
        {stats && (
          <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 20 }}>
            {stats.streak > 0 && (
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#ff6b3514", borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: "#ff6b3533" }}>
                <Feather name="zap" size={20} color="#ff6b35" />
                <View>
                  <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#ff6b35" }}>{stats.streak}d</Text>
                  <Text style={{ fontSize: 10, color: "#ff6b3588", fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5 }}>Streak</Text>
                </View>
              </View>
            )}
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.border }}>
              <Feather name="calendar" size={18} color={colors.primary} />
              <View>
                <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground }}>{stats.thisWeekCount}</Text>
                <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  This week{stats.lastWeekCount > 0 ? ` · ${stats.lastWeekCount} last` : ""}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Drills Completed ── */}
        {drillsDoneCount > 0 && (
          <View style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.success + "44" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 42, height: 42, borderRadius: 11, backgroundColor: colors.success + "20", alignItems: "center", justifyContent: "center" }}>
                <Feather name="check-circle" size={20} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground }}>{drillsDoneCount}</Text>
                <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Drill{drillsDoneCount === 1 ? "" : "s"} completed · all sessions
                </Text>
              </View>
            </View>
            {(drillsCorrective !== null || drillsPerformance !== null) && (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ flex: 1, backgroundColor: colors.warning + "14", borderRadius: 8, padding: 10, alignItems: "center", borderWidth: 1, borderColor: colors.warning + "33" }}>
                  <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.warning }}>{drillsCorrective ?? 0}</Text>
                  <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: colors.warning, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>Corrective</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.primary + "14", borderRadius: 8, padding: 10, alignItems: "center", borderWidth: 1, borderColor: colors.primary + "33" }}>
                  <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.primary }}>{drillsPerformance ?? 0}</Text>
                  <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>Performance</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Personal Records (sport-scoped) ── */}
        {selectedSport && Object.keys(personalRecords).length > 0 && (
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Personal Records</Text>
              <Text style={s.sectionCount}>{capitalize(selectedSport)}</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {availableMetrics.filter((k) => k !== "overall").map((k) => {
                const rec = personalRecords[k];
                if (!rec || rec.value === 0) return null;
                const col = getScoreColor(rec.value, colors);
                return (
                  <View key={k} style={{ width: "31%", backgroundColor: colors.card, borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: col + "44", alignItems: "center" }}>
                    <Feather name="award" size={14} color={col} style={{ marginBottom: 4 }} />
                    <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: col }}>{Math.round(rec.value)}</Text>
                    <Text style={{ fontSize: 9, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2, textAlign: "center" }}>{k}</Text>
                    <Text style={{ fontSize: 8, color: col + "99", fontFamily: "Inter_400Regular", marginTop: 2 }}>{formatDateShort(rec.date)}</Text>
                    {rec.movementType && rec.movementType !== "General" && (
                      <Text style={{ fontSize: 8, color: accentColor, fontFamily: "Inter_500Medium", marginTop: 2, textAlign: "center" }} numberOfLines={1}>
                        {rec.movementType}
                      </Text>
                    )}
                  </View>
                );
              }).filter(Boolean)}
            </View>
          </View>
        )}

        {/* ── Summary Stats ── */}
        {filteredEntries.length > 0 && (
          <View style={s.summaryRow}>
            <View style={s.summaryCard}>
              <Text style={[s.summaryValue, { color: getScoreColor(currentScore, colors) }]}>
                {Math.round(currentScore)}
              </Text>
              <Text style={s.summaryLabel}>Latest</Text>
            </View>
            <View style={s.summaryCard}>
              <Text style={[s.summaryValue, { color: gained >= 0 ? colors.success : colors.destructive }]}>
                {gained >= 0 ? "+" : ""}{gained}
              </Text>
              <Text style={s.summaryLabel}>{period === "All" ? "All-time" : period} gain</Text>
            </View>
            <View style={s.summaryCard}>
              <Text style={[s.summaryValue, { color: gainPct >= 0 ? colors.primary : colors.destructive }]}>
                {gainPct >= 0 ? "+" : ""}{gainPct}%
              </Text>
              <Text style={s.summaryLabel}>Change</Text>
            </View>
          </View>
        )}

        {/* ── Most Improved Joint ── */}
        {mostImproved && (
          <Pressable
            onPress={() => {
              setSelectedJoint(mostImproved.joint);
              const y = trendsYRef.current;
              if (y > 0) {
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({ y, animated: true });
                }, 100);
              }
            }}
            style={({ pressed }) => ({
              marginHorizontal: 20,
              marginBottom: 20,
              backgroundColor: colors.success + "14",
              borderRadius: colors.radius,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderWidth: 1,
              borderColor: colors.success + "33",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Feather name="trending-up" size={18} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.success }}>
                {JOINT_DISPLAY[mostImproved.joint] ?? mostImproved.joint} +{Math.round(mostImproved.deltaDeg)}°
              </Text>
              <Text style={{ fontSize: 11, color: colors.success + "88", fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Most improved · tap to view trend
              </Text>
            </View>
            <Feather name="chevron-right" size={14} color={colors.success + "88"} />
          </Pressable>
        )}

        {/* ── Trend Chart ── */}
        {allEntries.length > 0 && (
          <View style={s.section}>
            {/* Period selector */}
            <View style={s.periodRow}>
              {(["1W", "1M", "3M", "All"] as Period[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    s.periodBtn,
                    period === p && { borderColor: lineColor, backgroundColor: lineColor + "18" },
                  ]}
                  onPress={() => setPeriod(p)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.periodBtnText, period === p && { color: lineColor }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Metric picker — sport-scoped */}
            {selectedSport && (
              <View style={{ marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather name={SPORT_ICONS[selectedSport] as any ?? "video"} size={12} color={accentColor} />
                <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: accentColor, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {capitalize(selectedSport)} metrics
                </Text>
              </View>
            )}
            <View style={s.metricPicker}>
              {availableMetrics.map((m) => {
                const isActive = activeMetric === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      s.metricChip,
                      isActive && { backgroundColor: lineColor + "22", borderColor: lineColor },
                    ]}
                    onPress={() => setActiveMetric(m)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.metricChipText, isActive && { color: lineColor }]}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.chartContainer}>
              {filteredEntries.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: "center", gap: 8 }}>
                  <Feather name="calendar" size={28} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                    No {selectedSport ? capitalize(selectedSport) + " " : ""}sessions in this period
                  </Text>
                  <TouchableOpacity onPress={() => setPeriod("All")} activeOpacity={0.8}>
                    <Text style={{ fontSize: 12, color: colors.primary, fontFamily: "Inter_500Medium" }}>Show all sessions</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={s.chartHeader}>
                    <Text style={[s.chartScore, { color: lineColor }]}>{Math.round(currentScore)}</Text>
                    <Text style={[s.chartBand, { color: lineColor }]}>{getScoreBand(currentScore)}</Text>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginLeft: "auto" as any }}>
                      {filteredEntries.length} session{filteredEntries.length === 1 ? "" : "s"}
                    </Text>
                  </View>

                  <Svg viewBox={`0 0 ${chartWidth} ${CHART_H}`} width={chartWidth} height={CHART_H}>
                    {[0, 25, 50, 75, 100].map((tick) => {
                      const scoreAtTick = minVal + (tick / 100) * range;
                      const y = toY(minVal + (tick / 100) * range);
                      return (
                        <React.Fragment key={tick}>
                          <Line x1={0} y1={y} x2={chartWidth} y2={y} stroke={colors.border} strokeWidth={1} />
                          <SvgText x={2} y={y - 3} fontSize={8} fill={colors.mutedForeground} fontFamily="Inter_400Regular">
                            {Math.round(scoreAtTick)}
                          </SvgText>
                        </React.Fragment>
                      );
                    })}

                    {values.length > 1 && (
                      <Path
                        d={[
                          `M 0 ${toY(values[0]!)}`,
                          ...values.slice(1).map((v, i) => `L ${(i + 1) * pointSpacing} ${toY(v)}`),
                          `L ${(values.length - 1) * pointSpacing} ${CHART_H}`,
                          `L 0 ${CHART_H}`,
                          "Z",
                        ].join(" ")}
                        fill={lineColor + "20"}
                      />
                    )}

                    {values.length > 1 && (
                      <Polyline
                        points={values.map((v, i) => `${i * pointSpacing},${toY(v)}`).join(" ")}
                        fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                      />
                    )}

                    {values.map((v, i) => (
                      <Circle
                        key={i}
                        cx={values.length === 1 ? chartWidth / 2 : i * pointSpacing}
                        cy={values.length === 1 ? CHART_H / 2 : toY(v)}
                        r={i === values.length - 1 ? 6 : 4}
                        fill={i === values.length - 1 ? lineColor : lineColor + "aa"}
                        stroke={i === values.length - 1 ? colors.card : "none"}
                        strokeWidth={i === values.length - 1 ? 2 : 0}
                      />
                    ))}
                  </Svg>

                  <View style={s.chartLabels}>
                    {filteredEntries.length === 1 ? (
                      <Text style={[s.chartLabel, { flex: 1, textAlign: "center" }]}>{formatDate(filteredEntries[0]!.date)}</Text>
                    ) : (
                      [
                        filteredEntries[0]!,
                        filteredEntries[Math.floor(filteredEntries.length / 2)]!,
                        filteredEntries[filteredEntries.length - 1]!,
                      ].map((e, i) => (
                        <Text key={i} style={s.chartLabel}>{formatDate(e.date)}</Text>
                      ))
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* ── Joint Angle Trends (sport-scoped) ── */}
        {filteredTrends && Object.keys(filteredTrends.joints).length > 0 && (
          <View style={s.section} onLayout={(e) => { trendsYRef.current = e.nativeEvent.layout.y; }}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Joint Angle Trends</Text>
              <Text style={s.sectionCount}>
                {Object.keys(filteredTrends.joints).length} joint{Object.keys(filteredTrends.joints).length === 1 ? "" : "s"}
                {selectedSport ? ` · ${capitalize(selectedSport)}` : ""}
              </Text>
            </View>

            {filteredTrends.improvements.filter((imp) => imp.improved).map((imp) => {
              const absD = Math.abs(imp.deltaDeg);
              const label = JOINT_DISPLAY[imp.joint] ?? imp.joint;
              return (
                <View key={imp.joint} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.success + "14", borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.success + "33", marginBottom: 10 }}>
                  <Feather name="trending-up" size={16} color={colors.success} />
                  <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.success, flex: 1 }} numberOfLines={2}>
                    Your {label.toLowerCase()} angle improved by {absD}° over {imp.sessions} session{imp.sessions === 1 ? "" : "s"}
                    {selectedSport ? ` of ${capitalize(selectedSport)}` : ""}
                  </Text>
                </View>
              );
            })}

            {Object.entries(filteredTrends.joints).map(([joint, history]) => {
              const label = JOINT_DISPLAY[joint] ?? joint;
              const last = history[history.length - 1]!;
              const first = history[0]!;
              const deltaDeg = Math.round(last.angle - first.angle);
              const latestRisk = last.risk;
              const riskColor = RISK_COLOR_MAP[latestRisk] ?? colors.mutedForeground;
              const riskLabel = RISK_LABEL_MAP[latestRisk] ?? "";
              const imp = filteredTrends.improvements.find((i) => i.joint === joint);

              return (
                <TouchableOpacity
                  key={joint}
                  activeOpacity={0.82}
                  onPress={() => setSelectedJoint(joint)}
                  style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, marginBottom: 10, overflow: "hidden" }}
                >
                  <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{label}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: riskColor }}>{Math.round(last.angle)}°</Text>
                        <View style={{ backgroundColor: riskColor + "22", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: riskColor }}>{riskLabel}</Text>
                        </View>
                      </View>
                      {history.length >= 2 && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                          <Feather
                            name={imp?.improved ? "arrow-up-right" : deltaDeg > 0 ? "arrow-up-right" : "arrow-down-right"}
                            size={12}
                            color={imp?.improved ? colors.success : colors.mutedForeground}
                          />
                          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: imp?.improved ? colors.success : colors.mutedForeground }}>
                            {deltaDeg >= 0 ? "+" : ""}{deltaDeg}° over {history.length} scan{history.length === 1 ? "" : "s"}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <JointSparkline data={history} color={riskColor} />
                      <Feather name="bar-chart-2" size={12} color={colors.mutedForeground} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Movement Quality Trends ── */}
        {filteredMovementHistory.length >= 1 && (
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Movement Quality</Text>
              <Text style={s.sectionCount}>
                {filteredMovementHistory.length} session{filteredMovementHistory.length === 1 ? "" : "s"}
                {selectedSport ? ` · ${capitalize(selectedSport)}` : ""}
              </Text>
            </View>
            {MOVEMENT_DIMENSIONS.map(({ key, label, color }) => {
              const scores = filteredMovementHistory.map((d) => d[key] as number);
              const latest = scores[scores.length - 1] ?? 0;
              const first = scores[0] ?? 0;
              const delta = Math.round(latest - first);
              const improved = delta > 0;
              return (
                <View
                  key={key}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: colors.radius,
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginBottom: 10,
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                      {label}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color }}>
                        {Math.round(latest)}
                      </Text>
                      <View style={{ backgroundColor: color + "22", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color }}>
                          {getScoreBand(latest)}
                        </Text>
                      </View>
                    </View>
                    {scores.length >= 2 && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                        <Feather
                          name={delta >= 0 ? "arrow-up-right" : "arrow-down-right"}
                          size={12}
                          color={improved ? colors.success : colors.mutedForeground}
                        />
                        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: improved ? colors.success : colors.mutedForeground }}>
                          {delta >= 0 ? "+" : ""}{delta} over {scores.length} scan{scores.length === 1 ? "" : "s"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <ScoreSparkline scores={scores} color={color} />
                </View>
              );
            })}
          </View>
        )}

        {/* ── Session Log (sport + movement type filtered) ── */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Session Log</Text>
            {filteredEntries.length > 0 && (
              <Text style={s.sectionCount}>{filteredEntries.length} session{filteredEntries.length === 1 ? "" : "s"}</Text>
            )}
          </View>

          {allEntries.length === 0 ? (
            <View style={s.emptyCard}>
              <Feather name="trending-up" size={32} color={colors.mutedForeground} />
              <Text style={s.emptyText}>Complete your first analysis to start tracking progress.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/(tabs)/analyze")} activeOpacity={0.85}>
                <Text style={s.emptyBtnText}>Analyze a Video</Text>
              </TouchableOpacity>
            </View>
          ) : filteredEntries.length === 0 ? (
            <View style={s.emptyCard}>
              <Feather name="calendar" size={32} color={colors.mutedForeground} />
              <Text style={s.emptyText}>
                No {selectedSport ? capitalize(selectedSport) + " " : ""}sessions
                {selectedMovementType ? ` for ${selectedMovementType}` : ""}
                {period !== "All" ? ` in this period` : ""}.
              </Text>
              {period !== "All" ? (
                <TouchableOpacity style={s.emptyBtn} onPress={() => setPeriod("All")} activeOpacity={0.85}>
                  <Text style={s.emptyBtnText}>Show All Time</Text>
                </TouchableOpacity>
              ) : selectedMovementType ? (
                <TouchableOpacity style={s.emptyBtn} onPress={() => setSelectedMovementType(null)} activeOpacity={0.85}>
                  <Text style={s.emptyBtnText}>Clear Movement Filter</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            sessionLog.map((entry) => {
              const score = entry.overallScore;
              const scoreColor = getScoreColor(score, colors);
              const iconName = (SPORT_ICONS[entry.sport] ?? SPORT_ICONS.default) as any;
              const subMetrics: { key: string; val?: number }[] = [
                { key: "T", val: entry.techniqueScore },
                { key: "P", val: entry.powerScore },
                { key: "B", val: entry.balanceScore },
                { key: "M", val: entry.mobilityScore },
              ].filter((m) => m.val != null);

              return (
                <TouchableOpacity
                  key={entry.id}
                  style={s.logCard}
                  onPress={() => router.push(`/analysis/${entry.id}` as any)}
                  activeOpacity={0.82}
                >
                  <View style={[s.logIconBg, { backgroundColor: scoreColor + "20" }]}>
                    <Feather name={iconName} size={20} color={scoreColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.logTitle} numberOfLines={1}>{entry.title}</Text>
                    <Text style={s.logMeta}>{entry.sport} · {formatDateLong(entry.date)}</Text>
                    {entry.movementType && (
                      <Text style={s.logMovement} numberOfLines={1}>{entry.movementType}</Text>
                    )}
                    {subMetrics.length > 0 && (
                      <View style={s.logMetrics}>
                        {subMetrics.map((m) => {
                          const c = getScoreColor(m.val!, colors);
                          return (
                            <View key={m.key} style={[s.logMetricPill, { backgroundColor: c + "18" }]}>
                              <Text style={[s.logMetricText, { color: c }]}>{m.key} {Math.round(m.val!)}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                  <View style={[s.scoreCircle, { borderColor: scoreColor }]}>
                    <Text style={[s.scoreText, { color: scoreColor }]}>{Math.round(score)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── Achievements (grouped by sport) ── */}
        {groupedAchievements.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { marginBottom: 16 }]}>Achievements</Text>
            {groupedAchievements.map((group) => (
              <View key={group.label} style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  {group.sport ? (
                    <Feather name={(SPORT_ICONS[group.sport] ?? SPORT_ICONS.default) as any} size={12} color={getSportConfig(group.sport).accentColor} />
                  ) : (
                    <Feather name="globe" size={12} color={colors.mutedForeground} />
                  )}
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: group.sport ? getSportConfig(group.sport).accentColor : colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    {group.label}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border, marginLeft: 4 }} />
                  <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                    {group.items.filter((a) => a.unlocked).length}/{group.items.length}
                  </Text>
                </View>
                {group.items.map((a) => (
                  <View
                    key={a.id}
                    style={[s.achCard, a.unlocked ? s.achCardUnlocked : s.achCardLocked]}
                  >
                    <Feather name={a.icon as any} size={22} color={a.unlocked ? colors.primary : colors.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.achTitle}>{a.title}</Text>
                      <Text style={s.achDesc}>{a.description}</Text>
                      {a.unlocked ? (
                        <Text style={[s.achProgress, { color: colors.success }]}>✓ Unlocked</Text>
                      ) : (
                        <Text style={s.achProgress}>{a.progress}/{a.total}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
