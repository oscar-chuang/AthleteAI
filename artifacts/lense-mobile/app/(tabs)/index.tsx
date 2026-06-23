import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { buildGoalShareMessage } from "../../utils/shareUtils";
import { computeScheduleSummary } from "../../utils/scheduleUtils";
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
  Modal,
  Pressable,
  Linking,
} from "react-native";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { TYPE } from "@/constants/typography";
import { SkeletonBox, SkeletonStatRow } from "@/components/ui/SkeletonLoader";
import { useAuth, useTier } from "@/lib/authContext";
import { DeltaBadge } from "@/components/DeltaBadge";
import { AvatarDisplay } from "@/app/profile-settings";
import {
  analyses as analysesApi,
  achievements as achievementsApi,
  profile as profileApi,
  jointTrends as jointTrendsApi,
  type AnalysisRecord,
  type AchievementRecord,
  type ProfileStats,
  type JointTrendsResponse,
  type TipRecord,
} from "@/lib/api";
import JointHistorySheet from "@/components/JointHistorySheet";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { checkConfettiGate, persistCelebrationToServer, retryCelebrationSync } from "@/utils/confettiGate";
import { toTitleCase } from "@/utils/formatDisplay";
import { STATUS_LABEL } from "@/utils/sessionStatus";
import { buildDeltaMap } from "@/lib/sessionDelta";
import { WeekDotRow } from "@/components/WeekDotRow";
import { captureRef } from "react-native-view-shot";
import { ShareCard } from "@/components/analysis/ShareCard";
import { HIDDEN_SHARE_CARD_STYLE, SHARE_CARD_CAPTURE_OPTIONS } from "@/utils/shareCardCapture";

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
  const barScaleAnim = useRef(new Animated.Value(0)).current;
  const [barContainerWidth, setBarContainerWidth] = useState(0);
  const shareCardRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, updateProfile } = useAuth();
  const tier = useTier();

  const [allAnalyses, setAllAnalyses]     = useState<AnalysisRecord[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisRecord[]>([]);
  const [analysesWithTicks, setAnalysesWithTicks] = useState<Set<string>>(new Set());
  const [achievements, setAchievements]   = useState<AchievementRecord[]>([]);
  const [stats, setStats]                 = useState<ProfileStats | null>(null);
  const [jointTrendsData, setJointTrendsData] = useState<JointTrendsResponse | null>(null);
  const [latestTips, setLatestTips]       = useState<TipRecord[]>([]);
  const [historyJoint, setHistoryJoint]   = useState<string | null>(null);
  const [historyAnalysisId, setHistoryAnalysisId] = useState<string>("");
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState(false);
  const [showConfetti, setShowConfetti]   = useState(false);
  const [showGoalSheet, setShowGoalSheet] = useState(false);
  const [goalSheetSaving, setGoalSheetSaving] = useState(false);
  const [localWeeklyGoal, setLocalWeeklyGoal] = useState<number | null>(null);
  const [showShareHint, setShowShareHint] = useState(false);
  const shareHintAnim = useRef(new Animated.Value(0)).current;
  const [barAnimDone, setBarAnimDone]     = useState(false);
  const goalSavedAnim = useRef(new Animated.Value(0)).current;
  const [showGoalSaved, setShowGoalSaved] = useState(false);
  const [showRestDayTooltip, setShowRestDayTooltip] = useState(false);
  const [showSharePreview, setShowSharePreview] = useState(false);
  const [showNotifDeniedBanner, setShowNotifDeniedBanner] = useState(false);
  const lastFetchedTipIdRef = useRef<string | null>(null);

  // When the server (or a background profile refresh) delivers a new weeklyGoal,
  // the optimistic localWeeklyGoal is no longer needed — clear it so the label
  // always reflects the authoritative server value.
  useEffect(() => {
    setLocalWeeklyGoal(null);
  }, [profile?.weeklyGoal]);

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;

  const loadData = useCallback(async (resetBar = false) => {
    setError(false);
    if (resetBar) {
      barScaleAnim.setValue(0);
      setBarAnimDone(false);
    }
    try {
      const [{ analyses }, { achievements: ach }, statsResult, trendsResult] = await Promise.all([
        analysesApi.list(),
        achievementsApi.list(),
        profileApi.stats().catch(() => null),
        jointTrendsApi.get().catch(() => null),
      ]);
      setAllAnalyses(analyses);
      setRecentAnalyses(analyses.slice(0, 3));
      setAchievements(ach);

      // Check which complete analyses have frameTicks stored locally
      const tickIds = await Promise.all(
        analyses
          .filter(a => a.status === "complete")
          .map(async a => {
            try {
              const raw = await AsyncStorage.getItem(`frameTicks_${a.id}`);
              if (!raw) return null;
              const parsed: unknown[] = JSON.parse(raw);
              return Array.isArray(parsed) && parsed.length > 0 ? a.id : null;
            } catch {
              return null;
            }
          })
      );
      setAnalysesWithTicks(new Set(tickIds.filter((id): id is string => id !== null)));
      if (statsResult) setStats(statsResult);
      if (trendsResult) setJointTrendsData(trendsResult);

      const firstComplete = analyses.find(a => a.status === "complete");
      if (firstComplete) {
        if (firstComplete.id !== lastFetchedTipIdRef.current) {
          analysesApi.get(firstComplete.id)
            .then(({ tips }) => {
              lastFetchedTipIdRef.current = firstComplete.id;
              setLatestTips(tips);
            })
            .catch(() => {});
        }
      } else {
        lastFetchedTipIdRef.current = null;
        setLatestTips([]);
      }

      const currentWeekGoal = profile?.weeklyGoal ?? 3;

      // Animate bar to resolved value (always runs so re-focus re-animates from 0).
      // Uses scaleX (native-driver-compatible) from 0 → targetRatio.
      const currentCount = statsResult?.thisWeekCount ?? 0;
      const targetRatio = currentWeekGoal > 0
        ? Math.min(currentCount / currentWeekGoal, 1)
        : 0;
      // If the goal is already reached before the animation begins (e.g. on
      // pull-to-refresh when nothing has changed), mark barAnimDone true now so
      // the bar fills in gold from the very first frame instead of animating
      // blue and then snapping to gold when the animation callback fires.
      if (targetRatio >= 1) {
        setBarAnimDone(true);
      }
      Animated.timing(barScaleAnim, {
        toValue: targetRatio,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setBarAnimDone(true);
      });

      if (currentWeekGoal > 0 && statsResult) {
        const weekKey = getWeekKey();

        // If the server's celebration flag is from a previous week, clear it.
        // The mobile owns week-key generation so this comparison is timezone-safe.
        // Fire-and-forget: the gate still works correctly with the stale in-memory
        // value (stale ≠ weekKey → alreadyCelebratedOnServer = false → confetti
        // can fire). The server column is corrected in the background.
        if (
          profile?.weeklyGoalCelebratedAt != null &&
          profile.weeklyGoalCelebratedAt !== weekKey
        ) {
          updateProfile({ weeklyGoalCelebratedAt: null }).catch(() => {});
        }

        // Reset the confetti-celebrated flag when the weekly goal changes so
        // the next session that crosses the new target can fire confetti again.
        const storedGoalStr = await AsyncStorage.getItem("last_seen_weekly_goal");
        const storedGoal = storedGoalStr !== null ? parseInt(storedGoalStr, 10) : null;
        if (storedGoal !== null && storedGoal !== currentWeekGoal) {
          await AsyncStorage.removeItem(`confetti_celebrated_${weekKey}`);
        }
        await AsyncStorage.setItem("last_seen_weekly_goal", String(currentWeekGoal));

        // Retry any previously failed server-side persistence (e.g. network error).
        await retryCelebrationSync(weekKey, AsyncStorage, async (wk) => {
          await updateProfile({ weeklyGoalCelebratedAt: wk });
        });

        const fired = await checkConfettiGate(
          currentWeekGoal,
          currentCount,
          weekKey,
          AsyncStorage,
          profile?.weeklyGoalCelebratedAt,
        );
        if (fired) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setShowConfetti(true);
          // Await the server write; on failure a sync marker is left for retry.
          await persistCelebrationToServer(weekKey, AsyncStorage, async (wk) => {
            await updateProfile({ weeklyGoalCelebratedAt: wk });
          });
        }
        if (currentCount >= currentWeekGoal) {
          const hintShown = await AsyncStorage.getItem("share_hint_shown");
          if (!hintShown) {
            setShowShareHint(true);
          }
        }
      }
      const notifNudge = await AsyncStorage.getItem("notif_denied_nudge").catch(() => null);
      if (notifNudge === "pending") {
        setShowNotifDeniedBanner(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.weeklyGoal, profile?.weeklyGoalCelebratedAt, barScaleAnim, updateProfile]);

  useFocusEffect(useCallback(() => { loadData(true); }, [loadData]));
  function onRefresh() { setRefreshing(true); loadData(true); }

  function getScoreColor(score: number) {
    if (score >= 80) return colors.success;
    if (score >= 65) return colors.primary;
    return colors.warning;
  }

  const latestComplete = recentAnalyses.find((a) => a.status === "complete");
  const overallScore   = latestComplete?.overallScore ?? null;

  const topTip = useMemo((): string | undefined => {
    const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
    if (latestTips.length === 0) return undefined;
    const sorted = [...latestTips].sort((a, b) => {
      const typeOrder = (t: string) => (t === "injury" ? 0 : 1);
      const typeDiff = typeOrder(a.tipType) - typeOrder(b.tipType);
      if (typeDiff !== 0) return typeDiff;
      return (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3);
    });
    return sorted[0]?.title;
  }, [latestTips]);
  const overallColor   = overallScore != null ? getScoreColor(overallScore) : colors.primary;

  const streakDays    = stats?.streak ?? 0;
  const thisWeek      = stats?.thisWeekCount ?? profile?.weeklyProgress ?? 0;
  const weeklyGoal    = localWeeklyGoal ?? profile?.weeklyGoal ?? 3;
  const weekPct       = Math.min((thisWeek / weeklyGoal) * 100, 100);
  const goalReached   = weeklyGoal > 0 && thisWeek >= weeklyGoal;
  const scoreDelta    = stats?.scoreDelta ?? null;
  const hasMismatch   = (profile?.trainingDays ?? [0,1,2,3,4,5,6]).length !== weeklyGoal;

  const handleGoalSelect = useCallback(async (n: number) => {
    if (goalSheetSaving || n === weeklyGoal) { setShowGoalSheet(false); return; }
    const prev = weeklyGoal;
    setLocalWeeklyGoal(n);
    setGoalSheetSaving(true);
    try {
      await updateProfile({ weeklyGoal: n });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setShowGoalSaved(true);
      goalSavedAnim.setValue(0);
      Animated.sequence([
        Animated.timing(goalSavedAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.delay(180),
        Animated.timing(goalSavedAnim, { toValue: 0, duration: 130, useNativeDriver: true }),
      ]).start(() => setShowGoalSaved(false));
    } catch {
      setLocalWeeklyGoal(prev);
    } finally {
      setGoalSheetSaving(false);
      setShowGoalSheet(false);
    }
  }, [goalSheetSaving, weeklyGoal, updateProfile, goalSavedAnim]);

  const dismissShareHint = useCallback(async () => {
    await AsyncStorage.setItem("share_hint_shown", "true");
    Animated.timing(shareHintAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowShareHint(false);
    });
  }, [shareHintAnim]);

  const dismissRestDayTooltip = useCallback(async () => {
    setShowRestDayTooltip(false);
    await AsyncStorage.setItem("rest_day_tooltip_dismissed", "true").catch(() => {});
  }, []);

  const dismissNotifDeniedBanner = useCallback(async () => {
    setShowNotifDeniedBanner(false);
    await AsyncStorage.setItem("notif_denied_nudge", "dismissed").catch(() => {});
  }, []);

  const handleShareGoal = useCallback(() => {
    setShowSharePreview(true);
  }, []);

  const handleShareConfirm = useCallback(async () => {
    setShowSharePreview(false);
    const message = buildGoalShareMessage({
      sessionCount: thisWeek,
      sport: profile?.sport,
      streakDays,
      topTip,
    });

    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable && shareCardRef.current) {
        const uri = await captureRef(shareCardRef, SHARE_CARD_CAPTURE_OPTIONS);
        if (Platform.OS === "ios") {
          // iOS Share sheet supports both a text message and an image URL together
          await Share.share({ message, url: uri });
        } else {
          // Android: share the card image via expo-sharing (native image intent)
          await Sharing.shareAsync(uri, {
            mimeType: "image/png",
            dialogTitle: "Share your weekly goal",
          });
        }
      } else {
        // Web or sharing unavailable — plain text fallback
        await Share.share({ message });
      }
    } catch {
      // User dismissed or capture failed — plain text fallback
      try {
        await Share.share({ message });
      } catch {
        // no-op
      }
    }
  }, [profile?.sport, thisWeek, streakDays, topTip]);

  useEffect(() => {
    if (!showShareHint) return;
    const fadeIn = Animated.timing(shareHintAnim, { toValue: 1, duration: 350, useNativeDriver: true });
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(shareHintAnim, { toValue: 0.6, duration: 700, useNativeDriver: true }),
        Animated.timing(shareHintAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    fadeIn.start(() => pulse.start());
    const autoDismiss = setTimeout(() => { dismissShareHint(); }, 5000);
    return () => { pulse.stop(); clearTimeout(autoDismiss); };
  }, [showShareHint, shareHintAnim, dismissShareHint]);

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

  const trainingDaysKey = (profile?.trainingDays ?? [0, 1, 2, 3, 4, 5, 6]).join(",");
  useEffect(() => {
    const days = profile?.trainingDays ?? [0, 1, 2, 3, 4, 5, 6];
    const hasRestDays = days.length < 7;
    if (!hasRestDays) return;
    AsyncStorage.getItem("rest_day_tooltip_dismissed").then((val) => {
      if (!val) setShowRestDayTooltip(true);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingDaysKey]);

  // scaleX anchor maths: fill is full-width, anchored to left edge.
  // translateX = -(W/2)*(1 - scaleX)  →  at scaleX=0: -W/2, at scaleX=1: 0
  const barFillTranslateX = barContainerWidth > 0
    ? barScaleAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-barContainerWidth / 2, 0],
      })
    : barScaleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });

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
  const scheduleSummary = computeScheduleSummary(Array.from(trainingDaysSet));

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

  // Precompute delta badges once per analyses refresh — O(n log n) total
  const deltaBadgeMap = useMemo(() => buildDeltaMap(allAnalyses), [allAnalyses]);

  const s = StyleSheet.create({
    container:      { flex: 1, backgroundColor: colors.background },
    scroll:         { flex: 1 },
    header:         { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 16 },
    headerRow:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    greeting:       { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium", letterSpacing: 0.8, textTransform: "uppercase" },
    name:           { fontSize: 34, color: colors.foreground, fontFamily: "Inter_700Bold", marginTop: 3, letterSpacing: -0.5 },
    badgeRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" },
    badge:          { backgroundColor: colors.primary + "20", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
    badgeText:      { color: colors.primary, fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 },
    streakBadge:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FF6B3520", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
    streakText:     { fontSize: 12, fontFamily: "Inter_700Bold", color: "#FF6B35" },

    statsRow:       { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 20 },
    statCard:       { flex: 1, backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border },
    statValue:      { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.foreground, letterSpacing: -0.5 },
    statLabel:      { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
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
    sectionTitle:   { fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground, letterSpacing: -0.2 },
    seeAll:         { fontSize: 13, color: colors.primary, fontFamily: "Inter_500Medium" },

    weeklyCard:         { backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, borderWidth: 1, borderColor: colors.border },
    weeklyCardGoal:     { backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, borderWidth: 2, borderColor: "#FF6B35" },
    weeklyRow:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    weeklyLabel:        { color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" },
    weeklyCount:        { color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" },
    weeklyDelta:        { fontSize: 11, fontFamily: "Inter_500Medium", marginLeft: 4 },
    progressBarBg:      { height: 6, backgroundColor: colors.border, borderRadius: 3 },
    progressBarFill:    { height: 6, borderRadius: 3, backgroundColor: colors.primary },
    goalBanner:         { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.energy + "18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 12, borderWidth: 1, borderColor: colors.energy + "44" },
    goalBannerText:     { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.energy, flex: 1 },
    goalBannerSub:      { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 },
    goalShareBtn:       { padding: 4, borderRadius: 6, backgroundColor: colors.energy + "22" },
    shareHintBubble:    { backgroundColor: colors.energy, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, marginBottom: 6, alignItems: "center" },
    shareHintText:      { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold", whiteSpace: "nowrap" } as any,
    shareHintArrow:     { position: "absolute", bottom: -5, right: 10, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: colors.energy },

    scoreGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    scoreItem:      { width: "30%", backgroundColor: colors.card, borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    scoreBar:       { width: "100%", height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 8 },
    scoreBarFill:   { height: 4, borderRadius: 2 },
    scoreNum:       { fontSize: 19, fontFamily: "Inter_700Bold", color: colors.foreground },
    scoreName:      { fontSize: 9, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },

    analysisCard:      { backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 },
    sportIconWrap:     { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    analysisTitle:     { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    analysisMeta:      { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2, textTransform: "capitalize" },
    analysisDeltaBadge:     { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, borderWidth: 1, overflow: "hidden" },
    analysisDeltaBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold" },
    breakdownChip:     { flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-start", marginTop: 5, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: colors.primary + "66", backgroundColor: colors.primary + "14" },
    breakdownChipText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.primary },
    scoreCircle:       { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 2 },
    scoreCircleNum:    { fontSize: 14, fontFamily: "Inter_700Bold" },

    achRow:         { flexDirection: "row", gap: 10 },
    achCard:        { backgroundColor: colors.primary + "08", borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.primary + "44", alignItems: "center", width: 90 },
    achTitle:       { fontSize: 10, color: colors.foreground, fontFamily: "Inter_500Medium", marginTop: 6, textAlign: "center" },

    restDayTooltip: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border + "55" },
    restDayTooltipDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border + "44", opacity: 0.55 },
    restDayTooltipText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    restDayTooltipDismiss: { padding: 4 },

    notifDeniedBanner: { marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderColor: colors.border },
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
      <View style={s.container}>
        <View style={{ paddingHorizontal: 20, paddingTop: (Platform.OS === "web" ? 67 : 20) + 20 }}>
          <SkeletonBox height={20} width="40%" radius={8} style={{ marginBottom: 8 }} />
          <SkeletonBox height={30} width="65%" radius={8} style={{ marginBottom: 24 }} />
          <SkeletonStatRow />
          <SkeletonBox height={100} radius={14} style={{ marginBottom: 16 }} />
          <SkeletonBox height={80} radius={14} style={{ marginBottom: 16 }} />
          <SkeletonBox height={56} radius={14} style={{ marginBottom: 16 }} />
          <SkeletonBox height={160} radius={14} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Joint angle history sheet — opened by tapping a delta badge */}
      {historyJoint && jointTrendsData?.joints[historyJoint] && (
        <JointHistorySheet
          joint={historyJoint}
          data={[...(jointTrendsData.joints[historyJoint] ?? [])].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          )}
          currentAnalysisId={historyAnalysisId}
          onClose={() => { setHistoryJoint(null); setHistoryAnalysisId(""); }}
        />
      )}
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
                  name={profile?.name ?? user?.name ?? ""}
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
              <Text style={s.badgeText}>{tier} · {toTitleCase(profile?.level ?? "beginner")}</Text>
            </View>
            {streakDays > 0 && (
              <View style={s.streakBadge}>
                <Feather name="zap" size={11} color="#ff6b35" />
                <Text style={s.streakText}>{streakDays}d streak</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Notification denied nudge ── */}
        {showNotifDeniedBanner && (
          <View style={s.notifDeniedBanner} testID="notif-denied-banner">
            <Feather name="bell-off" size={16} color={colors.mutedForeground} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 2 }}>
                Improvement alerts are off
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 17 }}>
                You won't be notified when a joint risk drops after a scan. To enable alerts, go to your device Settings and allow notifications for this app.
              </Text>
              <TouchableOpacity
                testID="notif-denied-open-settings-btn"
                onPress={() => Linking.openSettings()}
                activeOpacity={0.75}
                style={{ alignSelf: "flex-start", marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.primary + "18", borderWidth: 1, borderColor: colors.primary + "44" }}
              >
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary }}>Open Settings</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              testID="notif-denied-dismiss-btn"
              onPress={dismissNotifDeniedBanner}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

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

        {/* ── Hero metric + secondary stats (only when the user has data) ── */}
        {allAnalyses.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            {/* Dominant hero card — overall score */}
            <View style={{
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: colors.border,
              borderTopWidth: 3,
              borderTopColor: overallColor,
              padding: 20,
              marginBottom: 10,
              flexDirection: "row",
              alignItems: "center",
            }}>
              {/* Big score number */}
              <View style={{ flex: 1 }}>
                <Text style={[TYPE.captionMed, { color: colors.mutedForeground, marginBottom: 4 }]}>
                  Overall Score
                </Text>
                <Text style={[TYPE.display, { color: overallColor, lineHeight: 46 }]}>
                  {overallScore != null ? Math.round(overallScore) : "--"}
                </Text>
                {scoreDelta != null && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Feather
                      name={scoreDelta >= 0 ? "trending-up" : "trending-down"}
                      size={12}
                      color={scoreDelta >= 0 ? colors.success : colors.destructive}
                    />
                    <Text style={[TYPE.label, { color: scoreDelta >= 0 ? colors.success : colors.destructive }]}>
                      {scoreDelta >= 0 ? "+" : ""}{scoreDelta} from last session
                    </Text>
                  </View>
                )}
              </View>
              {/* Score ring accent */}
              <View style={{
                width: 72, height: 72, borderRadius: 36,
                borderWidth: 3, borderColor: overallColor,
                backgroundColor: overallColor + "14",
                alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ fontSize: 24, fontFamily: "Inter_700Bold", color: overallColor }}>
                  {overallScore != null ? Math.round(overallScore) : "--"}
                </Text>
              </View>
            </View>

            {/* Secondary metrics row */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{
                flex: 1,
                backgroundColor: colors.card,
                borderRadius: colors.radius,
                borderWidth: 1,
                borderColor: colors.border,
                borderTopWidth: 3,
                borderTopColor: colors.primary,
                paddingVertical: 14,
                alignItems: "center",
              }}>
                <Text style={[TYPE.headline, { color: colors.foreground }]}>{totalSessions}</Text>
                <Text style={[TYPE.captionMed, { color: colors.mutedForeground, marginTop: 2 }]}>Sessions</Text>
              </View>
              <View style={{
                flex: 1,
                backgroundColor: colors.card,
                borderRadius: colors.radius,
                borderWidth: 1,
                borderColor: colors.border,
                borderTopWidth: 3,
                borderTopColor: streakDays > 0 ? "#ff6b35" : colors.success,
                paddingVertical: 14,
                alignItems: "center",
              }}>
                <Text style={[TYPE.headline, { color: streakDays > 0 ? "#ff6b35" : colors.foreground }]}>
                  {streakDays > 0 ? `${streakDays}` : unlockedCount}
                </Text>
                <Text style={[TYPE.captionMed, { color: colors.mutedForeground, marginTop: 2 }]}>
                  {streakDays > 0 ? "Streak" : "Awards"}
                </Text>
              </View>
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
                <TouchableOpacity
                  activeOpacity={showShareHint ? 0.95 : 1}
                  onPress={showShareHint ? dismissShareHint : undefined}
                  style={s.goalBanner}
                >
                  <Animated.View style={{ transform: [{ scale: trophyScale }] }}>
                    <Feather name="award" size={20} color={colors.energy} />
                  </Animated.View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.goalBannerText}>Weekly goal reached!</Text>
                    <Text style={s.goalBannerSub}>{thisWeek} of {weeklyGoal} sessions this week</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {showShareHint && (
                      <Animated.View style={[s.shareHintBubble, { opacity: shareHintAnim }]}>
                        <Text style={s.shareHintText}>Tap to share 🎉</Text>
                        <View style={s.shareHintArrow} />
                      </Animated.View>
                    )}
                    <TouchableOpacity
                      testID="goal-share-btn"
                      onPress={() => { dismissShareHint(); handleShareGoal(); }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                      style={s.goalShareBtn}
                    >
                      <Feather name="share-2" size={16} color={colors.energy} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )}
              <View style={s.weeklyRow}>
                <Text style={s.weeklyLabel}>Sessions completed</Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={[s.weeklyCount, goalReached && { color: colors.energy }]}>{thisWeek} / {weeklyGoal}</Text>
                  {stats != null && stats.lastWeekCount > 0 && (
                    <Text style={[s.weeklyDelta, { color: thisWeek >= stats.lastWeekCount ? colors.success : colors.warning }]}>
                      {thisWeek >= stats.lastWeekCount ? " ↑" : " ↓"} vs last week
                    </Text>
                  )}
                </View>
              </View>
              <View
                style={s.progressBarBg}
                onLayout={(e) => setBarContainerWidth(e.nativeEvent.layout.width)}
              >
                <Animated.View
                  testID="progress-bar-fill"
                  style={[
                    s.progressBarFill,
                    {
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: barContainerWidth || "100%",
                      backgroundColor: barAnimDone && goalReached ? colors.energy : colors.primary,
                      transform: [
                        { translateX: barFillTranslateX },
                        { scaleX: barScaleAnim },
                      ],
                    },
                  ]}
                />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, justifyContent: "space-between" }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  onPress={() => setShowGoalSheet(true)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showGoalSaved ? (
                    <Animated.View style={{ opacity: goalSavedAnim, flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather name="check-circle" size={11} color={colors.success} />
                      <Text style={{ fontSize: 11, color: colors.success, fontFamily: "Inter_500Medium" }}>
                        Goal saved!
                      </Text>
                    </Animated.View>
                  ) : (
                    <>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                        Goal: {weeklyGoal} session{weeklyGoal !== 1 ? "s" : ""}/week
                      </Text>
                      {hasMismatch && (
                        <View testID="goal-mismatch-icon" style={{ justifyContent: "center" }}>
                          <Feather name="alert-circle" size={11} color={colors.warning} />
                        </View>
                      )}
                      <Feather name="edit-2" size={10} color={colors.mutedForeground} />
                    </>
                  )}
                </TouchableOpacity>
                {scheduleSummary != null && (
                  <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium", letterSpacing: 0.5 }}>
                    {scheduleSummary}
                  </Text>
                )}
              </View>
              <WeekDotRow
                  lastSevenDays={lastSevenDays}
                  todayStr={todayStr}
                  trainedDaysSet={trainedDaysSet}
                  trainingDaysSet={trainingDaysSet}
                  goalReached={goalReached}
                  colors={colors}
                />
              {showRestDayTooltip && (
                <View style={s.restDayTooltip} testID="rest-day-tooltip">
                  <View style={s.restDayTooltipDot} />
                  <Text style={s.restDayTooltipText}>Grey = rest day (not in your schedule)</Text>
                  <TouchableOpacity
                    onPress={dismissRestDayTooltip}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                    style={s.restDayTooltipDismiss}
                    testID="rest-day-tooltip-dismiss"
                  >
                    <Feather name="x" size={12} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              )}
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
              const deltaBadge = a.status === "complete"
                ? (deltaBadgeMap.get(a.id) ?? null)
                : null;
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
                      {[toTitleCase(a.sport), STATUS_LABEL[a.status] ?? a.status].filter(Boolean).join(" · ")}
                    </Text>
                    {deltaBadge && (
                      <DeltaBadge
                        info={deltaBadge}
                        onPress={jointTrendsData?.joints[deltaBadge.jointKey]?.length
                          ? () => { setHistoryJoint(deltaBadge.jointKey); setHistoryAnalysisId(a.id); }
                          : undefined}
                      />
                    )}
                    {analysesWithTicks.has(a.id) && (
                      <TouchableOpacity
                        testID={`breakdown-chip-${a.id}`}
                        style={s.breakdownChip}
                        onPress={(e) => { e.stopPropagation(); router.push(`/analysis/live/${a.id}` as any); }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Feather name="play" size={9} color={colors.primary} />
                        <Text style={s.breakdownChipText}>Breakdown</Text>
                      </TouchableOpacity>
                    )}
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

      {/*
        Off-screen share card — rendered for capture, never visible to the user.
        Cross-platform note: on Android the compositor skips views that fall
        outside the window bounds (e.g. top: -1000), producing a blank PNG.
        HIDDEN_SHARE_CARD_STYLE keeps the view at top:0/left:0 within bounds
        and hides it with opacity:0 + pointerEvents="none" instead.
        captureRef is called on the wrapping View so the inner ShareCard
        needs no forwardRef wiring.
      */}
      {latestComplete && (
        <View
          ref={shareCardRef}
          style={HIDDEN_SHARE_CARD_STYLE}
          pointerEvents="none"
          collapsable={false}
        >
          <ShareCard
            analysis={latestComplete}
            topTip={topTip}
            weeklyStats={{ sessions: thisWeek, weeklyGoal, streakDays }}
          />
        </View>
      )}

      {showConfetti && (
        <ConfettiBurst onComplete={() => setShowConfetti(false)} />
      )}

      {/* ── Weekly Goal Picker Sheet ── */}
      <Modal
        visible={showGoalSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGoalSheet(false)}
      >
        <Pressable
          testID="goal-sheet-backdrop"
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={() => setShowGoalSheet(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: insets.bottom + 32,
              borderTopWidth: 1,
              borderColor: colors.border,
            }}
            onPress={() => {}}
          >
            {/* Handle bar */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />

            <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 4 }}>
              Weekly Goal
            </Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 24 }}>
              How many sessions do you want to complete per week?
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
              {([1, 2, 3, 4, 5, 6, 7] as const).map((n) => {
                const isSelected = n === weeklyGoal;
                return (
                  <TouchableOpacity
                    key={n}
                    onPress={() => handleGoalSelect(n)}
                    disabled={goalSheetSaving}
                    activeOpacity={0.8}
                    style={{
                      width: 66,
                      height: 66,
                      borderRadius: 14,
                      borderWidth: 2,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary + "18" : colors.card,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {goalSheetSaving && isSelected ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Text style={{ fontSize: 24, fontFamily: "Inter_700Bold", color: isSelected ? colors.primary : colors.foreground }}>
                          {n}
                        </Text>
                        <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: isSelected ? colors.primary : colors.mutedForeground, marginTop: 1 }}>
                          {n === 1 ? "session" : "sessions"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => setShowGoalSheet(false)}
              style={{ marginTop: 24, alignItems: "center", paddingVertical: 8 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Share Card Preview Modal ── */}
      <Modal
        visible={showSharePreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSharePreview(false)}
      >
        <Pressable
          testID="share-preview-backdrop"
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}
          onPress={() => setShowSharePreview(false)}
        >
          <Pressable onPress={() => {}} style={{ alignItems: "center", width: "100%" }}>
            <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 20 }}>
              Share your achievement
            </Text>

            {/* Visible card preview */}
            {latestComplete && (
              <ShareCard
                analysis={latestComplete}
                topTip={topTip}
                weeklyStats={{ sessions: thisWeek, weeklyGoal, streakDays }}
              />
            )}

            <View style={{ flexDirection: "row", gap: 12, marginTop: 24, width: "100%" }}>
              <TouchableOpacity
                testID="share-preview-cancel-btn"
                onPress={() => setShowSharePreview(false)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.3)",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="goal-share-confirm-btn"
                onPress={handleShareConfirm}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Feather name="share-2" size={16} color="#fff" />
                <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" }}>Share</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
