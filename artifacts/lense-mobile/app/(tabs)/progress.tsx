import React, { useState, useEffect, useCallback } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { progress as progressApi, achievements as achievementsApi, type ProgressRecord, type AchievementRecord } from "@/lib/api";

const METRICS = ["overall", "technique", "power", "balance", "consistency", "mobility", "speed"] as const;
type MetricKey = typeof METRICS[number];

const METRIC_KEY_MAP: Record<MetricKey, keyof ProgressRecord> = {
  overall: "overallScore",
  technique: "techniqueScore",
  power: "powerScore",
  balance: "balanceScore",
  consistency: "consistencyScore",
  mobility: "mobilityScore",
  speed: "speedScore",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_H = 160;

function getMetricColor(key: MetricKey, primary: string, success: string, warning: string) {
  if (key === "overall") return primary;
  if (key === "power" || key === "speed") return success;
  if (key === "mobility") return warning;
  return primary;
}

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeMetric, setActiveMetric] = useState<MetricKey>("overall");
  const [entries, setEntries] = useState<ProgressRecord[]>([]);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;
  const chartWidth = SCREEN_WIDTH - 40;
  const lineColor = getMetricColor(activeMetric, colors.primary, colors.success, colors.warning);

  const loadData = useCallback(async () => {
    try {
      const [{ entries: e }, { achievements: a }] = await Promise.all([
        progressApi.list(),
        achievementsApi.list(),
      ]);
      setEntries(e);
      setAchievements(a);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const values = entries.map((p) => (p[METRIC_KEY_MAP[activeMetric]] as number) ?? 0);
  const minVal = values.length ? Math.min(...values) - 5 : 0;
  const maxVal = values.length ? Math.max(...values) + 5 : 100;
  const range = maxVal - minVal || 1;

  function toY(val: number) {
    return CHART_H - ((val - minVal) / range) * CHART_H;
  }

  const pointWidth = values.length > 1 ? chartWidth / (values.length - 1) : chartWidth;

  const currentScore = values[values.length - 1] ?? 0;
  const firstScore = values[0] ?? 0;
  const gained = Math.round(currentScore - firstScore);
  const gainPct = firstScore > 0 ? Math.round((gained / firstScore) * 100) : 0;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    header: { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 20 },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.foreground },
    subtitle: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 4 },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 14 },
    summaryRow: { flexDirection: "row", gap: 12, marginBottom: 24, paddingHorizontal: 20 },
    summaryCard: { flex: 1, backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    summaryValue: { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.foreground },
    summaryLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
    metricPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    metricChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    metricChipActive: { backgroundColor: lineColor + "22", borderColor: lineColor },
    metricChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textTransform: "capitalize" },
    metricChipTextActive: { color: lineColor },
    chartContainer: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16, overflow: "hidden" },
    chartLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
    chartLabel: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    achGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    achCard: {
      width: "47%",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    achCardLocked: { opacity: 0.5 },
    achIcon: { fontSize: 28 },
    achTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    achDesc: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    achProgress: { fontSize: 11, color: colors.primary, fontFamily: "Inter_600SemiBold", marginTop: 4 },
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
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}
      >
        <View style={s.header}>
          <Text style={s.title}>Progress</Text>
          <Text style={s.subtitle}>Track your improvement over time</Text>
        </View>

        {entries.length === 0 ? (
          <View style={[s.section]}>
            <View style={s.emptyCard}>
              <Feather name="trending-up" size={32} color={colors.mutedForeground} />
              <Text style={s.emptyText}>Complete your first analysis to start tracking progress.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/(tabs)/analyze")} activeOpacity={0.85}>
                <Text style={s.emptyBtnText}>Analyze a Video</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Summary cards */}
            <View style={s.summaryRow}>
              <View style={s.summaryCard}>
                <Text style={s.summaryValue}>{Math.round(currentScore)}</Text>
                <Text style={s.summaryLabel}>Current</Text>
              </View>
              <View style={s.summaryCard}>
                <Text style={[s.summaryValue, { color: gained >= 0 ? colors.success : colors.destructive }]}>
                  {gained >= 0 ? "+" : ""}{gained}
                </Text>
                <Text style={s.summaryLabel}>Points Gained</Text>
              </View>
              <View style={s.summaryCard}>
                <Text style={[s.summaryValue, { color: colors.primary }]}>{gainPct >= 0 ? "+" : ""}{gainPct}%</Text>
                <Text style={s.summaryLabel}>Improvement</Text>
              </View>
            </View>

            {/* Chart */}
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
                <svg viewBox={`0 0 ${chartWidth} ${CHART_H}`} width={chartWidth} height={CHART_H} style={{ display: "block" }}>
                  {/* Grid lines */}
                  {[0, 25, 50, 75, 100].map((pct) => {
                    const y = (CHART_H * pct) / 100;
                    return (
                      <line
                        key={pct}
                        x1="0"
                        y1={y}
                        x2={chartWidth}
                        y2={y}
                        stroke={colors.border}
                        strokeWidth="1"
                      />
                    );
                  })}
                  {/* Area fill */}
                  {values.length > 1 && (
                    <path
                      d={[
                        `M 0 ${toY(values[0]!)}`,
                        ...values.slice(1).map((v, i) => `L ${(i + 1) * pointWidth} ${toY(v)}`),
                        `L ${(values.length - 1) * pointWidth} ${CHART_H}`,
                        `L 0 ${CHART_H}`,
                        "Z",
                      ].join(" ")}
                      fill={lineColor + "22"}
                    />
                  )}
                  {/* Line */}
                  {values.length > 1 && (
                    <polyline
                      points={values.map((v, i) => `${i * pointWidth},${toY(v)}`).join(" ")}
                      fill="none"
                      stroke={lineColor}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {/* Dots */}
                  {values.map((v, i) => (
                    <circle key={i} cx={i * pointWidth} cy={toY(v)} r="4" fill={lineColor} />
                  ))}
                </svg>

                <View style={s.chartLabels}>
                  {entries
                    .filter((_, i) => i === 0 || i === Math.floor(entries.length / 2) || i === entries.length - 1)
                    .map((e, i) => (
                      <Text key={i} style={s.chartLabel}>
                        {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </Text>
                    ))}
                </View>
              </View>
            </View>
          </>
        )}

        {/* Achievements */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Achievements</Text>
          <View style={s.achGrid}>
            {achievements.map((a) => (
              <View key={a.id} style={[s.achCard, !a.unlocked && s.achCardLocked]}>
                <Text style={s.achIcon}>{a.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.achTitle}>{a.title}</Text>
                  <Text style={s.achDesc}>{a.description}</Text>
                  {!a.unlocked && (
                    <Text style={s.achProgress}>{a.progress}/{a.total}</Text>
                  )}
                </View>
                {a.unlocked && <Feather name="check-circle" size={16} color={colors.success} />}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
