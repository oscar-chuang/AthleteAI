/**
 * Pure utilities for biomechanics analysis — no React, no Expo, no side effects.
 * Shared between the skeleton screen and the test suite.
 */

export type JointKey = "leftKnee" | "rightKnee" | "leftHip" | "rightHip" | "leftElbow" | "rightElbow";
export type RiskMap  = Record<JointKey, number>;
export type AngleMap = Record<JointKey, number>;

/**
 * Returns the joints whose measured risk level is ≥ 1 (Caution or High Risk),
 * sorted worst-first (highest risk level first).
 *
 * Risk levels: 0 = safe, 1 = caution, 2 = high risk.
 */
export function computeFlaggedJoints(risks: RiskMap): JointKey[] {
  return (Object.keys(risks) as JointKey[])
    .filter((k) => (risks[k] ?? 0) >= 1)
    .sort((a, b) => (risks[b] ?? 0) - (risks[a] ?? 0));
}

/**
 * Returns the highest risk level across a set of flagged joints.
 * Returns 0 when the array is empty.
 */
export function computeWorstLvl(flaggedJoints: JointKey[], risks: RiskMap): number {
  return flaggedJoints.reduce((m, k) => Math.max(m, risks[k] ?? 0), 0);
}

/**
 * Minimal shape of a coaching tip needed for conflict detection and ordering.
 * The full CoachingTip type (from the API) is a superset of this.
 */
export interface TipForConflict {
  tipType?: string | null;
  severity?: string | null;
  joints?: string[] | null;
}

/**
 * Sorts injury tips so conflicted tips (joints that also appear in a
 * performance tip) rise to the top — they get the "Fix this first" label in
 * the UI and should be the most visible.
 *
 * The sort is stable with respect to the original order within each group.
 */
export function sortInjuryTips<T extends TipForConflict>(
  tips: T[],
  conflictedJoints: Set<string>,
): T[] {
  return [...tips].sort((a, b) => {
    const aConflict = (a.joints ?? []).some((j) => conflictedJoints.has(j)) ? 0 : 1;
    const bConflict = (b.joints ?? []).some((j) => conflictedJoints.has(j)) ? 0 : 1;
    return aConflict - bConflict;
  });
}

/**
 * Sorts performance tips so conflicted tips (joints that also appear in an
 * injury tip) sink to the bottom — they get the "After injury resolution"
 * label in the UI and should be the least prominent.
 *
 * The sort is stable with respect to the original order within each group.
 */
export function sortPerformanceTips<T extends TipForConflict>(
  tips: T[],
  conflictedJoints: Set<string>,
): T[] {
  return [...tips].sort((a, b) => {
    const aConflict = (a.joints ?? []).some((j) => conflictedJoints.has(j)) ? 1 : 0;
    const bConflict = (b.joints ?? []).some((j) => conflictedJoints.has(j)) ? 1 : 0;
    return aConflict - bConflict;
  });
}

/**
 * Returns the set of joint names that appear in BOTH an injury tip AND a
 * performance tip for the same session.  These pairs give contradictory
 * instructions ("avoid load" vs "increase power"), so the UI labels the
 * injury tip "Fix this first" and warns the performance tip to wait.
 *
 * Injury tips:      tipType === "injury"  OR  severity === "warning" | "critical"
 * Performance tips: tipType === "performance" AND severity === "info"
 */
export function computeConflictedJoints(tips: TipForConflict[]): Set<string> {
  const injuryTips = tips.filter(
    (t) => t.tipType === "injury" || t.severity === "warning" || t.severity === "critical",
  );
  const performanceTips = tips.filter(
    (t) => t.tipType === "performance" && t.severity === "info",
  );

  const injuryJoints = new Set(injuryTips.flatMap((t) => t.joints ?? []));
  const perfJoints   = new Set(performanceTips.flatMap((t) => t.joints ?? []));

  const shared = new Set<string>();
  injuryJoints.forEach((j) => { if (perfJoints.has(j)) shared.add(j); });
  return shared;
}
