import { useState, useMemo } from "react";
import type { AnalysisRecord } from "@/lib/api";

type SortMode = "newest" | "oldest" | "score-high" | "score-low";

export interface UseAnalysesResult {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  sortBy: SortMode;
  setSortBy: React.Dispatch<React.SetStateAction<SortMode>>;
  displayList: AnalysisRecord[];
}

export function useAnalyses(analysisList: AnalysisRecord[]): UseAnalysesResult {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("newest");

  const displayList = useMemo(() => {
    let list = analysisList;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.sport.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "score-high": return (b.overallScore ?? 0) - (a.overallScore ?? 0);
        case "score-low":  return (a.overallScore ?? 0) - (b.overallScore ?? 0);
        case "oldest":     return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
        default:           return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      }
    });
  }, [analysisList, searchQuery, sortBy]);

  return { searchQuery, setSearchQuery, sortBy, setSortBy, displayList };
}
