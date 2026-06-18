import type { AnalysisRecord } from "./api";
import { JOINT_LABEL } from "@/utils/skeleton";

export interface DeltaBadgeInfo {
  jointLabel: string;
  delta: number;
  color: string;
  sign: string;
}

const DELTA_GREEN  = "#22c55e";
const DELTA_RED    = "#ef4444";
const DELTA_AMBER  = "#f59e0b";

function computeDeltaForPair(
  current: AnalysisRecord,
  prev: AnalysisRecord
): DeltaBadgeInfo | null {
  if (!current.jointAngles || !prev.jointAngles) return null;

  const joints = Object.keys(JOINT_LABEL) as (keyof typeof JOINT_LABEL)[];

  let bestImprovement: DeltaBadgeInfo | null = null;
  let worstRegression: DeltaBadgeInfo | null = null;
  let largestNeutral: DeltaBadgeInfo | null = null;

  for (const joint of joints) {
    const currDeg = current.jointAngles[joint];
    const prevDeg = prev.jointAngles[joint];
    if (typeof currDeg !== "number" || typeof prevDeg !== "number") continue;

    const delta = Math.round(currDeg - prevDeg);
    if (delta === 0) continue;

    const currRisk = current.jointRisks?.[joint];
    const prevRisk = prev.jointRisks?.[joint];
    const sign = delta > 0 ? "+" : "-";
    const absDelta = Math.abs(delta);
    const label = JOINT_LABEL[joint];

    if (typeof currRisk === "number" && typeof prevRisk === "number") {
      if (currRisk < prevRisk) {
        if (!bestImprovement || absDelta > Math.abs(bestImprovement.delta)) {
          bestImprovement = { jointLabel: label, delta, color: DELTA_GREEN, sign };
        }
      } else if (currRisk > prevRisk) {
        if (!worstRegression || absDelta > Math.abs(worstRegression.delta)) {
          worstRegression = { jointLabel: label, delta, color: DELTA_RED, sign };
        }
      } else {
        if (!largestNeutral || absDelta > Math.abs(largestNeutral.delta)) {
          largestNeutral = { jointLabel: label, delta, color: DELTA_AMBER, sign };
        }
      }
    } else {
      if (!largestNeutral || absDelta > Math.abs(largestNeutral.delta)) {
        largestNeutral = { jointLabel: label, delta, color: DELTA_AMBER, sign };
      }
    }
  }

  return bestImprovement ?? worstRegression ?? largestNeutral ?? null;
}

/**
 * Precomputes delta badges for every completed session in a single O(n log n)
 * pass. Call this once (e.g. inside useMemo) when the analyses list changes,
 * then look up individual badges by session ID at render time.
 *
 * Each session is compared against the closest preceding completed session.
 * Sessions without a predecessor, without jointAngles, or not yet complete
 * map to null.
 */
export function buildDeltaMap(
  allAnalyses: AnalysisRecord[]
): Map<string, DeltaBadgeInfo | null> {
  const completed = allAnalyses
    .filter((a) => a.status === "complete")
    .sort(
      (a, b) =>
        new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
    );

  const result = new Map<string, DeltaBadgeInfo | null>();

  for (let i = 0; i < completed.length; i++) {
    const current = completed[i]!;
    if (!current.jointAngles) {
      result.set(current.id, null);
      continue;
    }
    const prev = i > 0 ? completed[i - 1]! : null;
    result.set(current.id, prev ? computeDeltaForPair(current, prev) : null);
  }

  return result;
}

/**
 * Convenience wrapper for single-session lookups.
 * Prefer buildDeltaMap when rendering a list to avoid O(n²) work.
 */
export function computeBestDelta(
  current: AnalysisRecord,
  allAnalyses: AnalysisRecord[]
): DeltaBadgeInfo | null {
  return buildDeltaMap(allAnalyses).get(current.id) ?? null;
}
