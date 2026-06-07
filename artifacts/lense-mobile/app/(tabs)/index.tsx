import React, { useCallback, useEffect, useState } from "react";
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
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { useAuth, useTier } from "@/lib/authContext";
import { analyses as analysesApi, achievements as achievementsApi, type AnalysisRecord, type AchievementRecord } from "@/lib/api";

const SCORE_KEYS = ["technique", "power", "balance", "consistency", "mobility", "speed"] as const;

function getHour() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const tier = useTier();

  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisRecord[]>([]);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;

  const loadData = useCallback(async () => {
    try {
      const [{ analyses }, { achievements: ach }] = await Promise.all([
        analysesApi.list(),
        achievementsApi.list(),
      ]);
      setRecentAnalyses(analyses.slice(0, 3));
      setAchievements(ach);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
  const weeklyProgress = profile?.weeklyProgress ?? 0;
  const weeklyGoal = profile?.weeklyGoal ?? 3;
  const weekPct = Math.min((weeklyProgress / weeklyGoal) * 100, 100);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    header: { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 20 },
    greeting: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", letterSpacing: 0.5, textTransform: "uppercase" },
    name: { fontSize: 28, color: colors.foreground, fontFamily: "Inter_700Bold", marginTop: 2 },
    badge: { alignSelf: "flex-start", backgroundColor: colors.primary + "22", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginTop: 8 },
    badgeText: { color: colors.primary, fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1 },
    statsRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginBottom: 24 },
    statCard: { flex: 1, backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, alignItems: "center", borderWidth: 1, borderColor: colors.border },
    statValue: { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.foreground },
    statLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    overallCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary + "20", borderWidth: 3, borderColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 6 },
    overallScore: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.primary },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    seeAll: { fontSize: 13, color: colors.primary, fontFamily: "Inter_500Medium" },
    weeklyCard: { backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, borderWidth: 1, borderColor: colors.border },
    weeklyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    weeklyLabel: { color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" },
    weeklyCount: { color: colors.foreground, fontSize: 15, fontFamily: "Inter_600SemiBold" },
    progressBarBg: { height: 6, backgroundColor: colors.border, borderRadius: 3 },
    progressBarFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
    scoreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    scoreItem: { width: "30%", backgroundColor: colors.card, borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    scoreBar: { width: "100%", height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 8 },
    scoreBarFill: { height: 4, borderRadius: 2 },
    scoreNum: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground },
    scoreName: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
    analysisCard: { backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 14 },
    sportIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" },
    analysisTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground, flex: 1 },
    analysisSport: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textTransform: "capitalize", marginTop: 2 },
    analysisScore: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.primary },
    achRow: { flexDirection: "row", gap: 10 },
    achCard: { backgroundColor: colors.card, borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center", width: 90 },
    achIcon: { fontSize: 24 },
    achTitle: { fontSize: 10, color: colors.foreground, fontFamily: "Inter_500Medium", marginTop: 4, textAlign: "center" },
    upgradeCard: { backgroundColor: colors.primary + "15", borderRadius: colors.radius, padding: 16, borderWidth: 1, borderColor: colors.primary + "40", flexDirection: "row", alignItems: "center", gap: 14, marginHorizontal: 20, marginBottom: 24 },
    upgradeText: { flex: 1 },
    upgradeTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    upgradeSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    upgradeBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
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
        <View style={s.header}>
          <Text style={s.greeting}>Good {getHour()}</Text>
          <Text style={s.name}>{profile?.name ?? user?.name ?? "Athlete"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
            <View style={s.badge}>
              <Text style={s.badgeText}>{tier} · {profile?.level ?? "beginner"}</Text>
            </View>
            {(profile?.streakDays ?? 0) > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ff6b3522", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Feather name="zap" size={12} color="#ff6b35" />
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#ff6b35" }}>{profile?.streakDays}d streak</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <View style={s.overallCircle}>
              <Text style={s.overallScore}>{latestComplete ? Math.round(latestComplete.overallScore ?? 0) : "--"}</Text>
            </View>
            <Text style={s.statLabel}>Overall Score</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{recentAnalyses.length}</Text>
            <Text style={s.statLabel}>Total Analyses</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{unlockedCount}</Text>
            <Text style={s.statLabel}>Achievements</Text>
          </View>
        </View>

        {/* Upgrade banner for free tier */}
        {tier === "free" && (
          <View style={s.upgradeCard}>
            <Feather name="zap" size={24} color={colors.primary} />
            <View style={s.upgradeText}>
              <Text style={s.upgradeTitle}>Upgrade to Pro</Text>
              <Text style={s.upgradeSub}>Unlock AI coach & unlimited analyses</Text>
            </View>
            <TouchableOpacity style={s.upgradeBtn} onPress={() => router.push("/pricing")} activeOpacity={0.85}>
              <Text style={s.upgradeBtnText}>$9.99/mo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Weekly goal */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>This Week</Text>
          <View style={s.weeklyCard}>
            <View style={s.weeklyRow}>
              <Text style={s.weeklyLabel}>Sessions completed</Text>
              <Text style={s.weeklyCount}>{weeklyProgress} / {weeklyGoal}</Text>
            </View>
            <View style={s.progressBarBg}>
              <View style={[s.progressBarFill, { width: `${weekPct}%` }]} />
            </View>
          </View>
        </View>

        {/* Latest scores */}
        {latestComplete && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Latest Performance</Text>
            <View style={s.scoreGrid}>
              {SCORE_KEYS.map((key) => {
                const score = Math.round((latestComplete as any)[`${key}Score`] ?? 0);
                const color = getScoreColor(score);
                return (
                  <View key={key} style={s.scoreItem}>
                    <Text style={s.scoreNum}>{score}</Text>
                    <Text style={s.scoreName}>{key}</Text>
                    <View style={s.scoreBar}>
                      <View style={[s.scoreBarFill, { width: `${score}%`, backgroundColor: color }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Recent analyses */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Recent Analyses</Text>
            <TouchableOpacity onPress={() => router.navigate("/(tabs)/analyze")}>
              <Text style={s.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {recentAnalyses.length === 0 ? (
            <TouchableOpacity
              style={[s.analysisCard, { justifyContent: "center", flexDirection: "column", gap: 8, paddingVertical: 24 }]}
              onPress={() => router.navigate("/(tabs)/analyze")}
              activeOpacity={0.8}
            >
              <Feather name="upload" size={28} color={colors.primary} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }}>
                Upload your first training video
              </Text>
            </TouchableOpacity>
          ) : (
            recentAnalyses.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={s.analysisCard}
                onPress={() => router.push(`/analysis/${a.id}`)}
                activeOpacity={0.85}
              >
                <View style={s.sportIcon}>
                  <Feather name="activity" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.analysisTitle} numberOfLines={1}>{a.title}</Text>
                  <Text style={s.analysisSport}>{a.sport}</Text>
                </View>
                {a.status === "complete" ? (
                  <Text style={[s.analysisScore, { color: getScoreColor(a.overallScore ?? 0) }]}>
                    {Math.round(a.overallScore ?? 0)}
                  </Text>
                ) : (
                  <ActivityIndicator color={colors.primary} size="small" />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Achievements */}
        {achievements.filter((a) => a.unlocked).length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Achievements</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
              <View style={s.achRow}>
                {achievements.filter((a) => a.unlocked).map((a) => (
                  <View key={a.id} style={s.achCard}>
                    <Text style={s.achIcon}>{a.icon}</Text>
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
