/**
 * buildNextStepCue — pure helper that personalises the "What's next?" hint.
 *
 * Extracted from the skeleton screen so it can be unit-tested without
 * mounting the full React component.
 *
 * Priority order:
 *  1. A relevant joint improved out of the risky range across sessions
 *     → load-progression cue.
 *  2. A relevant joint improved at least one risk level (still risky)
 *     → "keep going" cue.
 *  3. Generic drill-based fallback (no trend data, or no improvement found).
 */

import type { JointKey } from "./analysisUtils";
import type { DrillRecord, JointTrendsResponse } from "../lib/api";
import { JOINT_LABEL } from "./skeleton";

export function buildNextStepCue(
  drill: DrillRecord | string,
  kind: "injury" | "performance",
  joints: JointKey[] | undefined,
  jointTrendsData: JointTrendsResponse | null | undefined,
): string {
  if (joints && joints.length > 0 && jointTrendsData) {
    let bestJoint: JointKey | null = null;
    let bestRiskDrop = 0;
    let bestAngleDelta = 0;

    for (const joint of joints) {
      const points = jointTrendsData.joints[joint];
      if (!points || points.length < 2) continue;

      const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
      const oldest = sorted[0]!;
      const newest = sorted[sorted.length - 1]!;
      const riskDrop = oldest.risk - newest.risk;
      const angleDelta = Math.abs(newest.angle - oldest.angle);

      if (
        riskDrop > bestRiskDrop ||
        (riskDrop === bestRiskDrop && angleDelta > bestAngleDelta)
      ) {
        bestRiskDrop = riskDrop;
        bestAngleDelta = angleDelta;
        bestJoint = joint;
      }
    }

    if (bestJoint && bestRiskDrop > 0) {
      const points = jointTrendsData.joints[bestJoint]!;
      const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
      const newest = sorted[sorted.length - 1]!;
      const sessionCount = sorted.length;
      const angleDeltaRounded = Math.round(bestAngleDelta);
      const jointLabel = JOINT_LABEL[bestJoint as JointKey] ?? bestJoint;
      const deltaStr = angleDeltaRounded >= 3 ? ` ${angleDeltaRounded}°` : "";

      if (newest.risk === 0) {
        return kind === "performance"
          ? `Your ${jointLabel} improved${deltaStr} across ${sessionCount} scans and is now in the safe range — time to advance. Try a harder variation or add external load to build on this momentum.`
          : `Your ${jointLabel} is now out of the risky range (improved${deltaStr} since your first scan). Consider progressing to a loaded variation while maintaining this form.`;
      } else {
        return kind === "performance"
          ? `Your ${jointLabel} has improved${deltaStr} across ${sessionCount} scans — solid progress. Add one more set or cut rest to 45 s to keep the stimulus growing.`
          : `Your ${jointLabel} is trending better (improved${deltaStr} since your first scan). Keep the corrective work going — try adding a 2-second pause at end range to reinforce the pattern.`;
      }
    }
  }

  if (typeof drill === "object" && drill !== null) {
    const setsNum = parseInt((drill as DrillRecord).sets, 10);
    if (!isNaN(setsNum)) {
      return kind === "performance"
        ? `Try ${setsNum + 1} sets next session, or cut rest to 45 s between rounds.`
        : `Progress to ${setsNum + 1} sets, or slow the eccentric to 3 seconds per rep.`;
    }
    return kind === "performance"
      ? `Add one more round, or reduce rest time to increase the training stimulus.`
      : `Increase volume gradually, or add a 2-second pause at end range.`;
  }
  return kind === "performance"
    ? `Build on this by adding one more round or advancing to a harder variation.`
    : `Increase volume gradually, or add a 2-second end-range pause each rep.`;
}
