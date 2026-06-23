import { useState } from "react";
import type { MetricKey } from "@/constants/sportConfig";

type Period = "1W" | "1M" | "3M" | "All";

export interface UseProgressFiltersResult {
  selectedMovementType: string | null;
  setSelectedMovementType: React.Dispatch<React.SetStateAction<string | null>>;
  compareMode: boolean;
  setCompareMode: React.Dispatch<React.SetStateAction<boolean>>;
  compareMovementType: string | null;
  setCompareMovementType: React.Dispatch<React.SetStateAction<string | null>>;
  activeMetric: MetricKey;
  setActiveMetric: React.Dispatch<React.SetStateAction<MetricKey>>;
  period: Period;
  setPeriod: React.Dispatch<React.SetStateAction<Period>>;
}

export function useProgressFilters(): UseProgressFiltersResult {
  const [selectedMovementType, setSelectedMovementType] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareMovementType, setCompareMovementType] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<MetricKey>("overall");
  const [period, setPeriod] = useState<Period>("All");

  return {
    selectedMovementType, setSelectedMovementType,
    compareMode, setCompareMode,
    compareMovementType, setCompareMovementType,
    activeMetric, setActiveMetric,
    period, setPeriod,
  };
}
