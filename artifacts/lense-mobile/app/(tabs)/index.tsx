import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Image,
  Animated,
  Easing,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useAuth, useTier } from "@/lib/authContext";
import { AvatarDisplay } from "@/app/profile-settings";
import {
  analyses as analysesApi,
  achievements as achievementsApi,
  profile as profileApi,
  type AnalysisRecord,
  type AchievementRecord,
  type ProfileStats,
} from "@/lib/api";
import { ConfettiBurst } from "@/components/ConfettiBurst";

const SCORE_KEYS = ["technique", "power", "balance", "consistency", "mobility", "speed"] as const;

const QUICK_ACTIONS: { label: string; icon: React.ComponentProps<typeof Feather>["name"]; route: string }[] = [
  { label: "Analyze Video", icon: "upload",         route: "/(tabs)/analyze"  },
  { label: "AI Coach",      icon: "message-circle", route: "/(tabs)/chat"     },
  { label: "Progress",      icon: "trending-up",    route: "/(tabs)/progress" },
  { label: "Compare",       icon: "users",          route: "/(tabs)/compare"  },
];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const STATUS_LABEL: Record<string, string> = {
  pending:    "Queued",
  uploading:  "Uploading…",
  processing: "Analysing…",
  complete:   "",
  failed:     "Could not analyse",
};

function getHour() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function getWorstMetric(a: AnalysisRecord): { key: string; score: number } | null {
  const scores = SCORE_KEYS
    .map(k => ({ key: k as string, score: (a as any)[`${k}Score`] as number ?? 0 }))
    .filter(s => s.score > 0);
  if (scores.length === 0) return null;
  return scores.sort((x, y) => x.score - y.score)[0]!;
}

function getWeekKey(): string {
  const d = new Date();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay()); // Sunday-start, matches thisWeekCount on server
  return sunday.toISOString().split("T")[0]!;
}

export default function HomeScreen() {
  const colors = useColors();
  const trophyScale = useRef(new Animated.Value(1)).current;
  const barWidthAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const tier = useTier();

  const [allAnalyses, setAllAnalyses]     = useState<AnalysisRecord[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisRecord[]>([]);
  const [achievements, setAchievements]   = useState<AchievementRecord[]>([]);
  const [stats, setStats]                 = useState<ProfileStats | null>(null);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState(false);
  const [showConfetti, setShowConfetti]   = useState(false);

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;

  const loadData = useCallback(async () => {
    setError(false);
    try {
      const [{ analyses }, { achievements: ach }, statsResult] = await Promise.all([
        analysesApi.list(),
        achievementsApi.list(),
        profileApi.stats().catch(() => null),
      ]);
      setAllAnalyses(analyses);
      setRecentAnalyses(analyses.slice(0, 3));
      setAchievements(ach);
      if (statsResult) setStats(statsResult);

      const currentWeekGoal = profile?.weeklyGoal ?? 3;
      if (currentWeekGoal > 0 && statsResult) {
        const currentCount = statsResult.thisWeekCount ?? 0;
        const weekKey      = getWeekKey();
        const celebratedKey = `confetti_celebrated_${weekKey}`;
        const pendingKey    = `confetti_pending_${weekKey}`;
        const prevCountKey  = `confetti_prev_count_${weekKey}`;
        const [celebrated, pending, prevCountStr] = await Promise.all([
          AsyncStorage.getItem(celebratedKey),
          AsyncStorage.getItem(pendingKey),
          AsyncStorage.getItem(prevCountKey),
        ]);
        const prevCount = prevCountStr !== null ? parseInt(prevCountStr, 10) : null;
        // Celebrate when:
        //   1. Not yet celebrated this week
        //   2. Current count has reached or passed the goal
        //   3. Either: an explicit pending flag was written by analyze.tsx on upload,
        //      OR the prevCount snapshot shows the threshold was just crossed
        const justCrossed =
          pending !== null ||
          (prevCount !== null && prevCount < currentWeekGoal);
        if (!celebrated && currentCount >= currentWeekGoal && justCrossed) {
          await Promise.all([
            AsyncStorage.setItem(celebratedKey, "true"),
            AsyncStorage.removeItem(pendingKey),
          ]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setShowConfetti(true);
        }
        await AsyncStorage.setItem(prevCountKey, String(currentCount));
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.weeklyGoal]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  function onRefresh() { setRefreshing(true); loadData(); }

  function getScoreColor(score: number) {
    if (score >= 80) return colors.success;
    if (score >= 65) return colors.primary;
    return colors.warning;
  }

  const latestComplete = recentAnalyses.find((a) => a.status === "complete");
  const overallScore   = latestComplete?.overallScore ?? null;
  const overallColor   = overallScore != null ? getScoreColor(overallScore) : colors.primary;

  const streakDays    = stats?.streak ?? 0;
  const thisWeek      = stats?.thisWeekCount ?? profile?.weeklyProgress ?? 0;
  const weeklyGoal    = profile?.weeklyGoal ?? 3;
  const weekPct       = Math.min((thisWeek / weeklyGoal) * 100, 100);
  const goalReached   = weeklyGoal > 0 && thisWeek >= weeklyGoal;
  const scoreDelta    = stats?.scoreDelta ?? null;

  const handleShareGoal = useCallback(async () => {
    const sport = profile?.sport ? ` (${profile.sport})` : "";
    const streakLine = streakDays > 1 ? ` ${streakDays}-day streak and counting!` : "";
    const message = `I hit my weekly training goal on AthleteAI! 🏆 ${thisWeek} session${thisWeek !== 1 ? "s" : ""} this week${sport}.${streakLine}`;
    try {
      await Share.share({ message });
    } catch {
      // user dismissed or share unavailable — no-op
    }
  }, [profile?.sport, thisWeek, streakDays]);

  useEffect(() => {
    if (!goalReached) return;
    const pulse = Animated.sequence([
      Animated.timing(trophyScale, { toValue: 1.35, duration: 220, useNativeDriver: true }),
      Animated.timing(trophyScale, { toValue: 0.9,  duration: 130, useNativeDriver: true }),
      Animated.timing(trophyScale, { toValue: 1.15, duration: 100, useNativeDriver: true }),
      Animated.timing(trophyScale, { toValue: 1.0,  duration: 80,  useNativeDriver: true }),
    ]);
    pulse.start();
  }, [goalReached, trophyScale]);

  useEffect(() => {
    Animated.timing(barWidthAnim, {
      toValue: weekPct,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [weekPct, barWidthAnim]);

  const animatedBarWidth = barWidthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalSessions = stats?.totalAnalyses ?? allAnalyses.length;

  const focusData = latestComplete ? getWorstMetric(latestComplete) : null;

  const todayStr = new Date().toISOString().split("T")[0]!;
  const lastSevenDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0]!;
  });
  const trainedDaysSet = new Set(allAnalyses.map(a => a.uploadedAt.split("T")[0]));
  const trainingDaysSet = new Set<number>(profile?.trainingDays ?? [0, 1, 2, 3, 4, 5, 6]);

  let insightMsg: string | null = null;
  let insightIcon: React.ComponentProps<typeof Feather>["name"] = "trending-up";
  let insightColor = colors.success;
  if (thisWeek >= weeklyGoal && weeklyGoal > 0) {
    insightMsg = `Weekly goal reached! ${thisWeek}/${weeklyGoal} sessions done — keep the momentum going.`;
    insightIcon = "check-circle"; insightColor = colors.success;
  } else if (scoreDelta != null && scoreDelta >= 8) {
    insightMsg = `Standout session! Your score jumped +${scoreDelta} pts — that's real progress.`;
    insightIcon = "trending-up"; insightColor = colors.success;
  } else if (scoreDelta != null && scoreDelta >= 2) {
    insightMsg = `Trending up! +${scoreDelta} pts since your last session.`;
    insightIcon = "trending-up"; insightColor = colors.primary;
  } else if (streakDays >= 3) {
    insightMsg = `${streakDays}-day training streak — consistency compounds into results.`;
    insightIcon = "zap"; insightColor = "#ff6b35";
  } else if (scoreDelta != null && scoreDelta < -5) {
    insightMsg = `Tough session. Open your AI tips to identify what to focus on next.`;
    insightIcon = "info"; insightColor = colors.warning;
  }

  const sportCounts: Record<string, number> = {};
  for (const a of allAnalyses) {
    const sp = a.sport || "other";
    sportCounts[sp] = (sportCounts[sp] ?? 0) + 1;
  }
  const topSports = Object.entries(sportCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const s = StyleSheet.create({
    container:      { flex: 1, backgroundColor: colors.background },
    scroll:         { flex: 1 },
    header:         { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 16 },
    headerRow:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    greeting:       { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", letterSpacing: 0.6, textTransform: "uppercase" },
    name:           { fontSize: 26, color: colors.foreground, fontFamily: "Inter_700Bold", marginTop: 2 },
    badgeRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" },
    badge:          { backgroundColor: colors.primary + "22", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText:      { color: colors.primary, fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
    streakBadge:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ff6b3522", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    streakText:     { fontSize: 12, fontFamily: "Inter_700Bold", color: "#ff6b35" },

    statsRow:       { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 20 },
    statCard:       { flex: 1, backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border },
    statValue:      { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.foreground },
    statLabel:      { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 },
    overallCircle:  { width: 56, height: 56, borderRadius: 28, borderWidth: 3, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    overallNum:     { fontSize: 20, fontFamily: "Inter_700Bold" },
    deltaRow:       { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
    deltaText:      { fontSize: 10, fontFamily: "Inter_600SemiBold" },

    focusCard:      { marginHorizontal: 20, marginBottom: 20, backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, borderWidth: 1, borderColor: colors.warning + "55" },
    insightBanner:  { marginHorizontal: 20, marginBottom: 20, borderRadius: colors.radius, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },

    quickGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20, marginBottom: 24 },
    quickBtn:       { width: "47%", backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 },
    quickIcon:      { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.primary + "1a", alignItems: "center", justifyContent: "center" },
    quickLabel:     { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, flex: 1 },

    section:        { paddingHorizontal: 20, marginBottom: 24 },
    sectionHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    sectionTitle:   { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    seeAll:         { fontSize: 13, color: colors.primary, fontFamily: "Inter_500Medium" },

    weeklyCard:         { backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, borderWidth: 1, borderColor: colors.border },
    weeklyCardGoal:     { backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, borderWidth: 2, borderColor: "#f59e0b" },
    weeklyRow:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    weeklyLabel:        { color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" },
    weeklyCount:        { color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" },
    weeklyDelta:        { fontSize: 11, fontFamily: "Inter_500Medium", marginLeft: 4 },
    progressBarBg:      { height: 6, backgroundColor: colors.border, borderRadius: 3 },
    progressBarFill:    { height: 6, borderRadius: 3, backgroundColor: colors.primary },
    goalBanner:         { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#f59e0b18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 12, borderWidth: 1, borderColor: "#f59e0b44" },
    goalBannerText:     { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#b45309", flex: 1 },
    goalBannerSub:      { fontSize: 11, fontFamily: "Inter_400Regular", color: "#92400e", marginTop: 1 },
    goalShareBtn:       { padding: 4, borderRadius: 6, backgroundColor: "#f59e0b22" },

    scoreGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    scoreItem:      { width: "30%", backgroundColor: colors.card, borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    scoreBar:       { width: "100%", height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 8 },
    scoreBarFill:   { height: 4, borderRadius: 2 },
    scoreNum:       { fontSize: 19, fontFamily: "Inter_700Bold", color: colors.foreground },
    scoreName:      { fontSize: 9, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },

    analysisCard:   { backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 },
    sportIconWrap:  { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    analysisTitle:  { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    analysisMeta:   { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2, textTransform: "capitalize" },
    scoreCircle:    { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 2 },
    scoreCircleNum: { fontSize: 14, fontFamily: "Inter_700Bold" },

    achRow:         { flexDirection: "row", gap: 10 },
    achCard:        { backgroundColor: colors.primary + "08", borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.primary + "44", alignItems: "center", width: 90 },
    achTitle:       { fontSize: 10, color: colors.foreground, fontFamily: "Inter_500Medium", marginTop: 6, textAlign: "center" },

    errorBanner:    { marginHorizontal: 20, marginBottom: 20, backgroundColor: colors.warning + "14", borderRadius: colors.radius, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.warning + "44" },
    upgradeCard:    { backgroundColor: colors.primary + "14", borderRadius: colors.radius, padding: 16, borderWidth: 1, borderColor: colors.primary + "40", flexDirection: "row", alignItems: "center", gap: 14, marginHorizontal: 20, marginBottom: 24 },
    upgradeText:    { flex: 1 },
    upgradeTitle:   { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    upgradeSub:     { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    upgradeBtn:     { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
    upgradeBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.greeting}>Good {getHour()}</Text>
              <Text style={s.name}>{profile?.name ?? user?.name ?? "Athlete"}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => router.push("/profile-settings" as any)}
                style={{ width: 40, height: 40, borderRadius: 20, overflow: "hidden" }}
                activeOpacity={0.8}
              >
                <AvatarDisplay
                  avatarUrl={profile?.avatarUrl}
                  name={profile?.name ?? user?.name ?? "Athlete"}
                  size={40}
                  colors={colors}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/analyze" as any)}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
                activeOpacity={0.85}
              >
                <Feather name="plus" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.badgeRow}>
            <View style={s.badge}>
              <Text style={s.badgeText}>{tier} · {profile?.level ?? "beginner"}</Text>
            </View>
            {streakDays > 0 && (
              <View style={s.streakBadge}>
                <Feather name="zap" size={11} color="#ff6b35" />
                <Text style={s.streakText}>{streakDays}d streak</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Empty state for fresh users ── */}
        {!error && allAnalyses.length === 0 && (
          <View style={{ marginHorizontal: 20, marginBottom: 24, backgroundColor: colors.card, borderRadius: colors.radius, padding: 28, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary + "1a", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
              <Feather name="video" size={32} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 8, textAlign: "center" }}>
              Record your first video
            </Text>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21, marginBottom: 24 }}>
              Upload or record a training clip to get AI-powered biomechanics feedback, injury-risk scores, and personalised drills.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28, flexDirection: "row", alignItems: "center", gap: 8 }}
              onPress={() => router.push("/(tabs)/analyze" as any)}
              activeOpacity={0.85}
            >
              <Feather name="upload" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>Analyze a Video</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Stats row (only when the user has data) ── */}
        {allAnalyses.length > 0 && (
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <View style={[s.overallCircle, { borderColor: overallColor, backgroundColor: overallColor + "1a" }]}>
                <Text style={[s.overallNum, { color: overallColor }]}>
                  {overallScore != null ? Math.round(overallScore) : "--"}
                </Text>
              </View>
              {scoreDelta != null && (
                <View style={s.deltaRow}>
                  <Feather
                    name={scoreDelta >= 0 ? "trending-up" : "trending-down"}
                    size={11}
                    color={scoreDelta >= 0 ? colors.success : colors.destructive}
                  />
                  <Text style={[s.deltaText, { color: scoreDelta >= 0 ? colors.success : colors.destructive }]}>
                    {scoreDelta >= 0 ? "+" : ""}{scoreDelta}
                  </Text>
                </View>
              )}
              <Text style={s.statLabel}>Score</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{totalSessions}</Text>
              <Text style={s.statLabel}>Sessions</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: streakDays > 0 ? "#ff6b35" : colors.foreground }]}>
                {streakDays > 0 ? `${streakDays}` : unlockedCount}
              </Text>
              <Text style={s.statLabel}>{streakDays > 0 ? "Streak" : "Awards"}</Text>
            </View>
          </View>
        )}

        {/* ── Error banner ── */}
        {error && !loading && (
          <View style={s.errorBanner}>
            <Feather name="wifi-off" size={16} color={colors.warning} />
            <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 18 }}>
              Couldn't load your data. Pull down to refresh.
            </Text>
          </View>
        )}

        {/* ── Today's Focus ── */}
        {focusData && latestComplete && (
          <TouchableOpacity
            style={s.focusCard}
            onPress={() => router.push(`/analysis/${latestComplete.id}` as any)}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning }} />
              <Text style={{ fontSize: 9, color: colors.warning, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 1.1 }}>
                Today's Focus
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{
                width: 54, height: 54, borderRadius: 27,
                borderWidth: 2.5, borderColor: colors.warning,
                backgroundColor: colors.warning + "14",
                alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: colors.warning }}>
                  {Math.round(focusData.score)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground, textTransform: "capitalize" }}>
                  {focusData.key}
                </Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 17 }}>
                  Your lowest metric — prioritize this today
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                <Text style={{ fontSize: 11, color: colors.primary, fontFamily: "Inter_500Medium" }}>Tips</Text>
                <Feather name="chevron-right" size={12} color={colors.primary} />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Quick Actions ── */}
        <View style={s.quickGrid}>
          {QUICK_ACTIONS.map((qa) => (
            <TouchableOpacity
              key={qa.label}
              style={s.quickBtn}
              onPress={() => router.push(qa.route as any)}
              activeOpacity={0.8}
            >
              <View style={s.quickIcon}>
                <Feather name={qa.icon} size={16} color={colors.primary} />
              </View>
              <Text style={s.quickLabel}>{qa.label}</Text>
              <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── AI Insight banner ── */}
        {insightMsg && (
          <View style={[s.insightBanner, { backgroundColor: insightColor + "14", borderWidth: 1, borderColor: insightColor + "33" }]}>
            <Feather name={insightIcon} size={16} color={insightColor} />
            <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 18 }}>
              {insightMsg}
            </Text>
          </View>
        )}

        {/* ── This Week ── */}
        {allAnalyses.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { marginBottom: 12 }]}>This Week</Text>
            <View style={goalReached ? s.weeklyCardGoal : s.weeklyCard}>
              {goalReached && (
                <View style={s.goalBanner}>
                  <Animated.View style={{ transform: [{ scale: trophyScale }] }}>
                    <Feather name="award" size={20} color="#d97706" />
                  </Animated.View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.goalBannerText}>Weekly goal reached!</Text>
                    <Text style={s.goalBannerSub}>{thisWeek} of {weeklyGoal} sessions this week</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleShareGoal}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                    style={s.goalShareBtn}
                  >
                    <Feather name="share-2" size={16} color="#d97706" />
                  </TouchableOpacity>
                </View>
              )}
              <View style={s.weeklyRow}>
                <Text style={s.weeklyLabel}>Sessions completed</Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={[s.weeklyCount, goalReached && { color: "#d97706" }]}>{thisWeek} / {weeklyGoal}</Text>
                  {stats != null && stats.lastWeekCount > 0 && (
                    <Text style={[s.weeklyDelta, { color: thisWeek >= stats.lastWeekCount ? colors.success : colors.warning }]}>
                      {thisWeek >= stats.lastWeekCount ? " ↑" : " ↓"} vs last week
                    </Text>
                  )}
                </View>
              </View>
              <View style={s.progressBarBg}>
                <Animated.View style={[s.progressBarFill, { width: animatedBarWidth, backgroundColor: goalReached ? "#f59e0b" : colors.primary }]} />
              </View>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 }}
                onPress={() => router.push("/profile-settings" as any)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                  Goal: {weeklyGoal} session{weeklyGoal !== 1 ? "s" : ""}/week
                </Text>
                <Feather name="edit-2" size={10} color={colors.mutedForeground} />
              </TouchableOpacity>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
                {lastSevenDays.map((day) => {
                  const trained = trainedDaysSet.has(day);
                  const isToday = day === todayStr;
                  const dayIdx = new Date(day + "T12:00:00").getDay();
                  const isRestDay = !trainingDaysSet.has(dayIdx);
                  const isPast = day < todayStr;
                  const isMissed = isPast && !trained && !isRestDay;
                  return (
                    <View key={day} style={{ alignItems: "center", gap: 5 }}>
                      <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: isRestDay ? colors.border : isToday ? colors.primary : colors.mutedForeground }}>
                        {DAY_LABELS[dayIdx]}
                      </Text>
                      <View style={{
                        width: 22, height: 22, borderRadius: 11,
                        backgroundColor: trained
                          ? (goalReached ? "#f59e0b" : colors.primary)
                          : isRestDay
                          ? colors.border + "44"
                          : "transparent",
                        borderWidth: trained || isRestDay ? 0 : 1.5,
                        borderColor: isMissed ? colors.warning + "88" : isToday ? colors.primary : colors.border,
                        alignItems: "center", justifyContent: "center",
                        opacity: isRestDay ? 0.45 : 1,
                      }}>
                        {isToday && !trained && !isRestDay && (
                          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.primary }} />
                        )}
                        {isRestDay && (
                          <View style={{ width: 4, height: 1, backgroundColor: colors.mutedForeground, borderRadius: 1, opacity: 0.6 }} />
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ── Latest Performance ── */}
        {latestComplete && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Latest Performance</Text>
              <TouchableOpacity onPress={() => router.push(`/analysis/${latestComplete.id}` as any)}>
                <Text style={s.seeAll}>Details</Text>
              </TouchableOpacity>
            </View>
            <View style={s.scoreGrid}>
              {SCORE_KEYS.map((key) => {
                const score = Math.round((latestComplete as any)[`${key}Score`] ?? 0);
                const pb = stats?.personalBests[key] ?? 0;
                const color = getScoreColor(score);
                const isPB = score > 0 && score >= pb && pb > 0;
                return (
                  <View key={key} style={[s.scoreItem, isPB && { borderColor: colors.success + "66" }]}>
                    <Text style={[s.scoreNum, { color }]}>{score}</Text>
                    <Text style={s.scoreName}>{key}</Text>
                    {isPB && (
                      <Text style={{ fontSize: 8, color: colors.success, fontFamily: "Inter_600SemiBold", marginTop: 2 }}>PB</Text>
                    )}
                    <View style={s.scoreBar}>
                      <View style={[s.scoreBarFill, { width: `${score}%` as any, backgroundColor: color }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Sport distribution ── */}
        {topSports.length >= 2 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { marginBottom: 12 }]}>Your Sports</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {topSports.map(([sport, count]) => (
                <View
                  key={sport}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 6,
                    backgroundColor: colors.card, borderRadius: 20,
                    paddingHorizontal: 12, paddingVertical: 7,
                    borderWidth: 1, borderColor: colors.border,
                  }}
                >
                  <Feather name="activity" size={12} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.foreground, textTransform: "capitalize" }}>
                    {sport}
                  </Text>
                  <View style={{ backgroundColor: colors.primary + "20", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.primary }}>{count}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Recent Sessions ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Recent Sessions</Text>
            <TouchableOpacity onPress={() => router.navigate("/(tabs)/analyze" as any)}>
              <Text style={s.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {recentAnalyses.length === 0 ? (
            <TouchableOpacity
              style={[s.analysisCard, { justifyContent: "center", flexDirection: "column", gap: 10, paddingVertical: 36 }]}
              onPress={() => router.navigate("/(tabs)/analyze" as any)}
              activeOpacity={0.8}
            >
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
                <Feather name="upload" size={26} color={colors.primary} />
              </View>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                Analyze your first session
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", lineHeight: 18, maxWidth: 280 }}>
                Upload a training video and get AI-powered form analysis, personalized tips, and injury risk scores
              </Text>
            </TouchableOpacity>
          ) : (
            recentAnalyses.map((a) => {
              const score = a.overallScore != null ? Math.round(a.overallScore) : null;
              const scoreColor = score != null ? getScoreColor(score) : colors.mutedForeground;
              return (
                <TouchableOpacity
                  key={a.id}
                  style={s.analysisCard}
                  onPress={() => router.push(`/analysis/${a.id}` as any)}
                  activeOpacity={0.85}
                >
                  {a.thumbnailUrl ? (
                    <Image
                      source={{ uri: a.thumbnailUrl }}
                      style={[s.sportIconWrap, { backgroundColor: scoreColor + "1a" }]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[s.sportIconWrap, { backgroundColor: scoreColor + "1a" }]}>
                      <Feather name="activity" size={18} color={scoreColor} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.analysisTitle} numberOfLines={1}>{a.title}</Text>
                    <Text style={s.analysisMeta}>
                      {[a.sport, STATUS_LABEL[a.status] ?? a.status].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  {score != null ? (
                    <View style={[s.scoreCircle, { borderColor: scoreColor, backgroundColor: scoreColor + "14" }]}>
                      <Text style={[s.scoreCircleNum, { color: scoreColor }]}>{score}</Text>
                    </View>
                  ) : (
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── Achievements ── */}
        {achievements.filter((a) => a.unlocked).length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Achievements</Text>
              <TouchableOpacity onPress={() => router.navigate("/(tabs)/progress" as any)}>
                <Text style={s.seeAll}>All {achievements.filter(a => a.unlocked).length}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
              <View style={s.achRow}>
                {achievements.filter((a) => a.unlocked).map((a) => (
                  <View key={a.id} style={s.achCard}>
                    <Feather name={a.icon as any} size={22} color={colors.primary} />
                    <Text style={s.achTitle}>{a.title}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Upgrade banner ── */}
        {tier === "free" && (
          <View style={s.upgradeCard}>
            <Feather name="zap" size={22} color={colors.primary} />
            <View style={s.upgradeText}>
              <Text style={s.upgradeTitle}>Unlock AI Coach</Text>
              <Text style={s.upgradeSub}>Unlimited analyses + personal coaching</Text>
            </View>
            <TouchableOpacity style={s.upgradeBtn} onPress={() => router.push("/pricing")} activeOpacity={0.85}>
              <Text style={s.upgradeBtnText}>$9.99/mo</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {showConfetti && (
        <ConfettiBurst onComplete={() => setShowConfetti(false)} />
      )}
    </View>
  );
}
