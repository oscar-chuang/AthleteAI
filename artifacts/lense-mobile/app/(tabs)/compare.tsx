import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import Svg, { Path, Line, Text as SvgText, Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { analyses as analysesApi, type AnalysisRecord } from "@/lib/api";
import { PRO_ATHLETES } from "@/lib/athleteData";
import type { ProAthlete } from "@/lib/types";

const METRICS = ["technique", "power", "balance", "consistency", "mobility", "speed"] as const;
type Metric = typeof METRICS[number];

const SPORT_COLORS: Record<string, string> = {
  golf:       "#4ade80",
  basketball: "#f97316",
  fencing:    "#a78bfa",
  tennis:     "#facc15",
  gymnastics: "#f472b6",
  running:    "#38bdf8",
};

const PRO_BENCHMARKS: Record<string, Record<Metric, number>> = {
  "pro-1": { technique: 97, power: 85, balance: 93, consistency: 96, mobility: 86, speed: 82 },
  "pro-2": { technique: 98, power: 89, balance: 97, consistency: 96, mobility: 91, speed: 95 },
  "pro-3": { technique: 97, power: 85, balance: 95, consistency: 93, mobility: 89, speed: 98 },
  "pro-4": { technique: 97, power: 92, balance: 96, consistency: 97, mobility: 95, speed: 96 },
  "pro-5": { technique: 99, power: 94, balance: 99, consistency: 97, mobility: 99, speed: 91 },
  "pro-6": { technique: 96, power: 99, balance: 92, consistency: 95, mobility: 88, speed: 100 },
};

function getUserScoresForSport(analyses: AnalysisRecord[], sport: string): Record<Metric, number> | null {
  const matches = analyses.filter(a => a.sport === sport && a.status === "complete");
  if (!matches.length) return null;
  const a = matches[0]!;
  return {
    technique:   a.techniqueScore   ?? 0,
    power:       a.powerScore       ?? 0,
    balance:     a.balanceScore     ?? 0,
    consistency: a.consistencyScore ?? 0,
    mobility:    a.mobilityScore    ?? 0,
    speed:       a.speedScore       ?? 0,
  };
}

function computeSimilarity(user: Record<Metric, number>, pro: Record<Metric, number>): number {
  const diffs = METRICS.map(m => Math.abs((user[m] ?? 0) - (pro[m] ?? 0)) / 100);
  const avg = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  return Math.round((1 - avg) * 100);
}

function RadarChart({
  userScores,
  proScores,
  size = 240,
  primaryColor,
  userColor,
}: {
  userScores: Record<Metric, number>;
  proScores: Record<Metric, number>;
  size?: number;
  primaryColor: string;
  userColor: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.36;
  const numAxes = METRICS.length;

  const angle = (i: number) => (i * 2 * Math.PI) / numAxes - Math.PI / 2;

  const toX = (score: number, i: number) => cx + (score / 100) * maxR * Math.cos(angle(i));
  const toY = (score: number, i: number) => cy + (score / 100) * maxR * Math.sin(angle(i));

  const polyPath = (scores: Record<Metric, number>) =>
    METRICS.map((m, i) => `${i === 0 ? "M" : "L"} ${toX(scores[m], i)},${toY(scores[m], i)}`).join(" ") + " Z";

  const gridPath = (level: number) =>
    METRICS.map((_, i) => `${i === 0 ? "M" : "L"} ${cx + level * maxR * Math.cos(angle(i))},${cy + level * maxR * Math.sin(angle(i))}`).join(" ") + " Z";

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1.0].map(level => (
        <Path key={level} d={gridPath(level)} fill="none" stroke="#ffffff18" strokeWidth={1} />
      ))}
      {METRICS.map((_, i) => (
        <Line key={i} x1={cx} y1={cy} x2={cx + maxR * Math.cos(angle(i))} y2={cy + maxR * Math.sin(angle(i))} stroke="#ffffff18" strokeWidth={1} />
      ))}
      <Path d={polyPath(proScores)} fill={primaryColor + "28"} stroke={primaryColor} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d={polyPath(userScores)} fill={userColor + "38"} stroke={userColor} strokeWidth={2.5} strokeLinejoin="round" />
      {METRICS.map((m, i) => {
        const labelR = maxR + 20;
        return (
          <SvgText
            key={i}
            x={cx + labelR * Math.cos(angle(i))}
            y={cy + labelR * Math.sin(angle(i))}
            fontSize={8}
            fill="#ffffff99"
            textAnchor="middle"
            dy="3"
            fontFamily="Inter_500Medium"
          >
            {m.toUpperCase()}
          </SvgText>
        );
      })}
      {METRICS.map((m, i) => (
        <Circle key={i} cx={toX(userScores[m], i)} cy={toY(userScores[m], i)} r={4} fill={userColor} />
      ))}
    </Svg>
  );
}

export default function CompareScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<ProAthlete | null>(null);
  const [userAnalyses, setUserAnalyses] = useState<AnalysisRecord[]>([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;

  useFocusEffect(useCallback(() => {
    analysesApi.list()
      .then(({ analyses }) => setUserAnalyses(analyses))
      .catch(() => {})
      .finally(() => setLoadingAnalyses(false));
  }, []));

  function getSimilarity(pro: ProAthlete): number | null {
    const userScores = getUserScoresForSport(userAnalyses, pro.sport);
    if (!userScores) return null;
    const proScores = PRO_BENCHMARKS[pro.id];
    if (!proScores) return null;
    return computeSimilarity(userScores, proScores);
  }

  const s = StyleSheet.create({
    container:    { flex: 1, backgroundColor: colors.background },
    scroll:       { flex: 1 },
    header:       { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 20 },
    title:        { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.foreground },
    subtitle:     { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 4 },
    proCard:      { backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, marginHorizontal: 20, marginBottom: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 14 },
    avatar:       { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
    avatarText:   { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
    proName:      { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    proSpecialty: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    sportBadge:   { alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
    sportBadgeText:{ fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
    simBadge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.primary + "22", alignItems: "center" },
    simNum:       { fontSize: 16, fontFamily: "Inter_700Bold", color: colors.primary },
    simLabel:     { fontSize: 9, color: colors.primary, fontFamily: "Inter_400Regular" },
    comparePanel: { marginHorizontal: 20, marginBottom: 24, borderRadius: colors.radius, overflow: "hidden", borderWidth: 1, borderColor: colors.primary + "55" },
    panelBg:      { backgroundColor: "#0f0f14", padding: 20 },
    panelTitle:   { fontSize: 18, fontFamily: "Inter_700Bold", color: "#ffffff", marginBottom: 2 },
    panelSubtitle:{ fontSize: 13, color: "#ffffff88", fontFamily: "Inter_400Regular", marginBottom: 16 },
    radarWrap:    { alignItems: "center", marginBottom: 16 },
    legend:       { flexDirection: "row", gap: 20, justifyContent: "center", marginBottom: 16 },
    legendItem:   { flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot:    { width: 10, height: 10, borderRadius: 5 },
    legendText:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "#ffffff88" },
    metricGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    metricRow:    { width: "48%", flexDirection: "row", alignItems: "center", gap: 6 },
    metricLabel:  { fontSize: 10, color: "#ffffff66", fontFamily: "Inter_400Regular", width: 66, textTransform: "capitalize" },
    metricBarBg:  { flex: 1, height: 4, backgroundColor: "#ffffff18", borderRadius: 2 },
    metricBarFill:{ height: 4, borderRadius: 2 },
    metricNum:    { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#ffffff99", width: 24, textAlign: "right" },
    attrSection:  { marginBottom: 8 },
    attrTitle:    { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#ffffff55", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
    attrRow:      { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    attrPill:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#ffffff14" },
    attrText:     { fontSize: 11, color: "#ffffff88", fontFamily: "Inter_400Regular" },
    noMatchBox:   { backgroundColor: "#ffffff0a", borderRadius: 10, padding: 14, marginBottom: 12 },
    noMatchText:  { color: "#ffffff66", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
    closeBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: colors.radius, borderWidth: 1, borderColor: "#ffffff22" },
    closeBtnText: { color: "#ffffff66", fontSize: 13, fontFamily: "Inter_400Regular" },
    noDataNote:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.muted, borderRadius: 10, padding: 10, marginHorizontal: 20, marginBottom: 16 },
    noDataText:   { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", flex: 1 },
  });

  const anyHasSim = PRO_ATHLETES.some(p => getSimilarity(p) !== null);

  return (
    <View style={s.container}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>
        <View style={s.header}>
          <Text style={s.title}>Compare</Text>
          <Text style={s.subtitle}>See how you stack up against the pros</Text>
        </View>

        {!loadingAnalyses && !anyHasSim && (
          <View style={s.noDataNote}>
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={s.noDataText}>
              Upload and analyze a video to get your similarity score against each athlete.
            </Text>
          </View>
        )}

        {selected && (() => {
          const proScores = PRO_BENCHMARKS[selected.id];
          const userScores = getUserScoresForSport(userAnalyses, selected.sport);
          const sim = userScores && proScores ? computeSimilarity(userScores, proScores) : null;
          const sportColor = SPORT_COLORS[selected.sport] ?? colors.primary;

          return (
            <View style={s.comparePanel}>
              <View style={s.panelBg}>
                <Text style={s.panelTitle}>vs. {selected.name}</Text>
                <Text style={s.panelSubtitle}>{selected.specialty}</Text>

                {userScores && proScores ? (
                  <>
                    <View style={{ alignItems: "center", marginBottom: 8 }}>
                      <Text style={{ fontSize: 42, fontFamily: "Inter_700Bold", color: "#fff" }}>{sim}%</Text>
                      <Text style={{ fontSize: 12, color: "#ffffff66", fontFamily: "Inter_400Regular" }}>match with {selected.name}</Text>
                    </View>

                    <View style={s.radarWrap}>
                      <RadarChart
                        userScores={userScores}
                        proScores={proScores}
                        size={240}
                        primaryColor={sportColor}
                        userColor="#22c55e"
                      />
                    </View>

                    <View style={s.legend}>
                      <View style={s.legendItem}>
                        <View style={[s.legendDot, { backgroundColor: sportColor }]} />
                        <Text style={s.legendText}>{selected.name}</Text>
                      </View>
                      <View style={s.legendItem}>
                        <View style={[s.legendDot, { backgroundColor: "#22c55e" }]} />
                        <Text style={s.legendText}>You</Text>
                      </View>
                    </View>

                    <View style={s.metricGrid}>
                      {METRICS.map(m => {
                        const uScore = userScores[m];
                        const pScore = proScores[m];
                        const diff = uScore - pScore;
                        const diffColor = diff >= -5 ? "#22c55e" : diff >= -20 ? "#f59e0b" : "#ef4444";
                        return (
                          <View key={m} style={s.metricRow}>
                            <Text style={s.metricLabel}>{m}</Text>
                            <View style={s.metricBarBg}>
                              <View style={[s.metricBarFill, { width: `${uScore}%` as any, backgroundColor: diffColor }]} />
                            </View>
                            <Text style={[s.metricNum, { color: diffColor }]}>{uScore}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <View style={s.noMatchBox}>
                    <Text style={s.noMatchText}>
                      Upload a {selected.sport} video to generate your personal comparison with {selected.name}.
                    </Text>
                  </View>
                )}

                <View style={s.attrSection}>
                  <Text style={s.attrTitle}>Key attributes to match</Text>
                  <View style={s.attrRow}>
                    {selected.keyAttributes.map((attr) => (
                      <View key={attr} style={s.attrPill}>
                        <Text style={s.attrText}>{attr}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <TouchableOpacity style={s.closeBtn} activeOpacity={0.7} onPress={() => setSelected(null)}>
                  <Feather name="x" size={14} color="#ffffff66" />
                  <Text style={s.closeBtnText}>Close comparison</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {PRO_ATHLETES.map((pro) => {
          const sportColor = SPORT_COLORS[pro.sport] ?? colors.primary;
          const initials = pro.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
          const similarity = getSimilarity(pro);
          const isSelected = selected?.id === pro.id;

          return (
            <TouchableOpacity
              key={pro.id}
              style={[s.proCard, { borderColor: isSelected ? colors.primary + "88" : colors.border }]}
              activeOpacity={0.75}
              onPress={() => setSelected(isSelected ? null : pro)}
            >
              <View style={[s.avatar, { backgroundColor: sportColor + "33" }]}>
                <Text style={[s.avatarText, { color: sportColor }]}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.proName}>{pro.name}</Text>
                <Text style={s.proSpecialty}>{pro.specialty}</Text>
                <View style={[s.sportBadge, { backgroundColor: sportColor + "22" }]}>
                  <Text style={[s.sportBadgeText, { color: sportColor }]}>{pro.sport}</Text>
                </View>
              </View>
              {similarity !== null ? (
                <View style={s.simBadge}>
                  <Text style={s.simNum}>{similarity}%</Text>
                  <Text style={s.simLabel}>match</Text>
                </View>
              ) : (
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
