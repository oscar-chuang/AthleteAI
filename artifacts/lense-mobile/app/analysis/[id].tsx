import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

import { useColors } from "@/hooks/useColors";
import {
  analyses as analysesApi,
  type AnalysisRecord,
  type TipRecord,
  type RiskRecord,
} from "@/lib/api";
import { ScoreRing } from "@/components/ScoreRing";
import { ScoreCard, getScoreBand } from "@/components/analysis/ScoreCard";
import { SectionHeader } from "@/components/analysis/SectionHeader";
import { InsightCard } from "@/components/analysis/InsightCard";
import { CoachTakeawayCard } from "@/components/analysis/CoachTakeawayCard";
import { NextFocusCard } from "@/components/analysis/NextFocusCard";
import { AnimatedLoadingState } from "@/components/analysis/AnimatedLoadingState";
import { ShareCard } from "@/components/analysis/ShareCard";

const PENDING_CHAT_KEY = "pendingChatMessage";

const SCORE_KEYS = [
  "technique",
  "power",
  "balance",
  "consistency",
  "mobility",
  "speed",
] as const;

const SCORE_META: Record<
  (typeof SCORE_KEYS)[number],
  { icon: React.ComponentProps<typeof Feather>["name"]; desc: string }
> = {
  technique: {
    icon: "target",
    desc: "How closely your form matches ideal movement patterns for your sport",
  },
  power: {
    icon: "zap",
    desc: "The strength and explosiveness behind your movements",
  },
  balance: {
    icon: "activity",
    desc: "How stable and controlled you are through each movement",
  },
  consistency: {
    icon: "refresh-cw",
    desc: "How repeatable your technique is from rep to rep",
  },
  mobility: {
    icon: "maximize-2",
    desc: "Your range of motion and flexibility in key joints",
  },
  speed: {
    icon: "wind",
    desc: "How quickly and efficiently you execute movements",
  },
};

const SEVERITY_CONFIG = {
  info: { color: "#38bdf8", icon: "info" as const, label: "Info" },
  warning: {
    color: "#f59e0b",
    icon: "alert-triangle" as const,
    label: "Warning",
  },
  critical: {
    color: "#ef4444",
    icon: "alert-circle" as const,
    label: "Critical",
  },
};

const RISK_LABEL: Record<string, { label: string; color: string }> = {
  low:      { label: "Low Risk",      color: "#22c55e" },
  moderate: { label: "Moderate Risk", color: "#f59e0b" },
  high:     { label: "High Risk",     color: "#ef4444" },
};

const JOINT_LABEL: Record<string, string> = {
  leftKnee:   "Left Knee",
  rightKnee:  "Right Knee",
  leftHip:    "Left Hip",
  rightHip:   "Right Hip",
  leftElbow:  "Left Elbow",
  rightElbow: "Right Elbow",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function scoreForKey(
  analysis: AnalysisRecord,
  key: (typeof SCORE_KEYS)[number]
): number {
  return (analysis as any)[`${key}Score`] ?? 0;
}

function getRiskLabel(pct: number) {
  if (pct >= 50) return RISK_LABEL.high;
  if (pct >= 30) return RISK_LABEL.moderate;
  return RISK_LABEL.low;
}

// ── Animated risk bar ──────────────────────────────────────────────────────────
function AnimatedRiskBar({
  pct,
  color,
  delay = 0,
}: {
  pct: number;
  color: string;
  delay?: number;
}) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 600,
      delay,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <View style={{ height: 7, backgroundColor: color + "22", borderRadius: 4, marginVertical: 8 }}>
      <Animated.View
        style={{
          height: 7,
          borderRadius: 4,
          backgroundColor: color,
          width: widthAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </View>
  );
}

// ── Press-scale button wrapper ─────────────────────────────────────────────────
function ScaleButton({
  onPress,
  style,
  children,
  activeOpacity = 0.75,
}: {
  onPress: () => void;
  style?: object;
  children: React.ReactNode;
  activeOpacity?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
    }).start();

  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
    }).start();

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={activeOpacity}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Error / state screens ──────────────────────────────────────────────────────
function StateScreen({
  icon,
  iconColor,
  heading,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  iconColor: string;
  heading: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 36,
        gap: 0,
      }}
    >
      <View
        style={{
          width: 68,
          height: 68,
          borderRadius: 34,
          backgroundColor: iconColor + "18",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Feather name={icon} size={30} color={iconColor} />
      </View>
      <Text
        style={{
          fontSize: 19,
          fontFamily: "Inter_700Bold",
          color: colors.foreground,
          textAlign: "center",
          marginBottom: 10,
        }}
      >
        {heading}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: colors.mutedForeground,
          fontFamily: "Inter_400Regular",
          textAlign: "center",
          lineHeight: 21,
          marginBottom: 28,
        }}
      >
        {body}
      </Text>
      <ScaleButton
        onPress={onPrimary}
        style={{
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: 7,
          backgroundColor: colors.primary,
          borderRadius: 14,
          paddingVertical: 13,
          paddingHorizontal: 26,
          marginBottom: 14,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 15,
            fontFamily: "Inter_600SemiBold",
          }}
        >
          {primaryLabel}
        </Text>
      </ScaleButton>
      {secondaryLabel && onSecondary && (
        <TouchableOpacity onPress={onSecondary} activeOpacity={0.7}>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_500Medium",
              fontSize: 13,
            }}
          >
            {secondaryLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null);
  const [tips, setTips] = useState<TipRecord[]>([]);
  const [risks, setRisks] = useState<RiskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedTip, setExpanded] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"scores" | "tips" | "risks">(
    "scores"
  );
  const [showGuide, setShowGuide] = useState(false);
  const [note, setNote] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [pollExhausted, setPollExhausted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<View>(null);

  // Hero fade-in
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslate = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!loading && analysis) {
      Animated.parallel([
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(heroTranslate, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, analysis]);

  // Load persisted note
  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(`note_${id}`).then((saved) => {
      if (saved) setNote(saved);
    });
  }, [id]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  async function handleAskCoach() {
    if (!analysis) return;
    const worst = SCORE_KEYS.map((k) => ({
      key: k,
      score: scoreForKey(analysis, k),
    })).sort((a, b) => a.score - b.score)[0];
    const msg = `I just reviewed my "${analysis.title}" (${analysis.sport}) session. My overall score was ${Math.round(analysis.overallScore ?? 0)}/100. My weakest area is ${worst?.key ?? "technique"} (${Math.round(worst?.score ?? 0)}). What's the single most impactful thing I can do to improve?`;
    await AsyncStorage.setItem(PENDING_CHAT_KEY, msg);
    router.push("/(tabs)/chat" as any);
  }

  async function handleShare() {
    if (!analysis || sharing) return;
    setSharing(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Sharing not available", "Your device doesn't support sharing.");
        return;
      }
      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share your session",
      });
    } catch {
      Alert.alert("Couldn't share", "Something went wrong. Please try again.");
    } finally {
      setSharing(false);
    }
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Poll while processing
  const isProcessing =
    !!analysis &&
    analysis.status !== "complete" &&
    analysis.status !== "failed";
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

  // ── Loading ──
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AnimatedLoadingState />
      </View>
    );
  }

  // ── Error ──
  if (error || !analysis) {
    return (
      <StateScreen
        icon="wifi-off"
        iconColor={colors.destructive}
        heading="Couldn't load analysis"
        body="We couldn't fetch this session. Check your connection and try again."
        primaryLabel="Try again"
        onPrimary={() => { setLoading(true); setError(false); load(); }}
        secondaryLabel="Go back"
        onSecondary={() => router.back()}
      />
    );
  }

  // ── Processing / pending ──
  if (analysis.status === "processing" || analysis.status === "pending") {
    if (pollExhausted) {
      return (
        <StateScreen
          icon="clock"
          iconColor={colors.warning}
          heading="Taking longer than usual"
          body="Your analysis is still processing in the background. You can check again or come back in a moment."
          primaryLabel="Check again"
          onPrimary={() => { setPollExhausted(false); load(); }}
          secondaryLabel="Go back"
          onSecondary={() => router.back()}
        />
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AnimatedLoadingState />
      </View>
    );
  }

  // ── Failed ──
  if (analysis.status === "failed") {
    return (
      <StateScreen
        icon="x-circle"
        iconColor={colors.destructive}
        heading="Analysis failed"
        body="Something went wrong processing your video. Please try uploading a new clip — shorter clips (under 60s) tend to work best."
        primaryLabel="Go back"
        onPrimary={() => router.back()}
      />
    );
  }

  // ── Derived values ──
  const overallScore = analysis.overallScore ?? 0;

  const rankedScores = SCORE_KEYS.map((k) => ({
    key: k,
    score: scoreForKey(analysis, k),
  })).sort((a, b) => a.score - b.score);

  const worstMetric = rankedScores[0];
  const bestMetric = rankedScores[rankedScores.length - 1];

  const sortedTips = [...tips].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
  });

  const topTip = sortedTips[0];

  // Auto-expand top tip (critical/warning)
  const defaultExpandedId =
    expandedTip === null
      ? (sortedTips.find((t) => t.severity === "critical" || t.severity === "warning")?.id ?? sortedTips[0]?.id ?? null)
      : expandedTip;

  const firstDrill = tips.find((t) => t.drill)?.drill;

  // Summary: first 1–2 sentences from the first tip description
  const summaryText = (() => {
    if (!topTip) return null;
    const sentences = topTip.description.split(/(?<=\.)\s+/);
    return sentences.slice(0, 2).join(" ");
  })();

  const sportLabel =
    analysis.sport.charAt(0).toUpperCase() + analysis.sport.slice(1);

  const overallBand = getScoreBand(overallScore);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Navigation header ── */}
      <View
        style={[
          styles.navBar,
          {
            paddingTop: topPad + 4,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.navBtn}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
          <Text
            style={[styles.navBtnText, { color: colors.foreground }]}
          >
            Back
          </Text>
        </TouchableOpacity>

        <View style={styles.navCenter}>
          <View
            style={[
              styles.sportBadge,
              { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" },
            ]}
          >
            <Text style={[styles.sportBadgeText, { color: colors.primary }]}>
              {sportLabel}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <TouchableOpacity
            onPress={handleShare}
            activeOpacity={0.7}
            disabled={sharing}
            accessibilityRole="button"
            accessibilityLabel="Share analysis"
            style={{ padding: 6 }}
          >
            {sharing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="share-2" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>

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
      </View>

      {/* Hidden off-screen share card — captured by react-native-view-shot */}
      <View
        ref={shareCardRef}
        collapsable={false}
        style={{
          position: "absolute",
          top:      -9999,
          left:     -9999,
        }}
      >
        <ShareCard analysis={analysis} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* ── Hero card ── */}
        <Animated.View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: heroOpacity,
              transform: [{ translateY: heroTranslate }],
              overflow: "hidden",
            },
          ]}
        >
          {/* Thumbnail banner — shown when a pose-frame thumbnail is available */}
          {!!analysis.thumbnailUrl && (
            <Image
              source={{ uri: analysis.thumbnailUrl }}
              style={styles.heroThumbnail}
              contentFit="cover"
              transition={200}
            />
          )}

          {/* Title + meta */}
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            {analysis.title}
          </Text>
          <Text style={[styles.heroMeta, { color: colors.mutedForeground }]}>
            {analysis.duration ? `${analysis.duration}s · ` : ""}
            {formatDate(analysis.uploadedAt)}
          </Text>

          {/* Score ring + stats */}
          <View style={styles.heroScoreRow}>
            <View style={styles.ringWrap}>
              <ScoreRing
                score={overallScore}
                size={100}
                strokeWidth={8}
                color={overallBand.color}
                label="OVERALL"
              />
            </View>

            <View style={styles.heroStats}>
              {/* Best / worst */}
              <View style={[styles.statChip, { backgroundColor: colors.success + "12", borderColor: colors.success + "33" }]}>
                <Feather name="trending-up" size={11} color={colors.success} />
                <Text style={[styles.statChipLabel, { color: colors.mutedForeground }]}>Best</Text>
                <Text style={[styles.statChipValue, { color: colors.success }]}>
                  {bestMetric.key.charAt(0).toUpperCase() + bestMetric.key.slice(1)} · {Math.round(bestMetric.score)}
                </Text>
              </View>

              <View style={[styles.statChip, { backgroundColor: colors.warning + "12", borderColor: colors.warning + "33" }]}>
                <Feather name="arrow-up-circle" size={11} color={colors.warning} />
                <Text style={[styles.statChipLabel, { color: colors.mutedForeground }]}>Improve</Text>
                <Text style={[styles.statChipValue, { color: colors.warning }]}>
                  {worstMetric.key.charAt(0).toUpperCase() + worstMetric.key.slice(1)} · {Math.round(worstMetric.score)}
                </Text>
              </View>

              {/* AI summary snippet */}
              {summaryText && (
                <View style={[styles.summaryBox, { backgroundColor: colors.primary + "0a", borderColor: colors.primary + "22" }]}>
                  <Feather name="message-circle" size={11} color={colors.primary} style={{ marginTop: 1 }} />
                  <Text style={[styles.summaryText, { color: colors.mutedForeground }]} numberOfLines={3}>
                    {summaryText}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Score guide toggle */}
          <TouchableOpacity
            onPress={() => setShowGuide((v) => !v)}
            style={styles.guideToggle}
            activeOpacity={0.7}
          >
            <Feather name="info" size={13} color={colors.mutedForeground} />
            <Text style={[styles.guideToggleText, { color: colors.mutedForeground }]}>
              What do these scores mean?
            </Text>
            <Feather
              name={showGuide ? "chevron-up" : "chevron-down"}
              size={12}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>

          {showGuide && (
            <View style={[styles.guideBox, { backgroundColor: colors.muted }]}>
              <Text style={[styles.guideBoxLabel, { color: colors.mutedForeground }]}>
                Score bands
              </Text>
              {[
                { label: "Strong", color: "#22c55e", range: "80–100", note: "Keep it up" },
                { label: "On Track", color: "#6c63ff", range: "65–79", note: "Room to grow" },
                { label: "Focus Here", color: "#f59e0b", range: "0–64", note: "Prioritise this" },
              ].map((b) => (
                <View key={b.label} style={styles.guideBandRow}>
                  <View style={[styles.guideDot, { backgroundColor: b.color }]} />
                  <Text style={[styles.guideBandLabel, { color: b.color }]}>
                    {b.label}
                  </Text>
                  <Text style={[styles.guideBandRange, { color: colors.mutedForeground }]}>
                    {b.range} — {b.note}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* CTA buttons */}
          <View style={styles.ctaRow}>
            <ScaleButton
              onPress={() =>
                router.push(`/analysis/person-select/${id}` as any)
              }
              style={[
                styles.ctaBtn,
                {
                  backgroundColor: colors.primary + "18",
                  borderColor: colors.primary + "55",
                },
              ]}
            >
              <Feather name="user" size={15} color={colors.primary} />
              <Text style={[styles.ctaBtnText, { color: colors.primary }]}>
                Skeleton
              </Text>
            </ScaleButton>

            <ScaleButton
              onPress={handleAskCoach}
              style={[
                styles.ctaBtn,
                {
                  backgroundColor: colors.success + "18",
                  borderColor: colors.success + "55",
                },
              ]}
            >
              <Feather name="message-circle" size={15} color={colors.success} />
              <Text style={[styles.ctaBtnText, { color: colors.success }]}>
                Ask Coach
              </Text>
            </ScaleButton>
          </View>
        </Animated.View>

        {/* ── Score grid (2 × 3) ── */}
        <View style={styles.sectionWrap}>
          <SectionHeader
            title="Performance Breakdown"
            icon="bar-chart-2"
            accentColor={colors.primary}
          />
          <View style={styles.scoreGrid}>
            {SCORE_KEYS.map((key, i) => (
              <View key={key} style={styles.scoreGridCell}>
                <ScoreCard
                  label={key}
                  score={scoreForKey(analysis, key)}
                  icon={SCORE_META[key].icon}
                  desc={SCORE_META[key].desc}
                  delay={i * 60}
                />
              </View>
            ))}
          </View>
        </View>

        {/* ── Coach Takeaway ── */}
        <CoachTakeawayCard
          worstMetric={
            worstMetric.key.charAt(0).toUpperCase() + worstMetric.key.slice(1)
          }
          worstScore={worstMetric.score}
          topTipTitle={topTip?.title}
        />

        {/* ── Tabs ── */}
        <View
          style={[
            styles.tabRow,
            { backgroundColor: colors.card },
          ]}
        >
          {(["scores", "tips", "risks"] as const).map((tab) => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  active && { backgroundColor: colors.primary },
                ]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: active ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  {tab === "scores"
                    ? "Highlights"
                    : tab === "risks"
                    ? "Injury Risk"
                    : "Tips"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Highlights tab ── */}
        {activeTab === "scores" && (
          <View style={styles.sectionWrap}>
            {/* What you did well */}
            <SectionHeader
              title="What you did well"
              icon="check-circle"
              accentColor={colors.success}
            />
            {(analysis.strengths ?? []).length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No strengths recorded
              </Text>
            ) : (
              (analysis.strengths ?? []).map((str, i) => (
                <InsightCard
                  key={i}
                  text={str}
                  variant="strength"
                  reinforcement={
                    i === 0 ? "Nice work — you're strong here" : undefined
                  }
                />
              ))
            )}

            <View style={styles.sectionGap} />

            {/* What needs work */}
            <SectionHeader
              title="What needs work"
              icon="alert-circle"
              accentColor={colors.warning}
            />
            {(analysis.improvements ?? []).length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No areas flagged
              </Text>
            ) : (
              (analysis.improvements ?? []).map((imp, i) => (
                <InsightCard key={i} text={imp} variant="weakness" />
              ))
            )}

            {/* Biggest fix */}
            {worstMetric && (
              <>
                <View style={styles.sectionGap} />
                <SectionHeader
                  title="Biggest fix"
                  icon="zap"
                  accentColor={colors.primary}
                />
                <InsightCard
                  text={`Your ${worstMetric.key} score is ${Math.round(worstMetric.score)}/100 — this is your highest-leverage improvement area. ${SCORE_META[worstMetric.key].desc}.`}
                  variant="highlight"
                  reinforcement="Your biggest opportunity is here"
                />
              </>
            )}

            {/* Recommended drill */}
            {firstDrill && (
              <>
                <View style={styles.sectionGap} />
                <SectionHeader
                  title="Recommended drill"
                  icon="activity"
                  accentColor="#22c55e"
                />
                <View
                  style={[
                    styles.drillHighlight,
                    {
                      backgroundColor: colors.success + "0e",
                      borderColor: colors.success + "33",
                    },
                  ]}
                >
                  <Text
                    style={[styles.drillHighlightName, { color: colors.foreground }]}
                  >
                    {firstDrill.name}
                  </Text>
                  <Text
                    style={[
                      styles.drillHighlightMeta,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {firstDrill.sets} · {firstDrill.reps}
                  </Text>
                  {firstDrill.cue ? (
                    <Text
                      style={[
                        styles.drillHighlightCue,
                        { color: colors.foreground },
                      ]}
                    >
                      "{firstDrill.cue}"
                    </Text>
                  ) : null}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Tips tab ── */}
        {activeTab === "tips" && (
          <View style={styles.sectionWrap}>
            {sortedTips.length === 0 ? (
              <Text
                style={[
                  styles.emptyText,
                  { color: colors.mutedForeground, textAlign: "center", paddingVertical: 24 },
                ]}
              >
                No coaching tips available
              </Text>
            ) : (
              sortedTips.map((tip, idx) => {
                const cfg =
                  SEVERITY_CONFIG[
                    tip.severity as keyof typeof SEVERITY_CONFIG
                  ] ?? SEVERITY_CONFIG.info;
                const expanded =
                  expandedTip === null
                    ? idx === 0
                    : expandedTip === tip.id;

                // "Why it matters" — first sentence of description
                const whyText =
                  tip.whyItMatters ??
                  tip.description.split(/(?<=\.)\s+/)[0] ??
                  "";

                return (
                  <TouchableOpacity
                    key={tip.id}
                    style={[
                      styles.tipCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: cfg.color + "44",
                      },
                    ]}
                    activeOpacity={0.85}
                    onPress={() =>
                      setExpanded(expanded ? `__none_${tip.id}` : tip.id)
                    }
                  >
                    <View style={styles.tipHeader}>
                      <View
                        style={[
                          styles.tipIconWrap,
                          { backgroundColor: cfg.color + "18" },
                        ]}
                      >
                        <Feather name={cfg.icon} size={14} color={cfg.color} />
                      </View>
                      <View style={styles.tipTitleBlock}>
                        <Text
                          style={[
                            styles.tipTitle,
                            { color: colors.foreground },
                          ]}
                        >
                          {tip.title}
                        </Text>
                        <View style={styles.tipBadgeRow}>
                          <View
                            style={[
                              styles.severityBadge,
                              { backgroundColor: cfg.color + "18" },
                            ]}
                          >
                            <Text
                              style={[
                                styles.severityBadgeText,
                                { color: cfg.color },
                              ]}
                            >
                              {cfg.label}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.tipCategory,
                              { color: colors.mutedForeground },
                            ]}
                          >
                            {tip.category}
                          </Text>
                        </View>
                      </View>
                      <Feather
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={colors.mutedForeground}
                      />
                    </View>

                    {expanded && (
                      <View style={styles.tipBody}>
                        {/* Video observation */}
                        {tip.videoObservation && (
                          <View
                            style={[
                              styles.observationBox,
                              {
                                backgroundColor: colors.primary + "12",
                                borderColor: colors.primary + "33",
                              },
                            ]}
                          >
                            <Feather
                              name="eye"
                              size={13}
                              color={colors.primary}
                              style={{ marginTop: 1 }}
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.observationLabel,
                                  { color: colors.primary },
                                ]}
                              >
                                Observed in your video
                              </Text>
                              <Text
                                style={[
                                  styles.observationText,
                                  { color: colors.foreground },
                                ]}
                              >
                                {tip.videoObservation}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Why it matters */}
                        {whyText.length > 0 && (
                          <View
                            style={[
                              styles.whyBox,
                              {
                                backgroundColor: cfg.color + "0a",
                                borderLeftColor: cfg.color,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.whyLabel,
                                { color: cfg.color },
                              ]}
                            >
                              WHY IT MATTERS
                            </Text>
                            <Text
                              style={[
                                styles.whyText,
                                { color: colors.foreground },
                              ]}
                            >
                              {whyText}
                            </Text>
                          </View>
                        )}

                        {/* Full description */}
                        <Text
                          style={[
                            styles.tipDesc,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {tip.description}
                        </Text>

                        {/* Joint chips */}
                        {(tip.joints?.length ?? 0) > 0 && (
                          <View style={styles.chipRow}>
                            {tip.joints!.map((j) => (
                              <TouchableOpacity
                                key={j}
                                style={[
                                  styles.chip,
                                  {
                                    borderColor: cfg.color + "55",
                                    backgroundColor: cfg.color + "12",
                                  },
                                ]}
                                onPress={() =>
                                  router.push({
                                    pathname: "/analysis/skeleton/[id]",
                                    params: { id: id!, highlightJoint: j },
                                  } as any)
                                }
                                activeOpacity={0.7}
                              >
                                <View
                                  style={[
                                    styles.chipDot,
                                    { backgroundColor: cfg.color },
                                  ]}
                                />
                                <Text
                                  style={[
                                    styles.chipText,
                                    { color: cfg.color },
                                  ]}
                                >
                                  {JOINT_LABEL[j] ?? j}
                                </Text>
                                <Feather
                                  name="crosshair"
                                  size={9}
                                  color={cfg.color}
                                  style={{ opacity: 0.6 }}
                                />
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}

                        {/* Drill */}
                        {tip.drill && (
                          <View
                            style={[
                              styles.drillBox,
                              {
                                backgroundColor: colors.success + "0e",
                                borderColor: colors.success + "33",
                              },
                            ]}
                          >
                            <View style={styles.drillHeaderRow}>
                              <Feather
                                name="activity"
                                size={12}
                                color={colors.success}
                              />
                              <Text
                                style={[
                                  styles.drillLabel,
                                  { color: colors.success },
                                ]}
                              >
                                HOW TO FIX IT — DRILL
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.drillName,
                                { color: colors.foreground },
                              ]}
                            >
                              {typeof tip.drill === "string"
                                ? tip.drill
                                : tip.drill.name}
                            </Text>
                            {typeof tip.drill !== "string" && (
                              <Text
                                style={[
                                  styles.drillMeta,
                                  { color: colors.mutedForeground },
                                ]}
                              >
                                {tip.drill.sets} · {tip.drill.reps}
                                {tip.drill.cue
                                  ? ` — ${tip.drill.cue}`
                                  : ""}
                              </Text>
                            )}
                          </View>
                        )}

                        {/* Source */}
                        {tip.source && (
                          <View style={[styles.sourceRow, { borderTopColor: colors.border }]}>
                            <Feather
                              name="book-open"
                              size={10}
                              color={colors.mutedForeground}
                              style={{ marginTop: 2 }}
                            />
                            <Text
                              style={[
                                styles.sourceText,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              {tip.source}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ── Injury Risk tab ── */}
        {activeTab === "risks" && (
          <View style={styles.sectionWrap}>
            {risks.length === 0 ? (
              <View style={styles.noRiskWrap}>
                <View style={[styles.noRiskIcon, { backgroundColor: colors.success + "18" }]}>
                  <Feather name="shield" size={24} color={colors.success} />
                </View>
                <Text style={[styles.noRiskHeading, { color: colors.foreground }]}>
                  All clear
                </Text>
                <Text style={[styles.noRiskSub, { color: colors.mutedForeground }]}>
                  No significant injury risks detected in this session. Keep moving well!
                </Text>
              </View>
            ) : (
              risks.map((risk, idx) => {
                const clr = risk.riskPercent >= 50
                  ? colors.destructive
                  : risk.riskPercent >= 30
                  ? colors.warning
                  : colors.success;
                const rl = getRiskLabel(risk.riskPercent);
                return (
                  <View
                    key={risk.id}
                    style={[
                      styles.riskCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: clr + "33",
                      },
                    ]}
                  >
                    <View style={styles.riskHeaderRow}>
                      <Text style={[styles.riskJoint, { color: colors.foreground }]}>
                        {JOINT_LABEL[risk.joint] ?? risk.joint}
                      </Text>
                      <View style={styles.riskRightCol}>
                        <View
                          style={[
                            styles.riskBadge,
                            { backgroundColor: clr + "18" },
                          ]}
                        >
                          <Text style={[styles.riskBadgeText, { color: clr }]}>
                            {rl.label}
                          </Text>
                        </View>
                        <Text style={[styles.riskPct, { color: clr }]}>
                          {risk.riskPercent}%
                        </Text>
                      </View>
                    </View>

                    <AnimatedRiskBar pct={risk.riskPercent} color={clr} delay={idx * 80} />

                    {/* What this means */}
                    <View style={[styles.whatThisMeansBox, { backgroundColor: clr + "08", borderColor: clr + "22" }]}>
                      <Text style={[styles.whatThisMeansLabel, { color: clr }]}>
                        WHAT THIS MEANS
                      </Text>
                      <Text style={[styles.riskDesc, { color: colors.foreground }]}>
                        {risk.description}
                      </Text>
                    </View>

                    <Text style={[styles.riskPrev, { color: colors.mutedForeground }]}>
                      <Text style={[styles.prevLabel, { color: colors.primary }]}>
                        Prevention:{" "}
                      </Text>
                      {risk.prevention}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── Next Workout Focus ── */}
        <View style={[styles.sectionWrap, { paddingBottom: 0 }]}>
          <SectionHeader
            title="Next Workout Focus"
            icon="target"
            accentColor="#f59e0b"
          />
          <NextFocusCard
            focusCue={`Focus on improving your ${worstMetric.key} — ${SCORE_META[worstMetric.key].desc.toLowerCase()}`}
            drill={firstDrill}
            goal={`Raise your ${worstMetric.key} score from ${Math.round(worstMetric.score)} to ${Math.min(100, Math.round(worstMetric.score) + 10)} in your next session`}
          />
        </View>

        {/* ── Session Notes ── */}
        <View style={[styles.sectionWrap, { marginTop: 8, marginBottom: 32 }]}>
          <View style={styles.noteHeaderRow}>
            <Feather name="edit-3" size={15} color={colors.mutedForeground} />
            <Text style={[styles.noteTitle, { color: colors.foreground }]}>
              Session Notes
            </Text>
          </View>
          <TextInput
            style={[
              styles.noteInput,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            value={note}
            onChangeText={setNote}
            onBlur={() => id && AsyncStorage.setItem(`note_${id}`, note)}
            placeholder="Add personal notes — how you felt, what to focus on next time, any context about the session…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
          />
          {note.length > 0 && (
            <Text style={[styles.noteFooter, { color: colors.mutedForeground }]}>
              {note.length} chars · saved locally
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Nav
  navBar: {
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 6,
  },
  navBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  navCenter: { alignItems: "center" },
  sportBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
  },
  sportBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Hero
  heroCard: {
    margin: 16,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
  },
  heroThumbnail: {
    height: 160,
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: 14,
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
  },
  heroTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  heroMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
  },
  heroScoreRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    marginTop: 18,
  },
  ringWrap: { alignItems: "center" },
  heroStats: { flex: 1, gap: 8 },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statChipLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  statChipValue: { fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 },
  summaryBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
  },
  summaryText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    flex: 1,
  },
  guideToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 14,
    alignSelf: "flex-end",
  },
  guideToggleText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  guideBox: { borderRadius: 12, padding: 14, marginTop: 10, gap: 8 },
  guideBoxLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  guideBandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  guideDot: { width: 8, height: 8, borderRadius: 4 },
  guideBandLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", width: 74 },
  guideBandRange: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  ctaRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  ctaBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  ctaBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Score grid
  sectionWrap: { paddingHorizontal: 16, marginBottom: 16 },
  scoreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  scoreGridCell: { width: "48%", flexShrink: 1 },

  // Tabs
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 8,
  },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  // Highlights
  sectionGap: { height: 16 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  drillHighlight: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 4,
  },
  drillHighlightName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  drillHighlightMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  drillHighlightCue: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    marginTop: 6,
    lineHeight: 18,
  },

  // Tips
  tipCard: {
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  tipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  tipTitleBlock: { flex: 1 },
  tipTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tipBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  severityBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  severityBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  tipCategory: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tipBody: { paddingHorizontal: 14, paddingBottom: 14 },
  observationBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  observationLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  observationText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  whyBox: {
    borderLeftWidth: 3,
    borderRadius: 4,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 8,
    marginBottom: 10,
  },
  whyLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  whyText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  tipDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  drillBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
  },
  drillHeaderRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  drillLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  drillName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  drillMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  sourceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  sourceText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    flex: 1,
    fontStyle: "italic",
    lineHeight: 14,
  },

  // Risks
  noRiskWrap: { alignItems: "center", paddingVertical: 32, gap: 10 },
  noRiskIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  noRiskHeading: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  noRiskSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  riskCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  riskHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  riskJoint: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  riskRightCol: { alignItems: "flex-end", gap: 4 },
  riskBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  riskBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  riskPct: { fontSize: 20, fontFamily: "Inter_700Bold" },
  whatThisMeansBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  whatThisMeansLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  riskDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  riskPrev: { fontSize: 12, fontFamily: "Inter_400Regular" },
  prevLabel: { fontFamily: "Inter_500Medium" },

  // Notes
  noteHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  noteTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  noteInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    minHeight: 110,
  },
  noteFooter: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    textAlign: "right",
  },
});
