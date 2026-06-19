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
import { progress as progressApi, achievements as achievementsApi, profile as profileApi, jointTrends as jointTrendsApi, type ProgressRecord, type AchievementRecord, type ProfileStats, type JointTrendsResponse, type JointDataPoint, type JointImprovement } from "@/lib/api";

const JOINT_DISPLAY: Record<string, string> = {
  leftKnee: "Left Knee",
  rightKnee: "Right Knee",
  leftHip: "Left Hip",
  rightHip: "Right Hip",
  leftElbow: "Left Elbow",
  rightElbow: "Right Elbow",
};

const RISK_COLOR_MAP = ["#22c55e", "#f59e0b", "#ef4444"] as const;
const RISK_LABEL_MAP = ["Safe", "Caution", "High Risk"] as const;

const JOINT_SPARKLINE_W = 64;
const JOINT_SPARKLINE_H = 28;
const JOINT_CHART_H = 180;

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

const FULL_CHART_PADDING_LEFT = 36;
const FULL_CHART_PADDING_RIGHT = 8;
const FULL_CHART_PADDING_TOP = 8;
const FULL_CHART_PADDING_BOTTOM = 32;

const TOOLTIP_W = 108;
const TOOLTIP_H = 64;

function JointFullChart({
  data,
  width,
  colors,
}: {
  data: JointDataPoint[];
  width: number;
  colors: ReturnType<typeof useColors>;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  function handleDotPress(i: number) {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    if (selectedIdx === i) {
      setSelectedIdx(null);
      return;
    }
    setSelectedIdx(i);
    dismissTimer.current = setTimeout(() => setSelectedIdx(null), 3000);
  }

  const chartW = width - FULL_CHART_PADDING_LEFT - FULL_CHART_PADDING_RIGHT;
  const chartH = JOINT_CHART_H - FULL_CHART_PADDING_TOP - FULL_CHART_PADDING_BOTTOM;

  if (data.length === 0) return null;

  const angles = data.map((d) => d.angle);
  const minAngle = Math.max(0, Math.min(...angles) - 5);
  const maxAngle = Math.max(...angles) + 5;
  const range = maxAngle - minAngle || 1;

  function toX(i: number) {
    if (data.length === 1) return FULL_CHART_PADDING_LEFT + chartW / 2;
    return FULL_CHART_PADDING_LEFT + (i / (data.length - 1)) * chartW;
  }

  function toY(angle: number) {
    return FULL_CHART_PADDING_TOP + chartH - ((angle - minAngle) / range) * chartH;
  }

  const yTicks = [minAngle, minAngle + range * 0.25, minAngle + range * 0.5, minAngle + range * 0.75, maxAngle];

  const polyPts = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.angle).toFixed(1)}`).join(" ");

  const areaPath = data.length > 1
    ? [
        `M ${toX(0).toFixed(1)} ${toY(data[0]!.angle).toFixed(1)}`,
        ...data.slice(1).map((d, i) => `L ${toX(i + 1).toFixed(1)} ${toY(d.angle).toFixed(1)}`),
        `L ${toX(data.length - 1).toFixed(1)} ${(FULL_CHART_PADDING_TOP + chartH).toFixed(1)}`,
        `L ${FULL_CHART_PADDING_LEFT.toFixed(1)} ${(FULL_CHART_PADDING_TOP + chartH).toFixed(1)}`,
        "Z",
      ].join(" ")
    : null;

  const xLabels: { i: number; text: string }[] = [];
  if (data.length === 1) {
    xLabels.push({ i: 0, text: formatDate(data[0]!.date) });
  } else if (data.length === 2) {
    xLabels.push({ i: 0, text: formatDate(data[0]!.date) });
    xLabels.push({ i: 1, text: formatDate(data[1]!.date) });
  } else {
    xLabels.push({ i: 0, text: formatDate(data[0]!.date) });
    xLabels.push({ i: Math.floor((data.length - 1) / 2), text: formatDate(data[Math.floor((data.length - 1) / 2)]!.date) });
    xLabels.push({ i: data.length - 1, text: formatDate(data[data.length - 1]!.date) });
  }

  const totalH = JOINT_CHART_H;

  const selectedPoint = selectedIdx != null ? (data[selectedIdx] ?? null) : null;
  const dotCx = selectedIdx != null ? toX(selectedIdx) : 0;
  const dotCy = selectedPoint != null ? toY(selectedPoint.angle) : 0;
  const tooltipAbove = dotCy - TOOLTIP_H - 10;
  const tooltipTop = tooltipAbove >= 0 ? tooltipAbove : dotCy + 14;
  let tooltipLeft = dotCx - TOOLTIP_W / 2;
  if (tooltipLeft < 0) tooltipLeft = 0;
  if (tooltipLeft + TOOLTIP_W > width) tooltipLeft = width - TOOLTIP_W;

  return (
    <View style={{ position: "relative" }}>
      <Svg width={width} height={totalH} style={{ overflow: "visible" }}>
        {yTicks.map((tick, ti) => {
          const y = toY(tick);
          return (
            <React.Fragment key={ti}>
              <Line
                x1={FULL_CHART_PADDING_LEFT}
                y1={y}
                x2={FULL_CHART_PADDING_LEFT + chartW}
                y2={y}
                stroke={colors.border}
                strokeWidth={1}
              />
              <SvgText
                x={FULL_CHART_PADDING_LEFT - 4}
                y={y + 3}
                fontSize={8}
                fill={colors.mutedForeground}
                fontFamily="Inter_400Regular"
                textAnchor="end"
              >
                {Math.round(tick)}°
              </SvgText>
            </React.Fragment>
          );
        })}

        {areaPath && (
          <Path
            d={areaPath}
            fill={colors.primary + "18"}
          />
        )}

        {data.length > 1 && (
          <Polyline
            points={polyPts}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {data.map((d, i) => {
          const dotColor = RISK_COLOR_MAP[d.risk] ?? colors.primary;
          const cx = toX(i);
          const cy = toY(d.angle);
          const isLast = i === data.length - 1;
          const isSelected = selectedIdx === i;
          return (
            <React.Fragment key={i}>
              <Circle
                cx={cx}
                cy={cy}
                r={isSelected ? 7 : isLast ? 6 : 4}
                fill={dotColor}
                stroke={isSelected ? colors.card : isLast ? colors.card : "none"}
                strokeWidth={isSelected || isLast ? 2 : 0}
              />
              <Circle
                cx={cx}
                cy={cy}
                r={18}
                fill="transparent"
                onPress={() => handleDotPress(i)}
              />
            </React.Fragment>
          );
        })}

        {xLabels.map(({ i, text }) => (
          <SvgText
            key={i}
            x={toX(i)}
            y={FULL_CHART_PADDING_TOP + chartH + 18}
            fontSize={8}
            fill={colors.mutedForeground}
            fontFamily="Inter_400Regular"
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
          >
            {text}
          </SvgText>
        ))}
      </Svg>

      {selectedPoint != null && (
        <Pressable
          onPress={() => setSelectedIdx(null)}
          style={{
            position: "absolute",
            left: tooltipLeft,
            top: tooltipTop,
            width: TOOLTIP_W,
            backgroundColor: colors.card,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: (RISK_COLOR_MAP[selectedPoint.risk] ?? colors.primary) + "88",
            padding: 8,
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.14,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontFamily: "Inter_700Bold",
              color: RISK_COLOR_MAP[selectedPoint.risk] ?? colors.primary,
            }}
          >
            {selectedPoint.angle.toFixed(1)}°
          </Text>
          <Text
            style={{
              fontSize: 10,
              fontFamily: "Inter_400Regular",
              color: colors.mutedForeground,
              marginTop: 2,
            }}
          >
            {formatDate(selectedPoint.date)}
          </Text>
          <View
            style={{
              marginTop: 5,
              backgroundColor: (RISK_COLOR_MAP[selectedPoint.risk] ?? colors.primary) + "22",
              borderRadius: 5,
              paddingHorizontal: 7,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontFamily: "Inter_600SemiBold",
                color: RISK_COLOR_MAP[selectedPoint.risk] ?? colors.primary,
              }}
            >
              {RISK_LABEL_MAP[selectedPoint.risk] ?? ""}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const METRICS = ["overall", "technique", "power", "balance", "consistency", "mobility", "speed"] as const;
type MetricKey = typeof METRICS[number];
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

const PB_METRICS: MetricKey[] = ["technique", "power", "balance", "consistency", "mobility", "speed"];

const SPORT_ICONS: Record<string, string> = {
  running: "activity", weightlifting: "trending-up", basketball: "circle",
  golf: "flag", tennis: "circle", swimming: "droplet", crossfit: "zap",
  boxing: "shield", soccer: "circle", gymnastics: "star", cycling: "navigation",
  fencing: "zap", rowing: "anchor", volleyball: "circle", baseball: "circle",
  wrestling: "shield", rugby: "circle", hockey: "circle", yoga: "heart",
  other: "video", default: "video",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_H = 160;

function getMetricColor(key: MetricKey, primary: string, success: string, warning: string) {
  if (key === "power" || key === "speed") return success;
  if (key === "mobility") return warning;
  return primary;
}

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

function periodCutoff(period: Period): Date | null {
  if (period === "All") return null;
  const d = new Date();
  if (period === "1W") d.setDate(d.getDate() - 7);
  else if (period === "1M") d.setMonth(d.getMonth() - 1);
  else if (period === "3M") d.setMonth(d.getMonth() - 3);
  return d;
}

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scrollTo } = useLocalSearchParams<{ scrollTo?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const trendsYRef    = useRef<number>(0);
  const [activeMetric, setActiveMetric]   = useState<MetricKey>("overall");
  const [period, setPeriod]               = useState<Period>("All");
  const [entries, setEntries]             = useState<ProgressRecord[]>([]);
  const [achievements, setAchievements]   = useState<AchievementRecord[]>([]);
  const [stats, setStats]                 = useState<ProfileStats | null>(null);
  const [trends, setTrends]               = useState<JointTrendsResponse | null>(null);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState(false);
  const [selectedJoint, setSelectedJoint] = useState<string | null>(null);
  const [drillsDoneCount, setDrillsDoneCount] = useState(0);

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;
  const chartWidth = SCREEN_WIDTH - 56;
  const lineColor  = getMetricColor(activeMetric, colors.primary, colors.success, colors.warning);

  const loadDrillsDone = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const drillKeys = keys.filter((k) => k.startsWith("drill_done_"));
      if (drillKeys.length === 0) {
        setDrillsDoneCount(0);
        return;
      }
      const pairs = await AsyncStorage.multiGet(drillKeys);
      let total = 0;
      for (const [, val] of pairs) {
        if (val) {
          try {
            const ids = JSON.parse(val) as string[];
            total += ids.length;
          } catch {}
        }
      }
      setDrillsDoneCount(total);
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    setError(false);
    try {
      const [{ entries: e }, { achievements: a }, st, tr] = await Promise.all([
        progressApi.list(),
        achievementsApi.list(),
        profileApi.stats().catch(() => null),
        jointTrendsApi.get().catch(() => null),
      ]);
      setEntries(e);
      setAchievements(a);
      if (st) setStats(st);
      if (tr) setTrends(tr);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    await loadDrillsDone();
  }, [loadDrillsDone]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // When deep-linked from an improvement notification, scroll to the joint trends
  // section once data has finished loading.
  useEffect(() => {
    if (scrollTo !== "trends" || loading) return;
    if (!trends || Object.keys(trends.joints).length === 0) return;
    const y = trendsYRef.current;
    if (y > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y, animated: true });
      }, 150);
    }
  }, [scrollTo, loading, trends]);

  const filteredEntries = useMemo(() => {
    const cutoff = periodCutoff(period);
    if (!cutoff) return entries;
    return entries.filter(e => new Date(e.date) >= cutoff);
  }, [entries, period]);

  const sportStats = useMemo(() => {
    const map: Record<string, { count: number; totalScore: number }> = {};
    for (const e of entries) {
      const sp = (e.sport || "other").toLowerCase();
      if (!map[sp]) map[sp] = { count: 0, totalScore: 0 };
      map[sp]!.count++;
      map[sp]!.totalScore += e.overallScore;
    }
    return Object.entries(map)
      .map(([sport, { count, totalScore }]) => ({
        sport,
        count,
        avgScore: Math.round(totalScore / count),
      }))
      .sort((a, b) => b.count - a.count);
  }, [entries]);

  const maxSportCount = sportStats[0]?.count ?? 1;

  const values = filteredEntries.map(
    (p) => (p[METRIC_KEY_MAP[activeMetric]] as number | undefined) ?? p.overallScore
  );
  const minVal = values.length ? Math.max(0, Math.min(...values) - 8) : 0;
  const maxVal = values.length ? Math.min(100, Math.max(...values) + 8) : 100;
  const range  = maxVal - minVal || 1;

  function toY(val: number) {
    return CHART_H - ((val - minVal) / range) * CHART_H;
  }

  const pointSpacing = values.length > 1 ? chartWidth / (values.length - 1) : 0;
  const personalBests = stats?.personalBests ?? {};
  const hasPBs = PB_METRICS.some(k => (personalBests[k] ?? 0) > 0);

  const currentScore = values[values.length - 1] ?? 0;
  const firstScore   = values[0] ?? 0;
  const gained       = Math.round(currentScore - firstScore);
  const gainPct      = firstScore > 0 ? Math.round((gained / firstScore) * 100) : 0;

  const sessionLog = [...filteredEntries].reverse();

  const mostImproved = (() => {
    if (!trends?.improvements?.length) return null;
    const positives = trends.improvements.filter((i) => i.improved && i.deltaDeg > 0);
    if (!positives.length) return null;
    return positives.reduce((best, cur) => (cur.deltaDeg > best.deltaDeg ? cur : best));
  })();

  const s = StyleSheet.create({
    container:        { flex: 1, backgroundColor: colors.background },
    header:           { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 16 },
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
    periodBtnActive:  { borderColor: lineColor },
    periodBtnText:    { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    periodBtnTextActive: { color: lineColor },
    metricPicker:     { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
    metricChip:       { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    metricChipActive: { backgroundColor: lineColor + "22", borderColor: lineColor },
    metricChipText:   { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textTransform: "capitalize" },
    metricChipTextActive: { color: lineColor },
    chartContainer:   { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16, overflow: "hidden" },
    chartHeader:      { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 12 },
    chartScore:       { fontSize: 28, fontFamily: "Inter_700Bold" },
    chartBand:        { fontSize: 12, fontFamily: "Inter_500Medium" },
    chartLabels:      { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
    chartLabel:       { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    pbGrid:           { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    pbCell:           { width: "31%", backgroundColor: colors.card, borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    pbScore:          { fontSize: 24, fontFamily: "Inter_700Bold" },
    pbLabel:          { fontSize: 9, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
    pbBadge:          { fontSize: 8, fontFamily: "Inter_700Bold", marginTop: 3 },
    sportBarRow:      { marginBottom: 14 },
    sportBarLabel:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
    sportBarBg:       { height: 6, backgroundColor: colors.border, borderRadius: 3 },
    sportBarFill:     { height: 6, borderRadius: 3 },
    logCard:          { backgroundColor: colors.card, borderRadius: colors.radius, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
    logIconBg:        { width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    logTitle:         { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    logMeta:          { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1, textTransform: "capitalize" },
    logMetrics:       { flexDirection: "row", gap: 6, marginTop: 5, flexWrap: "wrap" },
    logMetricPill:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    logMetricText:    { fontSize: 10, fontFamily: "Inter_600SemiBold" },
    scoreCircle:      { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 2 },
    scoreText:        { fontSize: 15, fontFamily: "Inter_700Bold" },
    achGrid:          { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    achCard:          { width: "47%", backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 },
    achCardUnlocked:  { borderColor: colors.primary + "55", backgroundColor: colors.primary + "08" },
    achCardLocked:    { opacity: 0.5 },
    achTitle:         { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    achDesc:          { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1 },
    achProgress:      { fontSize: 10, color: colors.primary, fontFamily: "Inter_600SemiBold", marginTop: 3 },
    emptyCard:        { backgroundColor: colors.card, borderRadius: colors.radius, padding: 32, borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: 12 },
    emptyText:        { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" },
    emptyBtn:         { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
    emptyBtnText:     { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  });

  if (loading) {
    return (
      <View style={[s.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
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
        <View style={s.header}>
          <Text style={s.title}>Progress</Text>
          <Text style={s.subtitle}>
            {entries.length > 0 ? `${entries.length} session${entries.length === 1 ? "" : "s"} logged` : "Track your improvement over time"}
          </Text>
        </View>

        {/* ── Error banner ── */}
        {error && !refreshing && (
          <View style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: colors.warning + "14", borderRadius: colors.radius, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.warning + "44" }}>
            <Feather name="wifi-off" size={16} color={colors.warning} />
            <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 18 }}>
              Couldn't load your progress. Pull down to try again.
            </Text>
          </View>
        )}

        {/* ── Streak & weekly pulse ── */}
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
            {(stats.personalBests.overall ?? 0) > 0 && (
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.success + "14", borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.success + "33" }}>
                <Feather name="award" size={18} color={colors.success} />
                <View>
                  <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.success }}>{Math.round(stats.personalBests.overall)}</Text>
                  <Text style={{ fontSize: 10, color: colors.success + "88", fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5 }}>Best score</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Drills completed ── */}
        {drillsDoneCount > 0 && (
          <View style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: colors.success + "44" }}>
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
        )}

        {/* ── Personal Records ── */}
        {hasPBs && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { marginBottom: 14 }]}>Personal Records</Text>
            <View style={s.pbGrid}>
              {PB_METRICS.map((k) => {
                const pb = Math.round(personalBests[k] ?? 0);
                if (pb === 0) return null;
                const col = getScoreColor(pb, colors);
                return (
                  <View key={k} style={[s.pbCell, { borderColor: col + "44" }]}>
                    <Text style={[s.pbScore, { color: col }]}>{pb}</Text>
                    <Text style={s.pbLabel}>{k}</Text>
                    <Text style={[s.pbBadge, { color: col }]}>PB</Text>
                  </View>
                );
              }).filter(Boolean)}
            </View>
          </View>
        )}

        {/* ── Summary cards ── */}
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

        {/* ── Most improved joint ── */}
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

        {/* ── Trend chart ── */}
        {entries.length > 0 && (
          <View style={s.section}>
            {/* Period selector */}
            <View style={s.periodRow}>
              {(["1W", "1M", "3M", "All"] as Period[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[s.periodBtn, period === p && s.periodBtnActive, period === p && { backgroundColor: lineColor + "18" }]}
                  onPress={() => setPeriod(p)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.periodBtnText, period === p && s.periodBtnTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.metricPicker}>
              {METRICS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[s.metricChip, activeMetric === m && s.metricChipActive]}
                  onPress={() => setActiveMetric(m)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.metricChipText, activeMetric === m && s.metricChipTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.chartContainer}>
              {filteredEntries.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: "center", gap: 8 }}>
                  <Feather name="calendar" size={28} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                    No sessions in this period
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
                        fill="none"
                        stroke={lineColor}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
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

        {/* ── Joint Angle Trends ── */}
        {trends && Object.keys(trends.joints).length > 0 && (
          <View
            style={s.section}
            onLayout={(e) => { trendsYRef.current = e.nativeEvent.layout.y; }}
          >
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Joint Angle Trends</Text>
              <Text style={s.sectionCount}>{Object.keys(trends.joints).length} joint{Object.keys(trends.joints).length === 1 ? "" : "s"}</Text>
            </View>

            {/* Improvement callouts */}
            {trends.improvements.filter((imp) => imp.improved).map((imp) => {
              const absD = Math.abs(imp.deltaDeg);
              const label = JOINT_DISPLAY[imp.joint] ?? imp.joint;
              return (
                <View
                  key={imp.joint}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.success + "14", borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.success + "33", marginBottom: 10 }}
                >
                  <Feather name="trending-up" size={16} color={colors.success} />
                  <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.success, flex: 1 }} numberOfLines={2}>
                    Your {label.toLowerCase()} angle improved by {absD}° over {imp.sessions} session{imp.sessions === 1 ? "" : "s"}
                  </Text>
                </View>
              );
            })}

            {/* Per-joint rows */}
            {Object.entries(trends.joints).map(([joint, history]) => {
              const label = JOINT_DISPLAY[joint] ?? joint;
              const last = history[history.length - 1]!;
              const first = history[0]!;
              const deltaDeg = Math.round(last.angle - first.angle);
              const latestRisk = last.risk;
              const riskColor = RISK_COLOR_MAP[latestRisk] ?? colors.mutedForeground;
              const riskLabel = RISK_LABEL_MAP[latestRisk] ?? "";
              const imp = trends.improvements.find((i) => i.joint === joint);
              const isExpanded = selectedJoint === joint;
              const fullChartWidth = SCREEN_WIDTH - 40 - 28;

              return (
                <TouchableOpacity
                  key={joint}
                  activeOpacity={0.82}
                  onPress={() => setSelectedJoint(isExpanded ? null : joint)}
                  style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: isExpanded ? colors.primary + "66" : colors.border, marginBottom: 10, overflow: "hidden" }}
                >
                  {/* Summary row */}
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
                    {isExpanded ? (
                      <Feather name="chevron-up" size={16} color={colors.mutedForeground} />
                    ) : (
                      <View style={{ alignItems: "flex-end", gap: 6 }}>
                        <JointSparkline data={history} color={riskColor} />
                        <Feather name="chevron-down" size={12} color={colors.mutedForeground} />
                      </View>
                    )}
                  </View>

                  {/* Expanded full chart */}
                  {isExpanded && (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 8 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                          {history.length} scan{history.length === 1 ? "" : "s"} · angle history
                        </Text>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          {([0, 1, 2] as const).map((risk) => (
                            <View key={risk} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: RISK_COLOR_MAP[risk] }} />
                              <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{RISK_LABEL_MAP[risk]}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <JointFullChart data={history} width={fullChartWidth} colors={colors} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Sport Breakdown ── */}
        {sportStats.length >= 2 && (
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>By Sport</Text>
              <Text style={s.sectionCount}>{sportStats.length} sport{sportStats.length === 1 ? "" : "s"}</Text>
            </View>
            {sportStats.map(({ sport, count, avgScore }) => {
              const barColor = getScoreColor(avgScore, colors);
              const barPct = (count / maxSportCount) * 100;
              return (
                <View key={sport} style={s.sportBarRow}>
                  <View style={s.sportBarLabel}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Feather name={(SPORT_ICONS[sport] ?? SPORT_ICONS.default) as any} size={13} color={colors.mutedForeground} />
                      <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground, textTransform: "capitalize" }}>
                        {sport}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                      {count} session{count === 1 ? "" : "s"} · avg {avgScore}
                    </Text>
                  </View>
                  <View style={s.sportBarBg}>
                    <View style={[s.sportBarFill, { width: `${barPct}%` as any, backgroundColor: barColor }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Session Log ── */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Session Log</Text>
            {filteredEntries.length > 0 && (
              <Text style={s.sectionCount}>{filteredEntries.length} session{filteredEntries.length === 1 ? "" : "s"}</Text>
            )}
          </View>

          {entries.length === 0 ? (
            <View style={s.emptyCard}>
              <Feather name="trending-up" size={32} color={colors.mutedForeground} />
              <Text style={s.emptyText}>
                Complete your first analysis to start tracking progress.
              </Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/(tabs)/analyze")} activeOpacity={0.85}>
                <Text style={s.emptyBtnText}>Analyze a Video</Text>
              </TouchableOpacity>
            </View>
          ) : filteredEntries.length === 0 ? (
            <View style={s.emptyCard}>
              <Feather name="calendar" size={32} color={colors.mutedForeground} />
              <Text style={s.emptyText}>No sessions in this time period.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setPeriod("All")} activeOpacity={0.85}>
                <Text style={s.emptyBtnText}>Show All Sessions</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sessionLog.map((entry) => {
              const score = entry.overallScore;
              const scoreColor = getScoreColor(score, colors);
              const iconName = (SPORT_ICONS[entry.sport] ?? SPORT_ICONS.default) as any;
              const isPB = Boolean(
                personalBests.overall &&
                Math.round(score) >= Math.round(personalBests.overall)
              );
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
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    {isPB && (
                      <View style={{ backgroundColor: "#f59e0b22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "#f59e0b" }}>
                        <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#f59e0b" }}>🏆 PB</Text>
                      </View>
                    )}
                    <View style={[s.scoreCircle, { borderColor: scoreColor }]}>
                      <Text style={[s.scoreText, { color: scoreColor }]}>{Math.round(score)}</Text>
                    </View>
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── Achievements ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { marginBottom: 14 }]}>Achievements</Text>
          <View style={s.achGrid}>
            {achievements.map((a) => (
              <View
                key={a.id}
                style={[s.achCard, a.unlocked ? s.achCardUnlocked : s.achCardLocked]}
              >
                <Feather
                  name={a.icon as any}
                  size={24}
                  color={a.unlocked ? colors.primary : colors.mutedForeground}
                />
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
        </View>
      </ScrollView>
    </View>
  );
}
