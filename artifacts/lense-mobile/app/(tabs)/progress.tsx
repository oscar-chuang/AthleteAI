import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  progress as progressApi,
  achievements as achievementsApi,
  type ProgressRecord,
  type AchievementRecord,
} from "@/lib/api";

const VOLT   = "#C6FF3A";
const INK    = "#07090B";
const BG     = "#07090B";
const SURF   = "#111316";
const SURF2  = "#1A1D21";
const TXT    = "#F5F5F5";
const MUTED  = "#8A8F98";
const BORDER = "rgba(255,255,255,0.10)";
const SUCCESS = "#22C55E";

const WEEK_DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const { width: SCREEN_W } = Dimensions.get("window");
const CHART_H  = 120;
const CHART_W  = SCREEN_W - 40 - 32; // card padding

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [entries, setEntries]           = useState<ProgressRecord[]>([]);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84 + 16;

  const loadData = useCallback(async () => {
    try {
      const [{ entries: e }, { achievements: a }] = await Promise.all([
        progressApi.list(),
        achievementsApi.list(),
      ]);
      setEntries(e);
      setAchievements(a);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const avgScore = entries.length
    ? Math.round(entries.reduce((s, e) => s + (e.overallScore ?? 0), 0) / entries.length)
    : 0;
  const firstScore  = entries[0]?.overallScore ?? 0;
  const latestScore = entries[entries.length - 1]?.overallScore ?? 0;
  const gainPct     = firstScore > 0
    ? Math.round(((latestScore - firstScore) / firstScore) * 100)
    : 0;

  // Chart data
  const values    = entries.map((e) => e.overallScore ?? 0);
  const minVal    = values.length ? Math.min(...values) - 5 : 0;
  const maxVal    = values.length ? Math.max(...values) + 5 : 100;
  const range     = maxVal - minVal || 1;
  const ptW       = values.length > 1 ? CHART_W / (values.length - 1) : CHART_W;
  function toY(v: number) { return CHART_H - ((v - minVal) / range) * CHART_H; }

  // This week
  const today         = new Date();
  const todayDow      = today.getDay();                          // 0=Sun
  const todayIdx      = todayDow === 0 ? 6 : todayDow - 1;      // 0=Mon
  const weekStart     = new Date(today);
  weekStart.setDate(today.getDate() - todayIdx);
  weekStart.setHours(0, 0, 0, 0);
  const sessionDaySet = new Set(
    entries
      .filter((e) => new Date(e.date) >= weekStart)
      .map((e) => {
        const d = new Date(e.date).getDay();
        return d === 0 ? 6 : d - 1;
      }),
  );
  const sessionsThisWeek = sessionDaySet.size;
  const weekGoal         = 4;

  // Metric breakdown (last entry)
  const last = entries[entries.length - 1];
  const metricBars = [
    { label: "Technique", value: Math.round(last?.techniqueScore ?? 0) },
    { label: "Power",     value: Math.round(last?.powerScore     ?? 0) },
    { label: "Balance",   value: Math.round(last?.balanceScore   ?? 0) },
  ];

  if (loading) {
    return (
      <View style={[s.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={VOLT} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={VOLT}
          />
        }
      >
        {/* ── Header ── */}
        <View style={[s.header, { paddingTop: topPad + 20 }]}>
          <Text style={s.title}>Progress</Text>
          <View style={s.weekPill}>
            <Text style={s.weekPillText}>8 WEEKS</Text>
          </View>
        </View>

        {entries.length === 0 ? (
          <View style={s.section}>
            <View style={s.emptyCard}>
              <Feather name="trending-up" size={32} color={MUTED} />
              <Text style={s.emptyText}>Complete your first analysis to start tracking progress.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/(tabs)/analyze" as any)} activeOpacity={0.85}>
                <Text style={s.emptyBtnText}>Analyze a Video</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* ── AVG FORM SCORE card ── */}
            <View style={s.section}>
              <View style={s.scoreCard}>
                <Text style={s.scoreLabel}>AVG FORM SCORE</Text>
                <View style={s.scoreRow}>
                  <Text style={s.scoreValue}>{avgScore}</Text>
                  {gainPct !== 0 && (
                    <View style={[s.changeBadge, gainPct < 0 && { backgroundColor: "#ff444422", borderColor: "#ff4444" }]}>
                      <Text style={[s.changeBadgeText, gainPct < 0 && { color: "#ff6666" }]}>
                        {gainPct > 0 ? "↑" : "↓"} {Math.abs(gainPct)}%
                      </Text>
                    </View>
                  )}
                </View>

                {/* Chart */}
                <View style={{ marginTop: 12 }}>
                  <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} width={CHART_W} height={CHART_H} style={{ display: "block", overflow: "visible" }}>
                    {values.length > 1 && (
                      <path
                        d={[
                          `M 0 ${toY(values[0]!)}`,
                          ...values.slice(1).map((v, i) => `L ${(i + 1) * ptW} ${toY(v)}`),
                          `L ${(values.length - 1) * ptW} ${CHART_H}`,
                          `L 0 ${CHART_H}`,
                          "Z",
                        ].join(" ")}
                        fill={VOLT + "22"}
                      />
                    )}
                    {values.length > 1 && (
                      <polyline
                        points={values.map((v, i) => `${i * ptW},${toY(v)}`).join(" ")}
                        fill="none"
                        stroke={VOLT}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {values.map((v, i) => (
                      <circle key={i} cx={i * ptW} cy={toY(v)} r="4" fill={VOLT} />
                    ))}
                  </svg>
                </View>
              </View>
            </View>

            {/* ── This week ── */}
            <View style={s.section}>
              <View style={s.weekCard}>
                <View style={s.weekHeader}>
                  <Text style={s.weekTitle}>This week</Text>
                  <Text style={s.weekSessions}>{sessionsThisWeek} of {weekGoal} sessions</Text>
                </View>
                <View style={s.dayRow}>
                  {WEEK_DAYS.map((day, i) => {
                    const isSession = sessionDaySet.has(i);
                    const isToday   = i === todayIdx;
                    const isFuture  = i > todayIdx;
                    return (
                      <View key={i} style={s.dayCol}>
                        <View style={[
                          s.dayDot,
                          isSession ? s.dayDotSession :
                          isToday   ? s.dayDotToday   :
                          isFuture  ? s.dayDotFuture  : s.dayDotEmpty,
                        ]}>
                          {isSession && <Feather name="check" size={11} color={INK} />}
                        </View>
                        <Text style={[s.dayLabel, isToday && { color: VOLT }]}>{day}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* ── Metric breakdown ── */}
            {(last?.techniqueScore || last?.powerScore || last?.balanceScore) ? (
              <View style={s.section}>
                <View style={s.metricsCard}>
                  <Text style={s.metricsTitle}>Metric breakdown</Text>
                  {metricBars.map((m) => (
                    <View key={m.label} style={s.metricRow}>
                      <View style={s.metricMeta}>
                        <Text style={s.metricLabel}>{m.label}</Text>
                        <Text style={s.metricValue}>{m.value}</Text>
                      </View>
                      <View style={s.metricTrack}>
                        <View style={[s.metricFill, { width: `${m.value}%` as any }]} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}

        {/* ── Achievements ── */}
        {achievements.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Achievements</Text>
            <View style={s.achGrid}>
              {achievements.map((a) => (
                <View key={a.id} style={[s.achCard, !a.unlocked && { opacity: 0.5 }]}>
                  <Text style={s.achIcon}>{a.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.achTitle}>{a.title}</Text>
                    <Text style={s.achDesc}>{a.description}</Text>
                    {!a.unlocked && (
                      <Text style={s.achProgress}>{a.progress}/{a.total}</Text>
                    )}
                  </View>
                  {a.unlocked && <Feather name="check-circle" size={16} color={SUCCESS} />}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: BG },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 20 },
  title:       { fontSize: 28, fontFamily: "Archivo_800ExtraBold", color: TXT, letterSpacing: -0.5 },
  weekPill:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: SURF2, borderWidth: 1, borderColor: BORDER },
  weekPillText:{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: MUTED, letterSpacing: 1 },
  section:     { paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle:{ fontSize: 15, fontFamily: "Inter_700Bold", color: TXT, marginBottom: 12 },

  scoreCard:   { backgroundColor: SURF, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: BORDER },
  scoreLabel:  { fontSize: 10, fontFamily: "Inter_600SemiBold", color: MUTED, letterSpacing: 1.5, textTransform: "uppercase" },
  scoreRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 4 },
  scoreValue:  { fontSize: 48, fontFamily: "Archivo_800ExtraBold", color: TXT, letterSpacing: -2 },
  changeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: VOLT + "22", borderWidth: 1, borderColor: VOLT + "66" },
  changeBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: VOLT },

  weekCard:    { backgroundColor: SURF, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: BORDER },
  weekHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  weekTitle:   { fontSize: 15, fontFamily: "Inter_700Bold", color: TXT },
  weekSessions:{ fontSize: 12, color: MUTED, fontFamily: "Inter_400Regular" },
  dayRow:      { flexDirection: "row", justifyContent: "space-between" },
  dayCol:      { alignItems: "center", gap: 6 },
  dayDot:      { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  dayDotSession: { backgroundColor: VOLT },
  dayDotToday:   { backgroundColor: "transparent", borderWidth: 2, borderColor: VOLT },
  dayDotFuture:  { backgroundColor: SURF2 },
  dayDotEmpty:   { backgroundColor: SURF2 },
  dayLabel:      { fontSize: 11, color: MUTED, fontFamily: "Inter_500Medium" },

  metricsCard:   { backgroundColor: SURF, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: BORDER },
  metricsTitle:  { fontSize: 15, fontFamily: "Inter_700Bold", color: TXT, marginBottom: 16 },
  metricRow:     { marginBottom: 14 },
  metricMeta:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  metricLabel:   { fontSize: 13, color: TXT, fontFamily: "Inter_400Regular" },
  metricValue:   { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TXT },
  metricTrack:   { height: 6, backgroundColor: SURF2, borderRadius: 3, overflow: "hidden" },
  metricFill:    { height: 6, backgroundColor: VOLT, borderRadius: 3 },

  achGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  achCard: {
    width: "47%",
    backgroundColor: SURF,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  achIcon:     { fontSize: 28 },
  achTitle:    { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TXT },
  achDesc:     { fontSize: 11, color: MUTED, fontFamily: "Inter_400Regular", marginTop: 2 },
  achProgress: { fontSize: 11, color: VOLT, fontFamily: "Inter_600SemiBold", marginTop: 4 },

  emptyCard:  { backgroundColor: SURF, borderRadius: 18, padding: 32, borderWidth: 1, borderColor: BORDER, alignItems: "center", gap: 12 },
  emptyText:  { color: MUTED, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" },
  emptyBtn:   { backgroundColor: VOLT, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
  emptyBtnText:{ color: INK, fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
