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
