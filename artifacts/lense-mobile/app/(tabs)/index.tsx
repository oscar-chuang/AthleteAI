import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { MOCK_ATHLETE } from "@/lib/athleteData";

const SCORE_KEYS = ["technique", "power", "balance", "consistency", "mobility", "speed"] as const;

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const athlete = MOCK_ATHLETE;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;

  const recentAnalyses = athlete.analyses.slice(0, 3);
  const latestScores = athlete.progressHistory[athlete.progressHistory.length - 1]?.scores;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    header: {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    greeting: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    name: {
      fontSize: 28,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      marginTop: 2,
    },
    badge: {
      alignSelf: "flex-start",
      backgroundColor: colors.primary + "22",
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginTop: 8,
    },
    badgeText: {
      color: colors.primary,
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    statsRow: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    statValue: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    statLabel: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    overallCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary + "20",
      borderWidth: 3,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    overallScore: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
    },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionTitle: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 14,
    },
    weeklyCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    weeklyRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    weeklyLabel: { color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" },
    weeklyCount: { color: colors.foreground, fontSize: 15, fontFamily: "Inter_600SemiBold" },
    progressBarBg: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
    },
    progressBarFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    scoreGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    scoreItem: {
      width: "30%",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    scoreBar: {
      width: "100%",
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginTop: 8,
    },
    scoreBarFill: {
      height: 4,
      borderRadius: 2,
    },
    scoreNum: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    scoreName: {
      fontSize: 10,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 2,
    },
    analysisCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    sportIcon: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: colors.primary + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    analysisTitle: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      flex: 1,
    },
    analysisSport: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textTransform: "capitalize",
      marginTop: 2,
    },
    analysisScore: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
    },
    streakBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#ff6b35" + "22",
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    streakText: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: "#ff6b35",
    },
  });

  function getScoreColor(score: number) {
    if (score >= 80) return colors.success;
    if (score >= 65) return colors.primary;
    return colors.warning;
  }

  const weekPct = (athlete.weeklyProgress / athlete.weeklyGoal) * 100;

  return (
    <View style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <Text style={s.greeting}>Good morning</Text>
          <Text style={s.name}>{athlete.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
            <View style={s.badge}>
              <Text style={s.badgeText}>{athlete.tier} · {athlete.level}</Text>
            </View>
            <View style={s.streakBadge}>
              <Feather name="zap" size={12} color="#ff6b35" />
              <Text style={s.streakText}>{athlete.streakDays}d streak</Text>
            </View>
          </View>
        </View>

        <View style={s.statsRow}>
          <View style={s.statCard}>
            <View style={s.overallCircle}>
              <Text style={s.overallScore}>{latestScores?.overall ?? 0}</Text>
            </View>
            <Text style={s.statLabel}>Overall Score</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{athlete.analyses.length}</Text>
            <Text style={s.statLabel}>Analyses</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{athlete.achievements.filter(a => a.unlockedAt).length}</Text>
            <Text style={s.statLabel}>Achievements</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>This Week</Text>
          <View style={s.weeklyCard}>
            <View style={s.weeklyRow}>
              <Text style={s.weeklyLabel}>Sessions completed</Text>
              <Text style={s.weeklyCount}>{athlete.weeklyProgress} / {athlete.weeklyGoal}</Text>
            </View>
            <View style={s.progressBarBg}>
              <View style={[s.progressBarFill, { width: `${weekPct}%` as any }]} />
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Performance Scores</Text>
          <View style={s.scoreGrid}>
            {SCORE_KEYS.map((key) => {
              const score = latestScores?.[key] ?? 0;
              const clr = getScoreColor(score);
              return (
                <View key={key} style={s.scoreItem}>
                  <Text style={s.scoreNum}>{score}</Text>
                  <Text style={s.scoreName}>{key}</Text>
                  <View style={s.scoreBar}>
                    <View style={[s.scoreBarFill, { width: `${score}%` as any, backgroundColor: clr }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Recent Analyses</Text>
          {recentAnalyses.map((analysis) => (
            <TouchableOpacity
              key={analysis.id}
              style={s.analysisCard}
              activeOpacity={0.7}
              onPress={() => router.push(`/analysis/${analysis.id}`)}
            >
              <View style={s.sportIcon}>
                <Feather name="activity" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.analysisTitle}>{analysis.title}</Text>
                <Text style={s.analysisSport}>{analysis.sport}</Text>
              </View>
              <Text style={s.analysisScore}>{analysis.scores.overall}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
