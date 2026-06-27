import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { analyses as analysesApi, type AnalysisRecord, type TipRecord, type RiskRecord } from "@/lib/api";

const SCORE_KEYS = ["technique", "power", "balance", "consistency", "mobility", "speed"] as const;

const SEVERITY_CONFIG = {
  info:     { color: "#38bdf8", icon: "info"          as const, label: "Info"     },
  warning:  { color: "#f59e0b", icon: "alert-triangle" as const, label: "Warning"  },
  critical: { color: "#ef4444", icon: "alert-circle"  as const, label: "Critical" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function scoreForKey(analysis: AnalysisRecord, key: typeof SCORE_KEYS[number]): number {
  return (analysis as any)[`${key}Score`] ?? 0;
}

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [analysis, setAnalysis]     = useState<AnalysisRecord | null>(null);
  const [tips, setTips]             = useState<TipRecord[]>([]);
  const [risks, setRisks]           = useState<RiskRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [expandedTip, setExpanded]  = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<"scores" | "tips" | "risks" | "ai">("scores");

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { analysis: a, tips: t, injuryRisks: r } = await analysesApi.get(id);
      setAnalysis(a);
      setTips(t);
      setRisks(r);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Poll while processing
  useEffect(() => {
    if (!analysis || analysis.status === "complete" || analysis.status === "failed") return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [analysis, load]);

  function getScoreColor(score: number) {
    if (score >= 80) return colors.success;
    if (score >= 65) return colors.primary;
    return colors.warning;
  }

  function getRiskColor(pct: number) {
    if (pct >= 50) return colors.destructive;
    if (pct >= 30) return colors.warning;
    return colors.success;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error || !analysis) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Feather name="alert-circle" size={32} color={colors.destructive} />
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>Analysis not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Still processing — show a waiting screen
  if (analysis.status === "processing" || analysis.status === "pending") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ fontSize: 17, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
          Analyzing your video…
        </Text>
        <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }}>
          Our AI is reviewing your movement. This usually takes 10–30 seconds.
        </Text>
      </View>
    );
  }

  if (analysis.status === "failed") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 }}>
        <Feather name="x-circle" size={32} color={colors.destructive} />
        <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Analysis failed</Text>
        <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }}>
          Something went wrong processing your video. Please try uploading again.
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const overallScore = analysis.overallScore ?? 0;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    heroCard: {
      margin: 20,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroTitle: { fontSize: 22, fontFamily: "Archivo_800ExtraBold", color: colors.foreground, letterSpacing: -0.4 },
    heroMeta:  { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 4, textTransform: "capitalize" },
    scoreRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
    overallCircle: {
      width: 72, height: 72, borderRadius: 36,
      borderWidth: 3, borderColor: colors.primary,
      backgroundColor: colors.primary + "20",
      alignItems: "center", justifyContent: "center",
    },
    overallNum:   { fontSize: 26, fontFamily: "Archivo_800ExtraBold", color: colors.primary, letterSpacing: -0.5 },
    overallLabel: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    scoresMini:   { flex: 1, marginLeft: 16, gap: 6 },
    scoreMiniRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    scoreMiniLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", width: 78, textTransform: "capitalize" },
    scoreMiniBarBg: { flex: 1, height: 5, backgroundColor: colors.border, borderRadius: 2.5 },
    scoreMiniBarFill: { height: 5, borderRadius: 2.5 },
    scoreMiniNum: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.foreground, width: 28, textAlign: "right" },
    tabRow: {
      flexDirection: "row", marginHorizontal: 20, marginBottom: 16,
      backgroundColor: colors.card, borderRadius: 10, padding: 4,
    },
    tab:     { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
    tabText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    section: { paddingHorizontal: 20, marginBottom: 16 },
    listItem: { flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" },
    dot:      { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
    listText: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 20 },
    tipCard:   { backgroundColor: colors.card, borderRadius: colors.radius, marginBottom: 10, borderWidth: 1, overflow: "hidden" },
    tipHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
    tipTitle:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground, flex: 1 },
    tipBody:   { paddingHorizontal: 14, paddingBottom: 14 },
    tipDesc:   { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 19 },
    drillBox:  { marginTop: 10, backgroundColor: colors.muted, borderRadius: 8, padding: 10 },
    drillLabel:{ fontSize: 11, color: colors.primary, fontFamily: "Inter_600SemiBold", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
    drillText: { fontSize: 12, color: colors.foreground, fontFamily: "Inter_400Regular", lineHeight: 17 },
    riskCard:  { backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
    riskRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    riskJoint: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    riskPct:   { fontSize: 16, fontFamily: "Inter_700Bold" },
    riskBarBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginBottom: 8 },
    riskBarFill:{ height: 6, borderRadius: 3 },
    riskDesc:  { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 4 },
    riskPrev:  { fontSize: 12, color: colors.foreground, fontFamily: "Inter_400Regular" },
    prevLabel: { color: colors.primary, fontFamily: "Inter_500Medium" },
  });

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>
        <View style={s.heroCard}>
          <Text style={s.heroTitle}>{analysis.title}</Text>
          <Text style={s.heroMeta}>
            {analysis.sport}
            {analysis.duration ? ` · ${analysis.duration}s` : ""}
            {" · "}{formatDate(analysis.uploadedAt)}
          </Text>

          <View style={s.scoreRow}>
            <View style={s.overallCircle}>
              <Text style={s.overallNum}>{Math.round(overallScore)}</Text>
              <Text style={s.overallLabel}>SCORE</Text>
            </View>
            <View style={s.scoresMini}>
              {SCORE_KEYS.map((key) => {
                const score = scoreForKey(analysis, key);
                const clr = getScoreColor(score);
                return (
                  <View key={key} style={s.scoreMiniRow}>
                    <Text style={s.scoreMiniLabel}>{key}</Text>
                    <View style={s.scoreMiniBarBg}>
                      <View style={[s.scoreMiniBarFill, { width: `${score}%` as any, backgroundColor: clr }]} />
                    </View>
                    <Text style={s.scoreMiniNum}>{Math.round(score)}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center",
              gap: 8, marginTop: 16, backgroundColor: "rgba(255,255,255,0.06)",
              borderRadius: 12, borderWidth: 1, borderColor: colors.primary + "55", paddingVertical: 12,
            }}
            activeOpacity={0.75}
            onPress={() => router.push(`/analysis/skeleton/${id}`)}
          >
            <Feather name="user" size={16} color={colors.primary} />
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.primary }}>
              View Skeleton Overlay
            </Text>
            <Feather name="chevron-right" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={s.tabRow}>
          {(["scores", "tips", "risks", "ai"] as const).map((tab) => {
            const active = activeTab === tab;
            const label = tab === "scores" ? "Highlights" : tab === "risks" ? "Injury" : tab === "tips" ? "Tips" : "AI";
            return (
              <TouchableOpacity
                key={tab}
                style={[s.tab, active && { backgroundColor: colors.primary }]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[s.tabText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === "scores" && (
          <View style={s.section}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.success, marginBottom: 10 }}>
              Strengths
            </Text>
            {(analysis.strengths ?? []).map((str, i) => (
              <View key={i} style={s.listItem}>
                <View style={[s.dot, { backgroundColor: colors.success }]} />
                <Text style={s.listText}>{str}</Text>
              </View>
            ))}
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.warning, marginBottom: 10, marginTop: 8 }}>
              Areas to Improve
            </Text>
            {(analysis.improvements ?? []).map((imp, i) => (
              <View key={i} style={s.listItem}>
                <View style={[s.dot, { backgroundColor: colors.warning }]} />
                <Text style={s.listText}>{imp}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === "tips" && (
          <View style={s.section}>
            {tips.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 24 }}>
                No coaching tips available
              </Text>
            ) : tips.map((tip) => {
              const cfg = SEVERITY_CONFIG[tip.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
              const expanded = expandedTip === tip.id;
              return (
                <TouchableOpacity
                  key={tip.id}
                  style={[s.tipCard, { borderColor: cfg.color + "44" }]}
                  activeOpacity={0.8}
                  onPress={() => setExpanded(expanded ? null : tip.id)}
                >
                  <View style={s.tipHeader}>
                    <Feather name={cfg.icon} size={16} color={cfg.color} />
                    <Text style={s.tipTitle}>{tip.title}</Text>
                    <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                  </View>
                  {expanded && (
                    <View style={s.tipBody}>
                      <Text style={s.tipDesc}>{tip.description}</Text>
                      {tip.drill && (
                        <View style={s.drillBox}>
                          <Text style={s.drillLabel}>Drill</Text>
                          <Text style={s.drillText}>{tip.drill}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {activeTab === "ai" && (
          <View style={s.section}>
            {/* AI-generated performance narrative */}
            <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary + "22", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="cpu" size={14} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Atlas AI Analysis</Text>
                <View style={{ marginLeft: "auto" as any, backgroundColor: colors.primary + "22", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.5 }}>Claude AI</Text>
                </View>
              </View>
              <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 10 }}>
                {"Your "}{analysis.sport}{" session scored "}{Math.round(overallScore)}{"/100 overall. "}
                {overallScore >= 80
                  ? "This is an excellent performance — you're demonstrating strong athletic competency in most areas."
                  : overallScore >= 65
                  ? "This is a solid session with clear room to grow in targeted areas."
                  : "There are meaningful areas to address that will significantly improve your performance and safety."}
              </Text>
              <Text style={{ fontSize: 13, color: colors.foreground, fontFamily: "Inter_400Regular", lineHeight: 20 }}>
                {"Your strongest dimension is "}{
                  SCORE_KEYS.reduce((best, k) => scoreForKey(analysis, k) > scoreForKey(analysis, best) ? k : best, SCORE_KEYS[0])
                }{" and the area with the most improvement potential is "}{
                  SCORE_KEYS.reduce((worst, k) => scoreForKey(analysis, k) < scoreForKey(analysis, worst) ? k : worst, SCORE_KEYS[0])
                }{". "}
                {tips.length > 0 && `Atlas has identified ${tips.length} coaching tip${tips.length > 1 ? "s" : ""} and ${risks.length} injury risk factor${risks.length !== 1 ? "s" : ""} to address in your training.`}
              </Text>
            </View>

            {/* Key insight cards */}
            {tips.slice(0, 2).map((tip) => {
              const cfg = SEVERITY_CONFIG[tip.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
              return (
                <View key={tip.id} style={[s.tipCard, { borderColor: cfg.color + "44" }]}>
                  <View style={s.tipHeader}>
                    <Feather name={cfg.icon} size={14} color={cfg.color} />
                    <Text style={s.tipTitle}>{tip.title}</Text>
                    <Text style={{ fontSize: 10, color: cfg.color, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" }}>{cfg.label}</Text>
                  </View>
                  <View style={s.tipBody}>
                    <Text style={s.tipDesc}>{tip.description}</Text>
                    {tip.drill && (
                      <View style={s.drillBox}>
                        <Text style={s.drillLabel}>Drill</Text>
                        <Text style={s.drillText}>{tip.drill}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, marginTop: 4 }}
              activeOpacity={0.8}
              onPress={() => setActiveTab("tips")}
            >
              <Feather name="list" size={14} color={colors.primaryForeground} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.primaryForeground }}>See All {tips.length} Tips</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === "risks" && (
          <View style={s.section}>
            {risks.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 24 }}>
                No injury risks detected
              </Text>
            ) : risks.map((risk) => {
              const clr = getRiskColor(risk.riskPercent);
              return (
                <View key={risk.id} style={s.riskCard}>
                  <View style={s.riskRow}>
                    <Text style={s.riskJoint}>{risk.joint}</Text>
                    <Text style={[s.riskPct, { color: clr }]}>{risk.riskPercent}%</Text>
                  </View>
                  <View style={s.riskBarBg}>
                    <View style={[s.riskBarFill, { width: `${risk.riskPercent}%` as any, backgroundColor: clr }]} />
                  </View>
                  <Text style={s.riskDesc}>{risk.description}</Text>
                  <Text style={s.riskPrev}><Text style={s.prevLabel}>Prevention: </Text>{risk.prevention}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
