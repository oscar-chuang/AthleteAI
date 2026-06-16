import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColors } from "@/hooks/useColors";
import { analyses as analysesApi, type AnalysisRecord, type TipRecord, type RiskRecord } from "@/lib/api";

const PENDING_CHAT_KEY = "pendingChatMessage";

const SCORE_KEYS = ["technique", "power", "balance", "consistency", "mobility", "speed"] as const;

const SCORE_META: Record<typeof SCORE_KEYS[number], { icon: React.ComponentProps<typeof Feather>["name"]; desc: string }> = {
  technique:   { icon: "target",      desc: "How closely your form matches ideal movement patterns for your sport" },
  power:       { icon: "zap",         desc: "The strength and explosiveness behind your movements" },
  balance:     { icon: "activity",    desc: "How stable and controlled you are through each movement" },
  consistency: { icon: "refresh-cw",  desc: "How repeatable your technique is from rep to rep" },
  mobility:    { icon: "maximize-2",  desc: "Your range of motion and flexibility in key joints" },
  speed:       { icon: "wind",        desc: "How quickly and efficiently you execute movements" },
};

const SCORE_BANDS = [
  { min: 80, label: "Strong",     color: "#22c55e", note: "You're doing this well — keep it up" },
  { min: 65, label: "On Track",   color: "#6c63ff", note: "Solid foundation, room to grow" },
  { min: 0,  label: "Focus Here", color: "#f59e0b", note: "Prioritise improving this area" },
];

function getScoreBand(score: number) {
  return SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[2];
}

const SEVERITY_CONFIG = {
  info:     { color: "#38bdf8", icon: "info"          as const, label: "Info"     },
  warning:  { color: "#f59e0b", icon: "alert-triangle" as const, label: "Warning"  },
  critical: { color: "#ef4444", icon: "alert-circle"  as const, label: "Critical" },
};

const JOINT_LABEL: Record<string, string> = {
  leftKnee: "Left Knee", rightKnee: "Right Knee",
  leftHip: "Left Hip", rightHip: "Right Hip",
  leftElbow: "Left Elbow", rightElbow: "Right Elbow",
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
  const [activeTab, setActiveTab]   = useState<"scores" | "tips" | "risks">("scores");
  const [showGuide, setShowGuide]   = useState(false);
  const [note, setNote]             = useState("");
  const [deleting, setDeleting]     = useState(false);
  const [pollExhausted, setPollExhausted] = useState(false);

  // Load persisted note from local storage
  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(`note_${id}`).then((saved) => {
      if (saved) setNote(saved);
    });
  }, [id]);

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  async function handleAskCoach() {
    if (!analysis) return;
    const worst = SCORE_KEYS
      .map(k => ({ key: k, score: scoreForKey(analysis, k) }))
      .sort((a, b) => a.score - b.score)[0];
    const msg = `I just reviewed my "${analysis.title}" (${analysis.sport}) session. My overall score was ${Math.round(analysis.overallScore ?? 0)}/100. My weakest area is ${worst?.key ?? "technique"} (${Math.round(worst?.score ?? 0)}). What's the single most impactful thing I can do to improve?`;
    await AsyncStorage.setItem(PENDING_CHAT_KEY, msg);
    router.push("/(tabs)/chat" as any);
  }

  async function handleDelete() {
    Alert.alert(
      "Delete Analysis",
      "This will permanently remove this session and all its data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (deleting) return;
            setDeleting(true);
            try {
              await analysesApi.delete(id!);
              router.back();
            } catch {
              setDeleting(false);
              Alert.alert("Error", "Failed to delete. Please try again.");
            }
          },
        },
      ]
    );
  }

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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Poll while processing — capped at ~3 min so a stuck job can't drain the battery.
  const isProcessing =
    !!analysis && analysis.status !== "complete" && analysis.status !== "failed";
  useEffect(() => {
    if (!isProcessing || pollExhausted) return;
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      if (count > 45) {
        clearInterval(timer);
        setPollExhausted(true);
        return;
      }
      load();
    }, 4000);
    return () => clearInterval(timer);
  }, [isProcessing, pollExhausted, load]);

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
    if (pollExhausted) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 32 }}>
          <Feather name="clock" size={32} color={colors.warning} />
          <Text style={{ fontSize: 17, fontFamily: "Inter_600SemiBold", color: colors.foreground, textAlign: "center" }}>
            This is taking longer than usual
          </Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 }}>
            Your analysis is still processing. You can keep waiting or check back in a moment.
          </Text>
          <TouchableOpacity
            onPress={() => { setPollExhausted(false); load(); }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Check again"
            style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 22, marginTop: 4 }}
          >
            <Feather name="refresh-cw" size={15} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Check again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>Go back</Text>
          </TouchableOpacity>
        </View>
      );
    }
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
    heroTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    heroMeta:  { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 4, textTransform: "capitalize" },
    scoreRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
    overallCircle: {
      width: 72, height: 72, borderRadius: 36,
      borderWidth: 3, borderColor: colors.primary,
      backgroundColor: colors.primary + "20",
      alignItems: "center", justifyContent: "center",
    },
    overallNum:   { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.primary },
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
    chipRow:   { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
    chip:      { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
    chipDot:   { width: 6, height: 6, borderRadius: 3 },
    chipText:  { fontSize: 11, fontFamily: "Inter_600SemiBold" },
    riskCard:  { backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
    riskRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    riskJoint: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    riskPct:   { fontSize: 16, fontFamily: "Inter_700Bold" },
    riskBarBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginBottom: 8 },
    riskBarFill:{ height: 6, borderRadius: 3 },
    riskDesc:  { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 4 },
    riskPrev:  { fontSize: 12, color: colors.foreground, fontFamily: "Inter_400Regular" },
    prevLabel: { color: colors.primary, fontFamily: "Inter_500Medium" },
    noteInput: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      color: colors.foreground,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      lineHeight: 21,
      minHeight: 110,
    },
    noteFooter: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 6,
      textAlign: "right" as const,
    },
  });

  return (
    <View style={s.container}>
      {/* ── Navigation header ── */}
      <View style={{
        paddingTop: topPad + 4,
        paddingBottom: 10,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 6 }}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
          <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }} numberOfLines={1}>
          {analysis.sport.charAt(0).toUpperCase() + analysis.sport.slice(1)} · {Math.round(analysis.overallScore ?? 0)}
        </Text>
        <TouchableOpacity
          onPress={handleDelete}
          activeOpacity={0.7}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Delete analysis"
          style={{ padding: 6 }}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={colors.destructive} />
          ) : (
            <Feather name="trash-2" size={18} color={colors.destructive} />
          )}
        </TouchableOpacity>
      </View>

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
                const band = getScoreBand(score);
                return (
                  <View key={key} style={s.scoreMiniRow}>
                    <Text style={s.scoreMiniLabel}>{key}</Text>
                    <View style={s.scoreMiniBarBg}>
                      <View style={[s.scoreMiniBarFill, { width: `${score}%` as any, backgroundColor: band.color }]} />
                    </View>
                    <Text style={[s.scoreMiniNum, { color: band.color }]}>{Math.round(score)}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Score guide toggle */}
          <TouchableOpacity
            onPress={() => setShowGuide((v) => !v)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, alignSelf: "flex-end" }}
            activeOpacity={0.7}
          >
            <Feather name="info" size={13} color={colors.mutedForeground} />
            <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
              What do these scores mean?
            </Text>
            <Feather name={showGuide ? "chevron-up" : "chevron-down"} size={12} color={colors.mutedForeground} />
          </TouchableOpacity>

          {showGuide && (
            <View style={{ marginTop: 12, backgroundColor: colors.muted, borderRadius: 10, padding: 14, gap: 10 }}>
              {/* Score band key */}
              <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Score bands</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                {SCORE_BANDS.map((b) => (
                  <View key={b.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: b.color }} />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: b.color }}>{b.label}</Text>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>({b.min === 0 ? "<65" : b.min === 65 ? "65–79" : "80–100"}) — {b.note}</Text>
                  </View>
                ))}
              </View>
              {/* Per-metric explanations */}
              <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, marginTop: 4 }}>What each score measures</Text>
              {SCORE_KEYS.map((key) => {
                const meta = SCORE_META[key];
                const band = getScoreBand(scoreForKey(analysis, key));
                return (
                  <View key={key} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <Feather name={meta.icon} size={13} color={band.color} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground, textTransform: "capitalize" }}>{key}</Text>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 16 }}>{meta.desc}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: 7, backgroundColor: colors.primary + "18",
                borderRadius: 12, borderWidth: 1, borderColor: colors.primary + "55", paddingVertical: 12,
              }}
              activeOpacity={0.75}
              onPress={() => router.push(`/analysis/person-select/${id}` as any)}
            >
              <Feather name="user" size={15} color={colors.primary} />
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.primary }}>
                Skeleton
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: 7, backgroundColor: colors.success + "18",
                borderRadius: 12, borderWidth: 1, borderColor: colors.success + "55", paddingVertical: 12,
              }}
              activeOpacity={0.75}
              onPress={handleAskCoach}
            >
              <Feather name="message-circle" size={15} color={colors.success} />
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.success }}>
                Ask Coach
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.tabRow}>
          {(["scores", "tips", "risks"] as const).map((tab) => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[s.tab, active && { backgroundColor: colors.primary }]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[s.tabText, { color: active ? "#fff" : colors.mutedForeground, textTransform: "capitalize" }]}>
                  {tab === "scores" ? "Highlights" : tab === "risks" ? "Injury Risk" : "Tips"}
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
                      {tip.videoObservation && (
                        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: colors.primary + "12", borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.primary + "33" }}>
                          <Feather name="eye" size={13} color={colors.primary} style={{ marginTop: 1 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 9, color: colors.primary, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>
                              Observed in your video
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.foreground, fontFamily: "Inter_400Regular", lineHeight: 17 }}>
                              {tip.videoObservation}
                            </Text>
                          </View>
                        </View>
                      )}
                      <Text style={s.tipDesc}>{tip.description}</Text>
                      {(tip.joints?.length ?? 0) > 0 && (
                        <View style={s.chipRow}>
                          {tip.joints!.map((j) => (
                            <TouchableOpacity
                              key={j}
                              style={[s.chip, { borderColor: cfg.color + "55", backgroundColor: cfg.color + "12" }]}
                              onPress={() =>
                                router.push({
                                  pathname: "/analysis/skeleton/[id]",
                                  params: { id: id!, highlightJoint: j },
                                } as any)
                              }
                              activeOpacity={0.7}
                            >
                              <View style={[s.chipDot, { backgroundColor: cfg.color }]} />
                              <Text style={[s.chipText, { color: cfg.color }]}>{JOINT_LABEL[j] ?? j}</Text>
                              <Feather name="crosshair" size={9} color={cfg.color} style={{ opacity: 0.6 }} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      {tip.drill && (
                        <View style={s.drillBox}>
                          <Text style={s.drillLabel}>Drill</Text>
                          <Text style={s.drillText}>{tip.drill}</Text>
                        </View>
                      )}
                      {tip.source && (
                        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                          <Feather name="book-open" size={10} color={colors.mutedForeground} style={{ marginTop: 2 }} />
                          <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular", flex: 1, fontStyle: "italic", lineHeight: 14 }}>
                            {tip.source}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
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

        {/* ── Session Notes ── */}
        <View style={[s.section, { marginTop: 8, marginBottom: 32 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Feather name="edit-3" size={15} color={colors.mutedForeground} />
            <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
              Session Notes
            </Text>
          </View>
          <TextInput
            style={s.noteInput}
            value={note}
            onChangeText={setNote}
            onBlur={() => id && AsyncStorage.setItem(`note_${id}`, note)}
            placeholder="Add personal notes — how you felt, what to focus on next time, any context about the session…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
          />
          {note.length > 0 && (
            <Text style={s.noteFooter}>{note.length} chars · saved locally</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
