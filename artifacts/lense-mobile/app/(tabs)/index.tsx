import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth, useTier } from "@/lib/authContext";
import {
  analyses as analysesApi,
  achievements as achievementsApi,
  profile as profileApi,
  type AnalysisRecord,
  type AchievementRecord,
  type ProfileStats,
} from "@/lib/api";

const SCORE_KEYS = ["technique", "power", "balance", "consistency", "mobility", "speed"] as const;

const QUICK_ACTIONS: { label: string; icon: React.ComponentProps<typeof Feather>["name"]; route: string }[] = [
  { label: "Analyze Video", icon: "upload",         route: "/(tabs)/analyze"  },
  { label: "AI Coach",      icon: "message-circle", route: "/(tabs)/chat"     },
  { label: "Progress",      icon: "trending-up",    route: "/(tabs)/progress" },
  { label: "Compare",       icon: "users",          route: "/(tabs)/compare"  },
];

function getHour() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const tier = useTier();

  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisRecord[]>([]);
  const [totalAnalyses, setTotalAnalyses] = useState(0);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;

  const loadData = useCallback(async () => {
    try {
      const [{ analyses }, { achievements: ach }, statsResult] = await Promise.all([
        analysesApi.list(),
        achievementsApi.list(),
        profileApi.stats().catch(() => null),
      ]);
      setTotalAnalyses(analyses.length);
      setRecentAnalyses(analyses.slice(0, 3));
      setAchievements(ach);
      if (statsResult) setStats(statsResult);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  function onRefresh() {
    setRefreshing(true);
    loadData();
  }

  function getScoreColor(score: number) {
    if (score >= 80) return colors.success;
    if (score >= 65) return colors.primary;
    return colors.warning;
  }

  const latestComplete = recentAnalyses.find((a) => a.status === "complete");
  const overallScore = latestComplete?.overallScore ?? null;
  const overallColor = overallScore != null ? getScoreColor(overallScore) : colors.primary;

  const streakDays   = stats?.streak ?? 0;
  const thisWeek     = stats?.thisWeekCount ?? profile?.weeklyProgress ?? 0;
  const weeklyGoal   = profile?.weeklyGoal ?? 3;
  const weekPct      = Math.min((thisWeek / weeklyGoal) * 100, 100);
  const scoreDelta   = stats?.scoreDelta ?? null;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const s = StyleSheet.create({
    container:    { flex: 1, backgroundColor: colors.background },
    scroll:       { flex: 1 },
    header:       { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 16 },
    headerRow:    { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    greeting:     { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", letterSpacing: 0.6, textTransform: "uppercase" },
    name:         { fontSize: 26, color: colors.foreground, fontFamily: "Inter_700Bold", marginTop: 2 },
    badgeRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" },
    badge:        { backgroundColor: colors.primary + "22", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText:    { color: colors.primary, fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
    streakBadge:  { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ff6b3522", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    streakText:   { fontSize: 12, fontFamily: "Inter_700Bold", color: "#ff6b35" },

    statsRow:     { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 20 },
    statCard:     { flex: 1, backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border },
    statValue:    { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.foreground },
    statLabel:    { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 },
    overallCircle:{ width: 56, height: 56, borderRadius: 28, borderWidth: 3, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    overallNum:   { fontSize: 20, fontFamily: "Inter_700Bold" },
    deltaRow:     { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
    deltaText:    { fontSize: 10, fontFamily: "Inter_600SemiBold" },

    quickGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20, marginBottom: 24 },
    quickBtn:     { width: "47%", backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 },
    quickIcon:    { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.primary + "1a", alignItems: "center", justifyContent: "center" },
    quickLabel:   { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, flex: 1 },

    section:      { paddingHorizontal: 20, marginBottom: 24 },
    sectionHeader:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    seeAll:       { fontSize: 13, color: colors.primary, fontFamily: "Inter_500Medium" },

    weeklyCard:   { backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, borderWidth: 1, borderColor: colors.border },
    weeklyRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    weeklyLabel:  { color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" },
    weeklyCount:  { color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" },
    weeklyDelta:  { fontSize: 11, fontFamily: "Inter_500Medium", marginLeft: 4 },
    progressBarBg:{ height: 6, backgroundColor: colors.border, borderRadius: 3 },
    progressBarFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },

    scoreGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    scoreItem:    { width: "30%", backgroundColor: colors.card, borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    scoreBar:     { width: "100%", height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 8 },
    scoreBarFill: { height: 4, borderRadius: 2 },
    scoreNum:     { fontSize: 19, fontFamily: "Inter_700Bold", color: colors.foreground },
    scoreName:    { fontSize: 9, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },

    analysisCard:  { backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 },
    sportIcon:     { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    analysisTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    analysisMeta:  { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2, textTransform: "capitalize" },
    scoreCircle:   { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 2 },
    scoreCircleNum:{ fontSize: 14, fontFamily: "Inter_700Bold" },

    achRow:     { flexDirection: "row", gap: 10 },
    achCard:    { backgroundColor: colors.card, borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.primary + "44", alignItems: "center", width: 90, backgroundColor: colors.primary + "08" },
    achTitle:   { fontSize: 10, color: colors.foreground, fontFamily: "Inter_500Medium", marginTop: 6, textAlign: "center" },

    upgradeCard:  { backgroundColor: colors.primary + "14", borderRadius: colors.radius, padding: 16, borderWidth: 1, borderColor: colors.primary + "40", flexDirection: "row", alignItems: "center", gap: 14, marginHorizontal: 20, marginBottom: 24 },
    upgradeText:  { flex: 1 },
    upgradeTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    upgradeSub:   { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    upgradeBtn:   { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
    upgradeBtnText:{ color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
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
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/analyze" as any)}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 4 }}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
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

        {/* ── Stats row ── */}
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
            <Text style={s.statValue}>{stats?.totalAnalyses ?? totalAnalyses}</Text>
            <Text style={s.statLabel}>Sessions</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: streakDays > 0 ? "#ff6b35" : colors.foreground }]}>
              {streakDays > 0 ? `${streakDays}` : unlockedCount}
            </Text>
            <Text style={s.statLabel}>{streakDays > 0 ? "Streak" : "Awards"}</Text>
          </View>
        </View>

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

        {/* ── This Week ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { marginBottom: 12 }]}>This Week</Text>
          <View style={s.weeklyCard}>
            <View style={s.weeklyRow}>
              <Text style={s.weeklyLabel}>Sessions completed</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={s.weeklyCount}>{thisWeek} / {weeklyGoal}</Text>
                {stats != null && stats.lastWeekCount > 0 && (
                  <Text style={[s.weeklyDelta, { color: thisWeek >= stats.lastWeekCount ? colors.success : colors.warning }]}>
                    {thisWeek >= stats.lastWeekCount ? " ↑" : " ↓"} vs last week
                  </Text>
                )}
              </View>
            </View>
            <View style={s.progressBarBg}>
              <View style={[s.progressBarFill, { width: `${weekPct}%` as any }]} />
            </View>
          </View>
        </View>

        {/* ── Latest Performance scores ── */}
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

        {/* ── Recent Analyses ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Recent Sessions</Text>
            <TouchableOpacity onPress={() => router.navigate("/(tabs)/analyze" as any)}>
              <Text style={s.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {recentAnalyses.length === 0 ? (
            <TouchableOpacity
              style={[s.analysisCard, { justifyContent: "center", flexDirection: "column", gap: 8, paddingVertical: 28 }]}
              onPress={() => router.navigate("/(tabs)/analyze" as any)}
              activeOpacity={0.8}
            >
              <Feather name="upload" size={28} color={colors.primary} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" }}>
                Upload your first training video
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
                  <View style={[s.sportIcon, { backgroundColor: scoreColor + "1a" }]}>
                    <Feather name="activity" size={18} color={scoreColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.analysisTitle} numberOfLines={1}>{a.title}</Text>
                    <Text style={s.analysisMeta}>{a.sport} · {a.status}</Text>
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
      </ScrollView>
    </View>
  );
}
