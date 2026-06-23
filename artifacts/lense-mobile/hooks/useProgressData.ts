import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  progress as progressApi,
  achievements as achievementsApi,
  profile as profileApi,
  jointTrends as jointTrendsApi,
  movementSummaryHistory as movementSummaryHistoryApi,
  analyses as analysesApi,
  type ProgressRecord,
  type AchievementRecord,
  type ProfileStats,
  type JointTrendsResponse,
  type SportEntry,
  type PersonalRecordEntry,
  type MovementSummaryDataPoint,
} from "@/lib/api";

export interface UseProgressDataResult {
  allEntries: ProgressRecord[];
  sportsList: SportEntry[];
  achievements: AchievementRecord[];
  stats: ProfileStats | null;
  allTrends: JointTrendsResponse | null;
  allMovementHistory: MovementSummaryDataPoint[];
  personalRecords: Record<string, PersonalRecordEntry>;
  setPersonalRecords: React.Dispatch<React.SetStateAction<Record<string, PersonalRecordEntry>>>;
  aiSummary: string | null;
  setAiSummary: React.Dispatch<React.SetStateAction<string | null>>;
  aiSummaryLoading: boolean;
  setAiSummaryLoading: React.Dispatch<React.SetStateAction<boolean>>;
  drillsDoneCount: number;
  drillsCorrective: number | null;
  drillsPerformance: number | null;
  drillsUnclassified: number;
  drillsPartialFailure: boolean;
  loading: boolean;
  refreshing: boolean;
  setRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
  error: boolean;
  selectedSport: string | null;
  setSelectedSport: React.Dispatch<React.SetStateAction<string | null>>;
  loadDrillsDone: () => Promise<void>;
  loadData: () => Promise<void>;
  loadSportSpecific: (sport: string | null, movementType: string | null) => Promise<void>;
}

export function useProgressData(): UseProgressDataResult {
  const [allEntries, setAllEntries] = useState<ProgressRecord[]>([]);
  const [sportsList, setSportsList] = useState<SportEntry[]>([]);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [allTrends, setAllTrends] = useState<JointTrendsResponse | null>(null);
  const [allMovementHistory, setAllMovementHistory] = useState<MovementSummaryDataPoint[]>([]);
  const [personalRecords, setPersonalRecords] = useState<Record<string, PersonalRecordEntry>>({});
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [drillsDoneCount, setDrillsDoneCount] = useState(0);
  const [drillsCorrective, setDrillsCorrective] = useState<number | null>(null);
  const [drillsPerformance, setDrillsPerformance] = useState<number | null>(null);
  const [drillsUnclassified, setDrillsUnclassified] = useState<number>(0);
  const [drillsPartialFailure, setDrillsPartialFailure] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const loadDrillsDone = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const drillKeys = keys.filter((k) => k.startsWith("drill_done_"));
      if (drillKeys.length === 0) {
        setDrillsDoneCount(0);
        setDrillsCorrective(null);
        setDrillsPerformance(null);
        setDrillsUnclassified(0);
        return;
      }

      const pairs = await AsyncStorage.multiGet(drillKeys);
      const analysisCompletedTips: Record<string, string[]> = {};
      let total = 0;
      for (const [key, val] of pairs) {
        if (val) {
          try {
            const ids = JSON.parse(val) as string[];
            const analysisId = key.replace("drill_done_", "");
            analysisCompletedTips[analysisId] = ids;
            total += ids.length;
          } catch {}
        }
      }
      setDrillsDoneCount(total);

      try {
        const results = await Promise.allSettled(
          Object.keys(analysisCompletedTips).map((id) => analysesApi.get(id))
        );

        let corrective = 0;
        let performance = 0;
        let atLeastOneFulfilled = false;
        let atLeastOneRejected = false;

        results.forEach((result, idx) => {
          const analysisId = Object.keys(analysisCompletedTips)[idx]!;
          const completedIds = new Set(analysisCompletedTips[analysisId]);
          if (result.status === "fulfilled") {
            atLeastOneFulfilled = true;
            for (const tip of result.value.tips) {
              if (completedIds.has(tip.id)) {
                if (tip.tipType === "injury") {
                  corrective++;
                } else {
                  performance++;
                }
              }
            }
          } else {
            atLeastOneRejected = true;
          }
        });

        if (atLeastOneFulfilled) {
          setDrillsCorrective(corrective);
          setDrillsPerformance(performance);
          setDrillsUnclassified(Math.max(0, total - corrective - performance));
          setDrillsPartialFailure(atLeastOneRejected);
        } else {
          setDrillsCorrective(null);
          setDrillsPerformance(null);
          setDrillsUnclassified(0);
          setDrillsPartialFailure(false);
        }
      } catch {
        setDrillsCorrective(null);
        setDrillsPerformance(null);
        setDrillsUnclassified(0);
        setDrillsPartialFailure(false);
      }
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    setError(false);
    try {
      const [{ entries: e }, sportsResult, { achievements: a }, st, tr, mh] = await Promise.all([
        progressApi.list(),
        Promise.resolve().then(() => progressApi.sports()).catch(() => ({ sports: [] as SportEntry[] })),
        achievementsApi.list(),
        profileApi.stats().catch(() => null),
        jointTrendsApi.get().catch(() => null),
        movementSummaryHistoryApi.get().catch(() => null),
      ]);
      setAllEntries(e);
      setAchievements(a);
      if (st) setStats(st);
      if (tr) setAllTrends(tr);
      if (mh) setAllMovementHistory(mh.history);

      const sports = sportsResult.sports;
      if (sports.length > 0) {
        setSportsList(sports);
        setSelectedSport((prev) => prev ?? sports[0]!.sport);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    await loadDrillsDone();
  }, [loadDrillsDone]);

  const loadSportSpecific = useCallback(async (sport: string | null, movementType: string | null) => {
    if (!sport) return;

    const [prResult] = await Promise.all([
      progressApi.personalRecords(sport).catch(() => null),
    ]);
    if (prResult) setPersonalRecords(prResult.records);

    setAiSummaryLoading(true);
    setAiSummary(null);
    progressApi.summary(sport, movementType ?? undefined)
      .then(({ summary }) => setAiSummary(summary))
      .catch(() => setAiSummary(null))
      .finally(() => setAiSummaryLoading(false));
  }, []);

  return {
    allEntries, sportsList, achievements, stats, allTrends, allMovementHistory,
    personalRecords, setPersonalRecords, aiSummary, setAiSummary,
    aiSummaryLoading, setAiSummaryLoading,
    drillsDoneCount, drillsCorrective, drillsPerformance, drillsUnclassified, drillsPartialFailure,
    loading, refreshing, setRefreshing, error,
    selectedSport, setSelectedSport,
    loadDrillsDone, loadData, loadSportSpecific,
  };
}
