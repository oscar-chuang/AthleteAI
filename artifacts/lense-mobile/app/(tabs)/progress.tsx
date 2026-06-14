import React, { useState, useCallback } from "react";
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
} from "react-native";
import Svg, { Line, Path, Polyline, Circle, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { progress as progressApi, achievements as achievementsApi, profile as profileApi, type ProgressRecord, type AchievementRecord, type ProfileStats } from "@/lib/api";

const METRICS = ["overall", "technique", "power", "balance", "consistency", "mobility", "speed"] as const;
type MetricKey = typeof METRICS[number];

const METRIC_KEY_MAP: Record<MetricKey, keyof ProgressRecord> = {
  overall:      "overallScore",
  technique:    "techniqueScore",
  power:        "powerScore",
  balance:      "balanceScore",
  consistency:  "consistencyScore",
  mobility:     "mobilityScore",
  speed:        "speedScore",
};

const SPORT_ICONS: Record<string, string> = {
  running: "activity", weightlifting: "trending-up", basketball: "circle",
  golf: "flag", tennis: "circle", swimming: "droplet", crossfit: "zap",
  boxing: "shield", soccer: "circle", gymnastics: "star", other: "video",
  default: "video",
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

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeMetric, setActiveMetric] = useState<MetricKey>("overall");
  const [entries, setEntries] = useState<ProgressRecord[]>([]);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;
  const chartWidth = SCREEN_WIDTH - 56;
  const lineColor = getMetricColor(activeMetric, colors.primary, colors.success, colors.warning);

  const loadData = useCallback(async () => {
    try {
      const [{ entries: e }, { achievements: a }, st] = await Promise.all([
        progressApi.list(),
        achievementsApi.list(),
        profileApi.stats().catch(() => null),
      ]);
      setEntries(e);
      setAchievements(a);
      if (st) setStats(st);
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh every time the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Chart data — chronological (oldest first)
  const values = entries.map((p) => (p[METRIC_KEY_MAP[activeMetric]] as number | undefined) ?? p.overallScore);
  const minVal = values.length ? Math.max(0, Math.min(...values) - 8) : 0;
  const maxVal = values.length ? Math.min(100, Math.max(...values) + 8) : 100;
  const range = maxVal - minVal || 1;

  function toY(val: number) {
    return CHART_H - ((val - minVal) / range) * CHART_H;
  }

  const pointSpacing = values.length > 1 ? chartWidth / (values.length - 1) : 0;

  const personalBests = stats?.personalBests ?? {};

  // Summary stats
  const currentScore = values[values.length - 1] ?? 0;
  const firstScore = values[0] ?? 0;
  const gained = Math.round(currentScore - firstScore);
  const gainPct = firstScore > 0 ? Math.round((gained / firstScore) * 100) : 0;

  // Session log — most recent first
  const sessionLog = [...entries].reverse();

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 16 },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.foreground },
    subtitle: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 4 },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    sectionCount: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    summaryRow: { flexDirection: "row", gap: 10, marginBottom: 24, paddingHorizontal: 20 },
    summaryCard: { flex: 1, backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    summaryValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    summaryLabel: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
    metricPicker: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
    metricChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    metricChipActive: { backgroundColor: lineColor + "22", borderColor: lineColor },
    metricChipText: { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textTransform: "capitalize" },
    metricChipTextActive: { color: lineColor },
    chartContainer: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16, overflow: "hidden" },
    chartHeader: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 12 },
    chartScore: { fontSize: 28, fontFamily: "Inter_700Bold" },
    chartBand: { fontSize: 12, fontFamily: "Inter_500Medium" },
    chartLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
    chartLabel: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    // Session log
    logCard: {
      backgroundColor: colors.card, borderRadius: colors.radius,
      marginBottom: 10, borderWidth: 1, borderColor: colors.border,
      flexDirection: "row", alignItems: "center", padding: 14, gap: 12,
    },
    logIconBg: { width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    logTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    logMeta: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1, textTransform: "capitalize" },
    logMetrics: { flexDirection: "row", gap: 6, marginTop: 5, flexWrap: "wrap" },
    logMetricPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    logMetricText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
    scoreCircle: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 2 },
    scoreText: { fontSize: 15, fontFamily: "Inter_700Bold" },
    // Achievements
    achGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    achCard: {
      width: "47%", backgroundColor: colors.card, borderRadius: colors.radius,
      padding: 14, borderWidth: 1, borderColor: colors.border,
      flexDirection: "row", alignItems: "center", gap: 10,
    },
    achCardUnlocked: { borderColor: colors.primary + "55", backgroundColor: colors.primary + "08" },
    achCardLocked: { opacity: 0.5 },
    achTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    achDesc: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1 },
    achProgress: { fontSize: 10, color: colors.primary, fontFamily: "Inter_600SemiBold", marginTop: 3 },
    // Empty
    emptyCard: { backgroundColor: colors.card, borderRadius: colors.radius, padding: 32, borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: 12 },
    emptyText: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" },
    emptyBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
    emptyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
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
            {stats.personalBests.overall > 0 && (
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

        {/* ── Summary cards ── */}
        {entries.length > 0 && (
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
              <Text style={s.summaryLabel}>Points</Text>
            </View>
            <View style={s.summaryCard}>
              <Text style={[s.summaryValue, { color: gainPct >= 0 ? colors.primary : colors.destructive }]}>
                {gainPct >= 0 ? "+" : ""}{gainPct}%
              </Text>
              <Text style={s.summaryLabel}>Change</Text>
            </View>
          </View>
        )}

        {/* ── Trend chart ── */}
        {entries.length > 0 && (
          <View style={s.section}>
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
              <View style={s.chartHeader}>
                <Text style={[s.chartScore, { color: lineColor }]}>{Math.round(currentScore)}</Text>
                <Text style={[s.chartBand, { color: lineColor }]}>{getScoreBand(currentScore)}</Text>
              </View>

              <Svg viewBox={`0 0 ${chartWidth} ${CHART_H}`} width={chartWidth} height={CHART_H}>
                {/* Horizontal grid lines with score labels */}
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

                {/* Area fill (only with 2+ points) */}
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

                {/* Line (only with 2+ points) */}
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

                {/* Dots — always drawn */}
                {values.map((v, i) => (
                  <Circle
                    key={i}
                    cx={values.length === 1 ? chartWidth / 2 : i * pointSpacing}
                    cy={values.length === 1 ? CHART_H / 2 : toY(v)}
                    r={values.length === 1 ? 7 : 4}
                    fill={lineColor}
                  />
                ))}
              </Svg>

              {/* X-axis date labels */}
              <View style={s.chartLabels}>
                {entries.length === 1 ? (
                  <Text style={[s.chartLabel, { flex: 1, textAlign: "center" }]}>{formatDate(entries[0]!.date)}</Text>
                ) : (
                  [entries[0]!, entries[Math.floor(entries.length / 2)]!, entries[entries.length - 1]!].map((e, i) => (
                    <Text key={i} style={s.chartLabel}>{formatDate(e.date)}</Text>
                  ))
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── Session Log ── */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Session Log</Text>
            {entries.length > 0 && (
              <Text style={s.sectionCount}>{entries.length} sessions</Text>
            )}
          </View>

          {entries.length === 0 ? (
            <View style={s.emptyCard}>
              <Feather name="trending-up" size={32} color={colors.mutedForeground} />
              <Text style={s.emptyText}>
                Complete your first analysis to start tracking progress.
              </Text>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => router.push("/(tabs)/analyze")}
                activeOpacity={0.85}
              >
                <Text style={s.emptyBtnText}>Analyze a Video</Text>
              </TouchableOpacity>
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
                    {subMetrics.length > 0 && (
                      <View style={s.logMetrics}>
                        {subMetrics.map((m) => {
                          const c = getScoreColor(m.val!, colors);
                          return (
                            <View key={m.key} style={[s.logMetricPill, { backgroundColor: c + "18" }]}>
                              <Text style={[s.logMetricText, { color: c }]}>
                                {m.key} {Math.round(m.val!)}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  <View style={{ alignItems: "flex-end", gap: 4 }}>
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
