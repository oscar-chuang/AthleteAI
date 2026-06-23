import { useState, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
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
import { checkConfettiGate, persistCelebrationToServer, retryCelebrationSync } from "@/utils/confettiGate";

function getWeekKey(): string {
  const d = new Date();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return sunday.toISOString().split("T")[0]!;
}

export interface UseHomeDataResult {
  allAnalyses: AnalysisRecord[];
  recentAnalyses: AnalysisRecord[];
  analysesWithTicks: Set<string>;
  achievements: AchievementRecord[];
  stats: ProfileStats | null;
  jointTrendsData: JointTrendsResponse | null;
  latestTips: TipRecord[];
  loading: boolean;
  refreshing: boolean;
  setRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
  error: boolean;
  showConfetti: boolean;
  setShowConfetti: React.Dispatch<React.SetStateAction<boolean>>;
  loadData: (
    resetBar: boolean,
    weeklyGoal: number,
    profileWeeklyGoalCelebratedAt: string | null | undefined,
    barScaleAnim: { setValue: (v: number) => void },
    setBarAnimDone: (v: boolean) => void,
    animateBar: (ratio: number) => void,
    updateProfile: (patch: Record<string, unknown>) => Promise<void>,
  ) => Promise<void>;
}

export function useHomeData(): UseHomeDataResult {
  const [allAnalyses, setAllAnalyses]     = useState<AnalysisRecord[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisRecord[]>([]);
  const [analysesWithTicks, setAnalysesWithTicks] = useState<Set<string>>(new Set());
  const [achievements, setAchievements]   = useState<AchievementRecord[]>([]);
  const [stats, setStats]                 = useState<ProfileStats | null>(null);
  const [jointTrendsData, setJointTrendsData] = useState<JointTrendsResponse | null>(null);
  const [latestTips, setLatestTips]       = useState<TipRecord[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState(false);
  const [showConfetti, setShowConfetti]   = useState(false);
  const lastFetchedTipIdRef = useRef<string | null>(null);

  const loadData = useCallback(async (
    resetBar: boolean,
    weeklyGoal: number,
    profileWeeklyGoalCelebratedAt: string | null | undefined,
    barScaleAnim: { setValue: (v: number) => void },
    setBarAnimDone: (v: boolean) => void,
    animateBar: (ratio: number) => void,
    updateProfile: (patch: Record<string, unknown>) => Promise<void>,
  ) => {
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

      const currentCount = statsResult?.thisWeekCount ?? 0;
      const targetRatio = weeklyGoal > 0
        ? Math.min(currentCount / weeklyGoal, 1)
        : 0;
      if (targetRatio >= 1) {
        setBarAnimDone(true);
      }
      animateBar(targetRatio);

      if (weeklyGoal > 0 && statsResult) {
        const weekKey = getWeekKey();

        if (
          profileWeeklyGoalCelebratedAt != null &&
          profileWeeklyGoalCelebratedAt !== weekKey
        ) {
          updateProfile({ weeklyGoalCelebratedAt: null }).catch(() => {});
        }

        const storedGoalStr = await AsyncStorage.getItem("last_seen_weekly_goal");
        const storedGoal = storedGoalStr !== null ? parseInt(storedGoalStr, 10) : null;
        if (storedGoal !== null && storedGoal !== weeklyGoal) {
          await AsyncStorage.removeItem(`confetti_celebrated_${weekKey}`);
        }
        await AsyncStorage.setItem("last_seen_weekly_goal", String(weeklyGoal));

        await retryCelebrationSync(weekKey, AsyncStorage, async (wk) => {
          await updateProfile({ weeklyGoalCelebratedAt: wk });
        });

        const fired = await checkConfettiGate(
          weeklyGoal,
          currentCount,
          weekKey,
          AsyncStorage,
          profileWeeklyGoalCelebratedAt,
        );
        if (fired) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setShowConfetti(true);
          await persistCelebrationToServer(weekKey, AsyncStorage, async (wk) => {
            await updateProfile({ weeklyGoalCelebratedAt: wk });
          });
        }
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  return {
    allAnalyses, recentAnalyses, analysesWithTicks, achievements, stats,
    jointTrendsData, latestTips, loading, refreshing, setRefreshing,
    error, showConfetti, setShowConfetti, loadData,
  };
}
