import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { MOCK_ATHLETE, MOCK_ACHIEVEMENTS } from "@/lib/athleteData";
import type { PerformanceScores } from "@/lib/types";

const METRICS = ["overall", "technique", "power", "balance", "consistency", "mobility", "speed"] as const;
type MetricKey = typeof METRICS[number];

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
  const [activeMetric, setActiveMetric] = useState<MetricKey>("overall");
  const progress = MOCK_ATHLETE.progressHistory;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;
  const chartWidth = SCREEN_WIDTH - 40;
  const lineColor = getMetricColor(activeMetric, colors.primary, colors.success, colors.warning);

  const values = progress.map((p) => p.scores[activeMetric]);
  const minVal = Math.min(...values) - 5;
  const maxVal = Math.max(...values) + 5;
  const range = maxVal - minVal || 1;

  function toY(val: number) {
    return CHART_H - ((val - minVal) / range) * CHART_H;
  }

  const pointWidth = values.length > 1 ? chartWidth / (values.length - 1) : chartWidth;
  const points = values.map((v, i) => ({
    x: i * pointWidth,
    y: toY(v),
    val: v,
  }));

  const firstScore = values[0];
  const lastScore = values[values.length - 1];
  const improvement = lastScore - firstScore;
  const improvementPct = Math.round((improvement / firstScore) * 100);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    header: {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.foreground },
    subtitle: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 4 },
    summaryRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginBottom: 24 },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    summaryValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    summaryLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    metricScroll: { paddingHorizontal: 16, marginBottom: 16 },
    metricPill: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metricText: { fontSize: 12, fontFamily: "Inter_500Medium" },
    chartCard: {
      marginHorizontal: 20,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 24,
    },
    chartHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
    chartLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground, textTransform: "capitalize" },
    chartChange: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    chartArea: { height: CHART_H, position: "relative" },
    svgLine: { position: "absolute", top: 0, left: 0 },
    dot: {
      position: "absolute",
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 2,
    },
    gridLine: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: colors.border + "66",
    },
    xLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
    xLabel: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 14 },
    achieveCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      gap: 12,
    },
    achieveIcon: { fontSize: 28 },
    achieveTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    achieveDesc: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    achieveProgressBg: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 6, width: "100%" },
    achieveProgressFill: { height: 4, borderRadius: 2 },
    lockedOverlay: { opacity: 0.5 },
  });

  const labelIndices = [0, Math.floor(progress.length / 2), progress.length - 1];

  return (
    <View style={s.container}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>
        <View style={s.header}>
          <Text style={s.title}>Progress</Text>
          <Text style={s.subtitle}>5 months of training data</Text>
        </View>

        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={[s.summaryValue, { color: colors.primary }]}>{lastScore}</Text>
            <Text style={s.summaryLabel}>Current {activeMetric}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={[s.summaryValue, { color: improvement > 0 ? colors.success : colors.destructive }]}>
              {improvement > 0 ? "+" : ""}{improvement}
            </Text>
            <Text style={s.summaryLabel}>Points gained</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={[s.summaryValue, { color: improvement > 0 ? colors.success : colors.destructive }]}>
              {improvementPct > 0 ? "+" : ""}{improvementPct}%
            </Text>
            <Text style={s.summaryLabel}>Improvement</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.metricScroll}>
          {METRICS.map((key) => {
            const active = activeMetric === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.metricPill, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setActiveMetric(key)}
                activeOpacity={0.7}
              >
                <Text style={[s.metricText, { color: active ? "#fff" : colors.mutedForeground, textTransform: "capitalize" }]}>
                  {key}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={s.chartCard}>
          <View style={s.chartHeader}>
            <Text style={s.chartLabel}>{activeMetric} score</Text>
            <Text style={[s.chartChange, { color: improvement > 0 ? colors.success : colors.destructive }]}>
              {improvement > 0 ? "↑" : "↓"} {Math.abs(improvement)} pts
            </Text>
          </View>

          <View style={s.chartArea}>
            {[0.25, 0.5, 0.75].map((frac) => (
              <View key={frac} style={[s.gridLine, { top: frac * CHART_H }]} />
            ))}

            {points.map((pt, i) => {
              if (i === 0) return null;
              const prev = points[i - 1];
              const dx = pt.x - prev.x;
              const dy = pt.y - prev.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              return (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    left: prev.x,
                    top: prev.y,
                    width: len,
                    height: 2,
                    backgroundColor: lineColor,
                    borderRadius: 1,
                    transformOrigin: "0 50%",
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              );
            })}

            {points.map((pt, i) => (
              <View
                key={i}
                style={[
                  s.dot,
                  {
                    left: pt.x - 4,
                    top: pt.y - 4,
                    backgroundColor: i === points.length - 1 ? lineColor : colors.card,
                    borderColor: lineColor,
                  },
                ]}
              />
            ))}
          </View>

          <View style={s.xLabels}>
            {labelIndices.map((idx) => {
              const entry = progress[idx];
              const d = new Date(entry.date);
              return (
                <Text key={idx} style={s.xLabel}>
                  {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </Text>
              );
            })}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Achievements</Text>
          {MOCK_ACHIEVEMENTS.map((ach) => {
            const unlocked = !!ach.unlockedAt;
            const pct = Math.min((ach.progress / ach.total) * 100, 100);
            return (
              <View
                key={ach.id}
                style={[s.achieveCard, { borderColor: unlocked ? colors.primary + "44" : colors.border }, !unlocked && s.lockedOverlay]}
              >
                <Text style={s.achieveIcon}>{ach.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.achieveTitle}>{ach.title}</Text>
                  <Text style={s.achieveDesc}>{ach.description}</Text>
                  <View style={s.achieveProgressBg}>
                    <View
                      style={[
                        s.achieveProgressFill,
                        { width: `${pct}%` as any, backgroundColor: unlocked ? colors.success : colors.primary },
                      ]}
                    />
                  </View>
                </View>
                {unlocked && <Feather name="check-circle" size={20} color={colors.success} />}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
