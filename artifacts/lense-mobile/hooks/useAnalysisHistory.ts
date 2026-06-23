import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  analyses as analysesApi,
  jointTrends,
  type AnalysisRecord,
  type JointTrendsResponse,
} from "@/lib/api";
import { buildDeltaMap } from "@/lib/sessionDelta";

export interface UseAnalysisHistoryResult {
  analysisList: AnalysisRecord[];
  analysesWithTicks: Set<string>;
  loading: boolean;
  refreshing: boolean;
  setRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
  loadError: boolean;
  jointTrendsData: JointTrendsResponse | null;
  historyJoint: string | null;
  setHistoryJoint: React.Dispatch<React.SetStateAction<string | null>>;
  historyAnalysisId: string;
  setHistoryAnalysisId: React.Dispatch<React.SetStateAction<string>>;
  hasProcessing: boolean;
  headerStats: { total: number; thisWeek: number; avg: number };
  deltaBadgeMap: ReturnType<typeof buildDeltaMap>;
  heroAnalysis: AnalysisRecord | undefined;
  loadAnalyses: () => Promise<void>;
}

export function useAnalysisHistory(): UseAnalysisHistoryResult {
  const [analysisList, setAnalysisList] = useState<AnalysisRecord[]>([]);
  const [analysesWithTicks, setAnalysesWithTicks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [jointTrendsData, setJointTrendsData] = useState<JointTrendsResponse | null>(null);
  const [historyJoint, setHistoryJoint] = useState<string | null>(null);
  const [historyAnalysisId, setHistoryAnalysisId] = useState<string>("");

  const loadAnalyses = useCallback(async () => {
    setLoadError(false);
    try {
      const [{ analyses }, trendsResult] = await Promise.all([
        analysesApi.list(),
        jointTrends.get().catch(() => null),
      ]);
      setAnalysisList(analyses);
      if (trendsResult) setJointTrendsData(trendsResult);

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
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadAnalyses(); }, [loadAnalyses]));

  const hasProcessing = useMemo(
    () => analysisList.some((a) => a.status === "processing" || a.status === "pending"),
    [analysisList]
  );

  useEffect(() => {
    if (!hasProcessing) return;
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      if (count > 36) { clearInterval(id); return; }
      loadAnalyses();
    }, 5000);
    return () => clearInterval(id);
  }, [hasProcessing, loadAnalyses]);

  const headerStats = useMemo(() => {
    const done = analysisList.filter((a) => a.status === "complete");
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const thisWeek = done.filter((a) => new Date(a.uploadedAt) >= weekStart).length;
    const avg = done.length
      ? Math.round(done.reduce((s, a) => s + (a.overallScore ?? 0), 0) / done.length)
      : 0;
    return { total: done.length, thisWeek, avg };
  }, [analysisList]);

  const deltaBadgeMap = useMemo(() => buildDeltaMap(analysisList), [analysisList]);

  const heroAnalysis = useMemo(
    () => analysisList.find((a) => a.status === "complete"),
    [analysisList]
  );

  return {
    analysisList, analysesWithTicks, loading, refreshing, setRefreshing,
    loadError, jointTrendsData, historyJoint, setHistoryJoint, historyAnalysisId, setHistoryAnalysisId,
    hasProcessing, headerStats, deltaBadgeMap, heroAnalysis, loadAnalyses,
  };
}
