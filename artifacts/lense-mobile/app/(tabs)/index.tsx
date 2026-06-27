import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuth, useTier } from "@/lib/authContext";
import { analyses as analysesApi, achievements as achievementsApi, type AnalysisRecord, type AchievementRecord } from "@/lib/api";
import colors from "@/constants/colors";

const C = colors.light;
const SCORE_KEYS = ["technique", "power", "balance", "consistency", "mobility", "speed"] as const;

function scoreColor(score: number) {
  if (score >= 80) return C.success;
  if (score >= 65) return C.volt;
  return C.warning;
}

function dateLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const tier = useTier();

  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisRecord[]>([]);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 24 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84 + 16;

  const loadData = useCallback(async () => {
    try {
      const [{ analyses }, { achievements: ach }] = await Promise.all([
        analysesApi.list(),
        achievementsApi.list(),
      ]);
      setRecentAnalyses(analyses.slice(0, 5));
      setAchievements(ach);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const latestComplete = recentAnalyses.find((a) => a.status === "complete");
  const weeklyProgress = profile?.weeklyProgress ?? 0;
  const weeklyGoal = profile?.weeklyGoal ?? 4;
  const streakDays = profile?.streakDays ?? 0;
  const firstName = (profile?.name ?? user?.name ?? "Athlete").split(" ")[0];

  if (loading) {
    return (
      <View style={[s.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={C.volt} size="large" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={C.volt} />}
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: topPad }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.dateLabel}>{dateLabel()}</Text>
            <Text style={s.welcomeText}>Welcome back, {firstName}</Text>
          </View>
          <TouchableOpacity style={s.avatar} onPress={() => {}}>
            <Feather name="user" size={20} color={C.textSecondary} />
            {tier === "pro" && <View style={s.avatarBadge} />}
          </TouchableOpacity>
        </View>

        {/* Streak + Weekly row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <View style={s.statCardHeader}>
              <Feather name="zap" size={16} color={C.volt} />
              <Text style={s.statCardLabel}>STREAK</Text>
            </View>
            <View style={s.statCardValueRow}>
              <Text style={s.statCardValue}>{streakDays}</Text>
              <Text style={s.statCardUnit}>days</Text>
            </View>
          </View>
          <View style={s.statCard}>
            <View style={s.statCardHeader}>
              <Text style={s.statCardLabel}>THIS WEEK</Text>
              <Text style={[s.statCardLabel, { color: C.textPrimary }]}>{weeklyProgress}/{weeklyGoal}</Text>
            </View>
            <WeekBars progress={weeklyProgress} goal={weeklyGoal} />
          </View>
        </View>

        {/* Hero card — latest analysis */}
        {latestComplete ? (
          <TouchableOpacity
            style={s.heroCard}
            onPress={() => router.push(`/analysis/${latestComplete.id}`)}
            activeOpacity={0.88}
          >
            <View style={s.heroThumb}>
              <Feather name="play" size={26} color={C.volt} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={s.sportPill}>
                  <Text style={s.sportPillText}>{(latestComplete.sport ?? "sport").toUpperCase()}</Text>
                </View>
                <Text style={s.heroTime}>Latest</Text>
              </View>
              <Text style={s.heroTitle} numberOfLines={1}>{latestComplete.title}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                <Text style={s.heroScore}>{Math.round(latestComplete.overallScore ?? 0)}</Text>
                <Text style={s.heroScoreLabel}>score</Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.emptyHeroCard} onPress={() => router.push("/(tabs)/analyze")} activeOpacity={0.88}>
            <Feather name="upload" size={28} color={C.volt} />
            <Text style={s.emptyHeroTitle}>Upload your first clip</Text>
            <Text style={s.emptyHeroSub}>Get AI-powered form analysis in seconds</Text>
          </TouchableOpacity>
        )}

        {/* Recent analyses */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Recent analyses</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/analyze")}>
              <Text style={s.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {recentAnalyses.length === 0 ? (
            <Text style={s.emptyMsg}>No analyses yet — tap + to upload a video</Text>
          ) : (
            recentAnalyses.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={s.analysisRow}
                onPress={() => router.push(`/analysis/${a.id}`)}
                activeOpacity={0.85}
              >
                <View style={s.analysisThumb}>
                  <Feather name="activity" size={18} color={C.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.analysisTitle} numberOfLines={1}>{a.title}</Text>
                  <Text style={s.analysisMeta}>{(a.sport ?? "sport").toUpperCase()} · {new Date(a.uploadedAt).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</Text>
                </View>
                {a.status === "complete" ? (
                  <Text style={[s.analysisScore, { color: scoreColor(a.overallScore ?? 0) }]}>
                    {Math.round(a.overallScore ?? 0)}
                  </Text>
                ) : (
                  <ActivityIndicator color={C.volt} size="small" />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Upgrade banner */}
        {tier === "free" && (
          <TouchableOpacity style={s.upgradeCard} onPress={() => router.push("/pricing")} activeOpacity={0.88}>
            <Feather name="zap" size={22} color={C.ink} />
            <View style={{ flex: 1 }}>
              <Text style={s.upgradeTitle}>Upgrade to Pro</Text>
              <Text style={s.upgradeSub}>Unlock AI coach + unlimited analyses</Text>
            </View>
            <Text style={s.upgradePrice}>$9.99/mo</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function WeekBars({ progress, goal }: { progress: number; goal: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 5, marginTop: 14, alignItems: "flex-end", height: 30 }}>
      {Array.from({ length: goal }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: i < progress ? 24 + (i % 3) * 4 : 16,
            backgroundColor: i < progress ? C.volt : "#23272e",
            borderRadius: 4,
          }}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12 },
  dateLabel: { fontFamily: "SpaceMono_700Bold", fontSize: 11, letterSpacing: 1.5, color: C.textSecondary },
  welcomeText: { fontFamily: "Archivo_800ExtraBold", fontSize: 24, color: C.textPrimary, letterSpacing: -0.5, marginTop: 3 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.surface3, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.1)" },
  avatarBadge: { position: "absolute", top: -1, right: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: C.volt, borderWidth: 2, borderColor: C.background },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: C.surface2, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  statCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  statCardLabel: { fontFamily: "SpaceMono_700Bold", fontSize: 10, letterSpacing: 1, color: C.textSecondary },
  statCardValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 6 },
  statCardValue: { fontFamily: "Archivo_800ExtraBold", fontSize: 30, color: C.textPrimary, letterSpacing: -1 },
  statCardUnit: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  heroCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: C.surface2, borderRadius: 22, padding: 14, flexDirection: "row", gap: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  heroThumb: { width: 92, height: 92, borderRadius: 16, backgroundColor: C.surface3, alignItems: "center", justifyContent: "center" },
  sportPill: { backgroundColor: "rgba(198,255,58,0.14)", borderWidth: 1, borderColor: "rgba(198,255,58,0.4)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  sportPillText: { fontFamily: "SpaceMono_700Bold", fontSize: 9, letterSpacing: 1, color: C.volt },
  heroTime: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.textSecondary },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.textPrimary, marginTop: 8 },
  heroScore: { fontFamily: "Archivo_800ExtraBold", fontSize: 24, color: C.textPrimary, letterSpacing: -0.5 },
  heroScoreLabel: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.textSecondary },
  emptyHeroCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: C.surface2, borderRadius: 22, padding: 28, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  emptyHeroTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.textPrimary },
  emptyHeroSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "center" },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.textPrimary },
  seeAll: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.volt },
  emptyMsg: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center", paddingVertical: 16 },
  analysisRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  analysisThumb: { width: 52, height: 52, borderRadius: 13, backgroundColor: C.surface3, alignItems: "center", justifyContent: "center" },
  analysisTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textPrimary },
  analysisMeta: { fontFamily: "SpaceMono_700Bold", fontSize: 10, letterSpacing: 1, color: C.textSecondary, marginTop: 2 },
  analysisScore: { fontFamily: "Archivo_800ExtraBold", fontSize: 17, color: C.textPrimary },
  upgradeCard: { marginHorizontal: 20, backgroundColor: C.volt, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  upgradeTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.ink },
  upgradeSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(7,9,11,0.7)", marginTop: 1 },
  upgradePrice: { fontFamily: "Archivo_800ExtraBold", fontSize: 14, color: C.ink },
});
