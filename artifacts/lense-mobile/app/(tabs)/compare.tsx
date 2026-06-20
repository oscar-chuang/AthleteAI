import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
} from "react-native";
import Svg, { Path, Line, Text as SvgText, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import { analyses as analysesApi, type AnalysisRecord } from "@/lib/api";
import { PRO_ATHLETES } from "@/lib/athleteData";
import type { ProAthlete, ProAthleteBenchmarks } from "@/lib/types";

// ── Types & constants ─────────────────────────────────────────────────────────

const METRICS: Array<keyof ProAthleteBenchmarks> = [
  "technique", "power", "balance", "consistency", "mobility", "speed",
];

// Weights mirror the overall score formula in anthropic.ts
const METRIC_WEIGHTS: Record<keyof ProAthleteBenchmarks, number> = {
  technique: 0.25,
  balance: 0.20,
  power: 0.15,
  consistency: 0.15,
  mobility: 0.15,
  speed: 0.10,
};

const METRIC_LABELS: Record<keyof ProAthleteBenchmarks, string> = {
  technique: "TECHNIQUE",
  power: "POWER",
  balance: "BALANCE",
  consistency: "CONSIST.",
  mobility: "MOBILITY",
  speed: "SPEED",
};

const SPORT_COLORS: Record<string, string> = {
  golf:          "#4ade80",
  basketball:    "#f97316",
  fencing:       "#FF6B35",
  tennis:        "#facc15",
  gymnastics:    "#f472b6",
  running:       "#38bdf8",
  swimming:      "#22d3ee",
  cycling:       "#fb923c",
  boxing:        "#FF4444",
  rowing:        "#00C2FF",
  crossfit:      "#84cc16",
  soccer:        "#34d399",
  weightlifting: "#e879f9",
  volleyball:    "#fbbf24",
  baseball:      "#60a5fa",
};

const SPORT_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  golf: "flag", basketball: "circle", fencing: "zap", tennis: "activity",
  gymnastics: "star", running: "wind", swimming: "droplet", cycling: "sunset",
  boxing: "shield", rowing: "anchor", crossfit: "bar-chart-2", soccer: "disc",
  weightlifting: "trending-up", volleyball: "radio", baseball: "target",
};

function sportColor(sport: string, fallback: string): string {
  return SPORT_COLORS[sport.toLowerCase()] ?? fallback;
}

// ── Scoring utilities ─────────────────────────────────────────────────────────

function getUserScoresForSport(
  analyses: AnalysisRecord[],
  sport: string,
): ProAthleteBenchmarks | null {
  const matches = analyses
    .filter(a => a.sport.toLowerCase() === sport.toLowerCase() && a.status === "complete")
    .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));
  if (!matches.length) return null;
  // Average the top-3 best sessions to smooth out outliers
  const top = matches.slice(0, 3);
  const avg = (key: keyof ProAthleteBenchmarks): number => {
    const vals = top
      .map(a => (a as any)[`${key}Score`] as number | undefined)
      .filter((v): v is number => v != null && v > 0);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  };
  return {
    technique:   avg("technique"),
    power:       avg("power"),
    balance:     avg("balance"),
    consistency: avg("consistency"),
    mobility:    avg("mobility"),
    speed:       avg("speed"),
  };
}

function computeSimilarity(user: ProAthleteBenchmarks, pro: ProAthleteBenchmarks): number {
  const weightedDiff = METRICS.reduce((sum, m) => {
    return sum + METRIC_WEIGHTS[m] * Math.abs(user[m] - pro[m]) / 100;
  }, 0);
  return Math.max(0, Math.min(100, Math.round((1 - weightedDiff) * 100)));
}

function getGrade(pct: number): { letter: string; color: string } {
  if (pct >= 95) return { letter: "S", color: "#facc15" };
  if (pct >= 85) return { letter: "A", color: "#1DB954" };
  if (pct >= 75) return { letter: "B", color: "#38bdf8" };
  if (pct >= 65) return { letter: "C", color: "#f97316" };
  if (pct >= 55) return { letter: "D", color: "#FF4444" };
  return { letter: "F", color: "#94a3b8" };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RadarChart({
  userScores,
  proScores,
  size = 260,
  primaryColor,
  userColor = "#1DB954",
}: {
  userScores: ProAthleteBenchmarks;
  proScores: ProAthleteBenchmarks;
  size?: number;
  primaryColor: string;
  userColor?: string;
}) {
  const cx = size / 2, cy = size / 2;
  const maxR = size * 0.34;
  const n = METRICS.length;
  const angle = (i: number) => (i * 2 * Math.PI) / n - Math.PI / 2;
  const tx = (score: number, i: number) => (cx + (score / 100) * maxR * Math.cos(angle(i))).toFixed(1);
  const ty = (score: number, i: number) => (cy + (score / 100) * maxR * Math.sin(angle(i))).toFixed(1);
  const poly = (sc: ProAthleteBenchmarks) =>
    METRICS.map((m, i) => `${i === 0 ? "M" : "L"} ${tx(sc[m], i)},${ty(sc[m], i)}`).join(" ") + " Z";
  const grid = (level: number) =>
    METRICS.map((_, i) => {
      const gx = (cx + level * maxR * Math.cos(angle(i))).toFixed(1);
      const gy = (cy + level * maxR * Math.sin(angle(i))).toFixed(1);
      return `${i === 0 ? "M" : "L"} ${gx},${gy}`;
    }).join(" ") + " Z";

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1.0].map(l => (
        <Path key={l} d={grid(l)} fill="none" stroke={l === 1 ? "#ffffff22" : "#ffffff0e"} strokeWidth={l === 1 ? 1.5 : 1} />
      ))}
      {/* Axis spokes */}
      {METRICS.map((_, i) => (
        <Line
          key={i}
          x1={cx} y1={cy}
          x2={(cx + maxR * Math.cos(angle(i))).toFixed(1)}
          y2={(cy + maxR * Math.sin(angle(i))).toFixed(1)}
          stroke="#ffffff12" strokeWidth={1}
        />
      ))}
      {/* Pro polygon */}
      <Path d={poly(proScores)} fill={primaryColor + "1a"} stroke={primaryColor} strokeWidth={1.5} strokeLinejoin="round" />
      {/* User polygon */}
      <Path d={poly(userScores)} fill={userColor + "28"} stroke={userColor} strokeWidth={2.5} strokeLinejoin="round" />
      {/* Pro vertex dots */}
      {METRICS.map((m, i) => (
        <Circle key={`pd${i}`} cx={tx(proScores[m], i)} cy={ty(proScores[m], i)} r={3} fill={primaryColor} opacity={0.8} />
      ))}
      {/* User vertex dots */}
      {METRICS.map((m, i) => (
        <Circle key={`ud${i}`} cx={tx(userScores[m], i)} cy={ty(userScores[m], i)} r={4.5} fill={userColor} stroke="#0f0f14" strokeWidth={1.5} />
      ))}
      {/* Labels */}
      {METRICS.map((m, i) => {
        const lr = maxR + 24;
        const lx = (cx + lr * Math.cos(angle(i))).toFixed(1);
        const ly = (cy + lr * Math.sin(angle(i))).toFixed(1);
        return (
          <SvgText key={`lbl${i}`} x={lx} y={ly} fontSize={8} fill="#ffffff77" textAnchor="middle" dy="3" fontFamily="Inter_500Medium">
            {METRIC_LABELS[m]}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function MetricRow({
  metric,
  userScore,
  proScore,
  color,
}: {
  metric: keyof ProAthleteBenchmarks;
  userScore: number;
  proScore: number;
  color: string;
}) {
  const diff = userScore - proScore;
  const chipColor = diff >= -5 ? "#1DB954" : diff >= -20 ? "#FF6B35" : "#FF4444";
  return (
    <View style={{ marginBottom: 11 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <Text style={{ fontSize: 9, color: "#ffffff44", fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.7, width: 68 }}>
          {metric}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Text style={{ fontSize: 11, color: "#ffffffbb", fontFamily: "Inter_700Bold" }}>{userScore}</Text>
          <Text style={{ fontSize: 9, color: "#ffffff2a", fontFamily: "Inter_400Regular" }}>vs</Text>
          <Text style={{ fontSize: 11, color: color + "cc", fontFamily: "Inter_600SemiBold" }}>{proScore}</Text>
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: chipColor + "22", minWidth: 30, alignItems: "center" }}>
            <Text style={{ fontSize: 9, color: chipColor, fontFamily: "Inter_700Bold" }}>
              {diff >= 0 ? `+${diff}` : String(diff)}
            </Text>
          </View>
        </View>
      </View>
      {/* Pro bar (thin reference) */}
      <View style={{ height: 3, backgroundColor: "#ffffff0c", borderRadius: 2, marginBottom: 2 }}>
        <View style={{ width: `${proScore}%`, height: 3, backgroundColor: color + "44", borderRadius: 2 }} />
      </View>
      {/* User bar */}
      <View style={{ height: 5, backgroundColor: "#ffffff0c", borderRadius: 3 }}>
        <View style={{ width: `${Math.max(userScore, 2)}%`, height: 5, backgroundColor: chipColor + "bb", borderRadius: 3 }} />
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CompareScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<ProAthlete | null>(null);
  const [activeSport, setActiveSport] = useState<string>("all");
  const [userAnalyses, setUserAnalyses] = useState<AnalysisRecord[]>([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;

  useFocusEffect(useCallback(() => {
    setLoadingAnalyses(true);
    analysesApi.list()
      .then(({ analyses }) => setUserAnalyses(analyses))
      .catch(() => {})
      .finally(() => setLoadingAnalyses(false));
  }, []));

  // All unique sports from the roster
  const allSports = useMemo(() => {
    const seen = new Set<string>();
    PRO_ATHLETES.forEach(p => seen.add(p.sport));
    return ["all", ...Array.from(seen).sort()];
  }, []);

  // Filtered + sorted athlete list
  const visibleAthletes = useMemo(() => {
    let list = activeSport === "all"
      ? PRO_ATHLETES
      : PRO_ATHLETES.filter(p => p.sport === activeSport);
    // Sort: athletes with similarity data first (descending), then the rest
    return list.slice().sort((a, b) => {
      const ua = getUserScoresForSport(userAnalyses, a.sport);
      const ub = getUserScoresForSport(userAnalyses, b.sport);
      const sa = ua ? computeSimilarity(ua, a.benchmarks) : -1;
      const sb = ub ? computeSimilarity(ub, b.benchmarks) : -1;
      return sb - sa;
    });
  }, [activeSport, userAnalyses]);

  // Best match across all sports
  const bestMatch = useMemo<{ athlete: ProAthlete; pct: number } | null>(() => {
    let best: { athlete: ProAthlete; pct: number } | null = null;
    for (const pro of PRO_ATHLETES) {
      const u = getUserScoresForSport(userAnalyses, pro.sport);
      if (!u) continue;
      const pct = computeSimilarity(u, pro.benchmarks);
      if (!best || pct > best.pct) best = { athlete: pro, pct };
    }
    return best;
  }, [userAnalyses]);

  const panelData = useMemo(() => {
    if (!selected) return null;
    const userScores = getUserScoresForSport(userAnalyses, selected.sport);
    const similarity = userScores ? computeSimilarity(userScores, selected.benchmarks) : null;
    const sc = sportColor(selected.sport, colors.primary);
    const grade = similarity != null ? getGrade(similarity) : null;

    const gaps = userScores
      ? METRICS
          .map(m => ({ m, gap: userScores[m] - selected.benchmarks[m] }))
          .filter(g => g.gap < 0)
          .sort((a, b) => a.gap - b.gap)
          .slice(0, 3)
      : [];

    const leads = userScores
      ? METRICS.filter(m => userScores[m] >= selected.benchmarks[m] - 8)
      : [];

    return { userScores, similarity, sc, grade, gaps, leads };
  }, [selected, userAnalyses, colors.primary]);

  // ── Styles ──────────────────────────────────────────────────────────────────

  const s = StyleSheet.create({
    container:    { flex: 1, backgroundColor: colors.background },
    header:       { paddingTop: topPad + 14, paddingHorizontal: 20, paddingBottom: 12 },
    title:        { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.foreground },
    subtitle:     { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 3 },
    bestBanner:   {
      flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginBottom: 14,
      backgroundColor: colors.primary + "14", borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: colors.primary + "33",
    },
    bestText:     { fontSize: 13, color: colors.foreground, fontFamily: "Inter_600SemiBold", flex: 1 },
    bestSub:      { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1 },
    sportRow:     { paddingBottom: 14 },
    sportChip:    {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: 20, marginLeft: 8,
      backgroundColor: colors.muted,
      borderWidth: 1, borderColor: colors.border,
    },
    sportChipTxt: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
    proCard:      {
      backgroundColor: colors.card, borderRadius: 14, padding: 14,
      marginHorizontal: 20, marginBottom: 10,
      borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12,
    },
    avatar:       { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
    avatarInitials: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
    proName:      { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    proMeta:      { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1 },
    sportBadge:   { alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
    sportBadgeTxt:{ fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.3 },
    simBadge:     { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", minWidth: 52 },
    simNum:       { fontSize: 17, fontFamily: "Inter_700Bold" },
    simLabel:     { fontSize: 8, fontFamily: "Inter_500Medium", marginTop: 1 },
    noDataNote:   {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.muted,
      borderRadius: 12, padding: 12, marginHorizontal: 20, marginBottom: 14,
    },
    noDataText:   { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
    // ── Compare panel ──────────────────────────────────────────────────────
    panel:        { marginHorizontal: 20, marginBottom: 16, borderRadius: 16, overflow: "hidden", borderWidth: 1 },
    panelBg:      { backgroundColor: "#0c0c12", padding: 20 },
    sectionSep:   { height: 1, backgroundColor: "#ffffff0d", marginVertical: 14 },
    sectionLabel: {
      fontSize: 9, fontFamily: "Inter_700Bold", color: "#ffffff44",
      textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10,
    },
    matchRow:     { flexDirection: "row", alignItems: "center", gap: 16, justifyContent: "center", marginBottom: 16 },
    matchPct:     { fontSize: 56, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -1 },
    gradeBadge:   { alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, borderWidth: 2 },
    gradeText:    { fontSize: 22, fontFamily: "Inter_700Bold" },
    matchSub:     { fontSize: 12, color: "#ffffff66", fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 4, marginTop: -8 },
    radarWrap:    { alignItems: "center", marginBottom: 12 },
    legendRow:    { flexDirection: "row", gap: 18, justifyContent: "center", marginBottom: 14 },
    legendItem:   { flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot:    { width: 10, height: 10, borderRadius: 5 },
    legendTxt:    { fontSize: 11, color: "#ffffff77", fontFamily: "Inter_400Regular" },
    gapRow:       { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 7 },
    gapDot:       { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
    gapText:      { fontSize: 12, color: "#ffffff88", fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
    leadRow:      { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    leadPill:     { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, backgroundColor: "#1DB95418", borderWidth: 1, borderColor: "#1DB95433" },
    leadPillTxt:  { fontSize: 10, color: "#1DB954", fontFamily: "Inter_500Medium", textTransform: "capitalize" },
    highlightRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
    highlightDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#ffffff44", marginTop: 7 },
    highlightTxt: { fontSize: 12, color: "#ffffffaa", fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
    quoteBox:     { backgroundColor: "#ffffff07", borderRadius: 10, padding: 12, borderLeftWidth: 3 },
    quoteTxt:     { fontSize: 12, color: "#ffffffaa", fontFamily: "Inter_400Regular", fontStyle: "italic", lineHeight: 19 },
    quoteAttr:    { fontSize: 10, color: "#ffffff55", fontFamily: "Inter_500Medium", marginTop: 6, textAlign: "right" },
    tipNum:       { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
    tipNumTxt:    { fontSize: 11, color: "#fff", fontFamily: "Inter_700Bold" },
    tipTxt:       { fontSize: 12, color: "#ffffffaa", fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
    srcRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
    srcTxt:       { fontSize: 11, color: "#00C2FF", fontFamily: "Inter_400Regular", flex: 1, textDecorationLine: "underline" },
    noMatchBox:   { backgroundColor: "#ffffff08", borderRadius: 10, padding: 14, marginBottom: 12 },
    noMatchTxt:   { color: "#ffffff66", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
    closeBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: "#ffffff1a", marginTop: 4 },
    closeBtnTxt:  { color: "#ffffff55", fontSize: 13, fontFamily: "Inter_400Regular" },
    emptyState:   { alignItems: "center", paddingVertical: 40, paddingHorizontal: 32 },
    emptyIcon:    { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    emptyTitle:   { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground, textAlign: "center", marginBottom: 6 },
    emptyText:    { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Compare</Text>
          <Text style={s.subtitle}>Stack up against {PRO_ATHLETES.length} elite athletes across {allSports.length - 1} sports</Text>
        </View>

        {/* Best match banner */}
        {bestMatch && (
          <View style={s.bestBanner}>
            <Feather name="award" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.bestText}>
                Best match: {bestMatch.athlete.name} at {bestMatch.pct}%
              </Text>
              <Text style={s.bestSub}>
                {bestMatch.athlete.sport} · {bestMatch.athlete.specialty}
              </Text>
            </View>
            <Text style={{ fontSize: 28, fontFamily: "Inter_700Bold", color: colors.primary }}>
              {getGrade(bestMatch.pct).letter}
            </Text>
          </View>
        )}

        {/* First-time hint */}
        {!loadingAnalyses && !bestMatch && (
          <View style={s.noDataNote}>
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={s.noDataText}>
              Analyze a video to generate your personal similarity score against each pro athlete.
            </Text>
          </View>
        )}

        {/* Sport filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 20 }}
          style={s.sportRow}
        >
          {allSports.map(sp => {
            const isActive = activeSport === sp;
            const spColor = sp === "all" ? colors.primary : sportColor(sp, colors.primary);
            return (
              <TouchableOpacity
                key={sp}
                style={[
                  s.sportChip,
                  isActive && { backgroundColor: spColor + "22", borderColor: spColor + "66" },
                ]}
                activeOpacity={0.75}
                onPress={() => {
                  setActiveSport(sp);
                  if (selected && sp !== "all" && selected.sport !== sp) setSelected(null);
                }}
              >
                {sp !== "all" && (
                  <Feather
                    name={SPORT_ICONS[sp] ?? "activity"}
                    size={11}
                    color={isActive ? spColor : colors.mutedForeground}
                  />
                )}
                <Text style={[s.sportChipTxt, { color: isActive ? spColor : colors.mutedForeground }]}>
                  {sp === "all" ? "All Sports" : sp}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Comparison panel ── */}
        {selected && panelData && (() => {
          const { userScores, similarity, sc, grade, gaps, leads } = panelData;
          const initials = selected.name.split(" ").map(n => n[0]).join("").slice(0, 2);
          return (
            <View style={[s.panel, { borderColor: sc + "44" }]}>
              <View style={s.panelBg}>

                {/* Hero header */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <View style={[s.avatar, { backgroundColor: sc + "22", width: 48, height: 48, borderRadius: 24 }]}>
                    <Text style={[s.avatarInitials, { color: sc, fontSize: 16 }]}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" }}>{selected.name}</Text>
                      <Text style={{ fontSize: 16 }}>{selected.countryFlag}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: "#ffffff77", fontFamily: "Inter_400Regular", marginTop: 1 }}>
                      {selected.specialty}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <View style={[s.sportBadge, { backgroundColor: sc + "22" }]}>
                        <Text style={[s.sportBadgeTxt, { color: sc }]}>{selected.sport}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: "#ffffff44", fontFamily: "Inter_400Regular" }}>
                        b. {selected.born}
                      </Text>
                    </View>
                  </View>
                </View>

                {userScores && similarity != null && grade ? (
                  <>
                    {/* Match score + grade */}
                    <View style={s.matchRow}>
                      <View style={{ alignItems: "center" }}>
                        <Text style={s.matchPct}>{similarity}%</Text>
                        <Text style={s.matchSub}>match with {selected.name.split(" ")[0]}</Text>
                      </View>
                      <View>
                        <View style={[s.gradeBadge, { borderColor: grade.color + "66", backgroundColor: grade.color + "14" }]}>
                          <Text style={[s.gradeText, { color: grade.color }]}>{grade.letter}</Text>
                        </View>
                        <Text style={{ fontSize: 8, color: "#ffffff44", fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 3 }}>GRADE</Text>
                      </View>
                    </View>

                    {/* Radar chart */}
                    <View style={s.radarWrap}>
                      <RadarChart
                        userScores={userScores}
                        proScores={selected.benchmarks}
                        size={256}
                        primaryColor={sc}
                      />
                    </View>

                    {/* Legend */}
                    <View style={s.legendRow}>
                      <View style={s.legendItem}>
                        <View style={[s.legendDot, { backgroundColor: sc }]} />
                        <Text style={s.legendTxt}>{selected.name.split(" ").slice(-1)[0]}</Text>
                      </View>
                      <View style={s.legendItem}>
                        <View style={[s.legendDot, { backgroundColor: "#1DB954" }]} />
                        <Text style={s.legendTxt}>You (avg top 3)</Text>
                      </View>
                    </View>

                    <View style={s.sectionSep} />

                    {/* Metric breakdown */}
                    <Text style={s.sectionLabel}>METRIC BREAKDOWN</Text>
                    {METRICS.map(m => (
                      <MetricRow
                        key={m}
                        metric={m}
                        userScore={userScores[m]}
                        proScore={selected.benchmarks[m]}
                        color={sc}
                      />
                    ))}

                    <View style={s.sectionSep} />

                    {/* Gap analysis */}
                    {gaps.length > 0 && (
                      <>
                        <Text style={s.sectionLabel}>KEY GAPS TO CLOSE</Text>
                        {gaps.map(({ m, gap }) => (
                          <View key={m} style={s.gapRow}>
                            <View style={[s.gapDot, { backgroundColor: "#FF4444" }]} />
                            <Text style={s.gapText}>
                              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", textTransform: "capitalize" }}>{m}</Text>
                              {" "}— close {Math.abs(gap)} pts to reach {selected.name.split(" ")[0]}'s level
                            </Text>
                          </View>
                        ))}
                        <View style={s.sectionSep} />
                      </>
                    )}

                    {/* Strengths */}
                    {leads.length > 0 && (
                      <>
                        <Text style={s.sectionLabel}>CLOSEST TO PRO LEVEL</Text>
                        <View style={s.leadRow}>
                          {leads.map(m => (
                            <View key={m} style={s.leadPill}>
                              <Text style={s.leadPillTxt}>✓ {m}</Text>
                            </View>
                          ))}
                        </View>
                        <View style={s.sectionSep} />
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <View style={s.noMatchBox}>
                      <Text style={s.noMatchTxt}>
                        Upload and analyze a {selected.sport} video to generate your personal score comparison against {selected.name}.
                      </Text>
                    </View>
                    <View style={s.sectionSep} />
                  </>
                )}

                {/* Career highlights */}
                <Text style={s.sectionLabel}>CAREER HIGHLIGHTS</Text>
                {selected.careerHighlights.map((h, i) => (
                  <View key={i} style={s.highlightRow}>
                    <View style={s.highlightDot} />
                    <Text style={s.highlightTxt}>{h}</Text>
                  </View>
                ))}

                <View style={s.sectionSep} />

                {/* Key attributes */}
                <Text style={s.sectionLabel}>ELITE ATTRIBUTES</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 2 }}>
                  {selected.keyAttributes.map((attr, i) => (
                    <View key={i} style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, backgroundColor: sc + "18", borderWidth: 1, borderColor: sc + "33" }}>
                      <Text style={{ fontSize: 10, color: sc + "dd", fontFamily: "Inter_400Regular" }}>{attr}</Text>
                    </View>
                  ))}
                </View>

                <View style={s.sectionSep} />

                {/* Training philosophy */}
                <Text style={s.sectionLabel}>TRAINING PHILOSOPHY</Text>
                <View style={[s.quoteBox, { borderLeftColor: sc }]}>
                  <Text style={s.quoteTxt}>"{selected.trainingPhilosophy}"</Text>
                  <Text style={s.quoteAttr}>— {selected.name}</Text>
                </View>

                <View style={s.sectionSep} />

                {/* Train tips */}
                <Text style={s.sectionLabel}>LEARN FROM {selected.name.split(" ").slice(-1)[0].toUpperCase()}</Text>
                {selected.trainTips.map((tip, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                    <View style={[s.tipNum, { backgroundColor: sc + "33" }]}>
                      <Text style={[s.tipNumTxt, { color: sc }]}>{i + 1}</Text>
                    </View>
                    <Text style={s.tipTxt}>{tip}</Text>
                  </View>
                ))}

                <View style={s.sectionSep} />

                {/* Signature technique */}
                <Text style={s.sectionLabel}>SIGNATURE TECHNIQUE</Text>
                <View style={{ backgroundColor: sc + "0e", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: sc + "22", marginBottom: 2 }}>
                  <Text style={{ fontSize: 12, color: "#ffffffaa", fontFamily: "Inter_400Regular", lineHeight: 18, fontStyle: "italic" }}>
                    {selected.signature}
                  </Text>
                </View>

                <View style={s.sectionSep} />

                {/* Sources */}
                <Text style={s.sectionLabel}>SOURCES & RESEARCH</Text>
                <Text style={{ fontSize: 10, color: "#ffffff33", fontFamily: "Inter_400Regular", marginBottom: 8, lineHeight: 15 }}>
                  Benchmarks are AI estimates from published biomechanics research — not directly measured athlete data.
                </Text>
                {selected.sources.map((src, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.srcRow}
                    activeOpacity={0.7}
                    onPress={() => Linking.openURL(src.url).catch(() => {})}
                  >
                    <Feather name="external-link" size={11} color="#00C2FF" />
                    <Text style={s.srcTxt}>{src.label}</Text>
                  </TouchableOpacity>
                ))}

                <View style={s.sectionSep} />

                {/* Close */}
                <TouchableOpacity style={s.closeBtn} activeOpacity={0.7} onPress={() => setSelected(null)}>
                  <Feather name="x" size={14} color="#ffffff44" />
                  <Text style={s.closeBtnTxt}>Close comparison</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {/* ── Athlete roster ── */}
        {loadingAnalyses ? (
          <View style={{ gap: 1 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : visibleAthletes.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIcon}>
              <Feather name="users" size={26} color={colors.mutedForeground} />
            </View>
            <Text style={s.emptyTitle}>No athletes in this sport yet</Text>
            <Text style={s.emptyText}>Try switching to "All Sports" or pick a different filter.</Text>
          </View>
        ) : (
          visibleAthletes.map(pro => {
            const sc = sportColor(pro.sport, colors.primary);
            const initials = pro.name.split(" ").map(n => n[0]).join("").slice(0, 2);
            const userScores = getUserScoresForSport(userAnalyses, pro.sport);
            const similarity = userScores ? computeSimilarity(userScores, pro.benchmarks) : null;
            const grade = similarity != null ? getGrade(similarity) : null;
            const isSelected = selected?.id === pro.id;

            return (
              <TouchableOpacity
                key={pro.id}
                style={[
                  s.proCard,
                  { borderColor: isSelected ? sc + "77" : colors.border },
                  isSelected && { backgroundColor: sc + "08" },
                ]}
                activeOpacity={0.75}
                onPress={() => setSelected(isSelected ? null : pro)}
              >
                {/* Avatar */}
                <View style={[s.avatar, { backgroundColor: sc + "22" }]}>
                  <Text style={[s.avatarInitials, { color: sc }]}>{initials}</Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Text style={s.proName}>{pro.name}</Text>
                    <Text style={{ fontSize: 12 }}>{pro.countryFlag}</Text>
                  </View>
                  <Text style={s.proMeta}>{pro.specialty}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <View style={[s.sportBadge, { backgroundColor: sc + "1a", paddingHorizontal: 7, paddingVertical: 2 }]}>
                      <Text style={[s.sportBadgeTxt, { color: sc }]}>{pro.sport}</Text>
                    </View>
                    {similarity != null && grade && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: grade.color + "1a" }}>
                        <Text style={{ fontSize: 9, color: grade.color, fontFamily: "Inter_600SemiBold" }}>
                          Grade {grade.letter}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Similarity badge or chevron */}
                {similarity != null && grade ? (
                  <View style={[s.simBadge, { backgroundColor: grade.color + "15" }]}>
                    <Text style={[s.simNum, { color: grade.color }]}>{similarity}%</Text>
                    <Text style={[s.simLabel, { color: grade.color + "aa" }]}>match</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: "center", gap: 3 }}>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                    <Text style={{ fontSize: 8, color: colors.mutedForeground + "aa", fontFamily: "Inter_400Regular" }}>no data</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
