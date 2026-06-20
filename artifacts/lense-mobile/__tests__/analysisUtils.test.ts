import { describe, it, expect } from "vitest";
import {
  computeFlaggedJoints,
  computeWorstLvl,
  computeConflictedJoints,
  sortInjuryTips,
  sortPerformanceTips,
  type JointKey,
  type RiskMap,
  type TipForConflict,
} from "../utils/analysisUtils";
import {
  INJURY_CONFLICT_LABEL,
  PERFORMANCE_CONFLICT_LABEL,
} from "../constants/conflictBanner";

// ── Helpers ──────────────────────────────────────────────────────────────────

const SAFE_RISKS: RiskMap = {
  leftKnee: 0, rightKnee: 0,
  leftHip: 0,  rightHip: 0,
  leftElbow: 0, rightElbow: 0,
};

function risks(overrides: Partial<RiskMap> = {}): RiskMap {
  return { ...SAFE_RISKS, ...overrides };
}

// ── computeFlaggedJoints ─────────────────────────────────────────────────────

describe("computeFlaggedJoints", () => {
  it("returns empty array when all joints are safe (risk level 0)", () => {
    expect(computeFlaggedJoints(SAFE_RISKS)).toEqual([]);
  });

  it("includes a joint at caution level (1)", () => {
    const flagged = computeFlaggedJoints(risks({ leftKnee: 1 }));
    expect(flagged).toContain("leftKnee");
    expect(flagged).toHaveLength(1);
  });

  it("includes a joint at high-risk level (2)", () => {
    const flagged = computeFlaggedJoints(risks({ rightHip: 2 }));
    expect(flagged).toContain("rightHip");
  });

  it("excludes joints at exactly risk level 0", () => {
    const flagged = computeFlaggedJoints(risks({ leftElbow: 0, rightElbow: 1 }));
    expect(flagged).not.toContain("leftElbow");
    expect(flagged).toContain("rightElbow");
  });

  it("sorts joints worst-first (highest risk level first)", () => {
    const flagged = computeFlaggedJoints(risks({ leftKnee: 1, rightHip: 2, leftHip: 1 }));
    expect(flagged[0]).toBe("rightHip");   // highest risk first
    expect(flagged).toContain("leftKnee");
    expect(flagged).toContain("leftHip");
  });

  it("handles all joints flagged at the same level", () => {
    const allCaution: RiskMap = {
      leftKnee: 1, rightKnee: 1, leftHip: 1,
      rightHip: 1, leftElbow: 1, rightElbow: 1,
    };
    expect(computeFlaggedJoints(allCaution)).toHaveLength(6);
  });

  it("handles all joints at high risk", () => {
    const allHigh: RiskMap = {
      leftKnee: 2, rightKnee: 2, leftHip: 2,
      rightHip: 2, leftElbow: 2, rightElbow: 2,
    };
    expect(computeFlaggedJoints(allHigh)).toHaveLength(6);
  });
});

// ── computeWorstLvl ──────────────────────────────────────────────────────────

describe("computeWorstLvl", () => {
  it("returns 0 when no joints are flagged", () => {
    expect(computeWorstLvl([], SAFE_RISKS)).toBe(0);
  });

  it("returns 1 when only caution joints are flagged", () => {
    const r = risks({ leftKnee: 1, rightKnee: 1 });
    const flagged: JointKey[] = ["leftKnee", "rightKnee"];
    expect(computeWorstLvl(flagged, r)).toBe(1);
  });

  it("returns 2 when any joint is at high risk", () => {
    const r = risks({ leftKnee: 1, rightHip: 2 });
    const flagged: JointKey[] = ["rightHip", "leftKnee"];
    expect(computeWorstLvl(flagged, r)).toBe(2);
  });

  it("returns the maximum level across multiple joints", () => {
    const r = risks({ leftKnee: 1, leftHip: 2, rightElbow: 1 });
    const flagged: JointKey[] = ["leftHip", "leftKnee", "rightElbow"];
    expect(computeWorstLvl(flagged, r)).toBe(2);
  });

  it("is not affected by unflagged joints present in risks", () => {
    // Even though rightKnee=0 exists in risks, it is not in flaggedJoints
    const r = risks({ leftKnee: 1, rightKnee: 0 });
    const flagged: JointKey[] = ["leftKnee"]; // rightKnee excluded because it is safe
    expect(computeWorstLvl(flagged, r)).toBe(1);
  });
});

// ── contract: flaggedJoints + worstLvl stay consistent ───────────────────────

describe("computeFlaggedJoints + computeWorstLvl contract", () => {
  it("worstLvl is always ≥ 1 when flaggedJoints is non-empty", () => {
    const r = risks({ leftKnee: 1, rightHip: 2 });
    const flagged = computeFlaggedJoints(r);
    const lvl = computeWorstLvl(flagged, r);
    expect(flagged.length).toBeGreaterThan(0);
    expect(lvl).toBeGreaterThanOrEqual(1);
  });

  it("worstLvl is exactly 0 when flaggedJoints is empty (all joints safe)", () => {
    const flagged = computeFlaggedJoints(SAFE_RISKS);
    const lvl = computeWorstLvl(flagged, SAFE_RISKS);
    expect(flagged).toHaveLength(0);
    expect(lvl).toBe(0);
  });

  it("sorted order means flaggedJoints[0] always has the highest risk level", () => {
    const r = risks({ leftKnee: 1, rightHip: 2, leftHip: 1 });
    const flagged = computeFlaggedJoints(r);
    expect(r[flagged[0]]).toBe(computeWorstLvl(flagged, r));
  });
});

// ── computeConflictedJoints ───────────────────────────────────────────────────

function injuryTip(joints: string[]): TipForConflict {
  return { tipType: "injury", severity: "warning", joints };
}

function perfTip(joints: string[]): TipForConflict {
  return { tipType: "performance", severity: "info", joints };
}

describe("computeConflictedJoints", () => {
  it("returns an empty set when the tips array is empty", () => {
    expect(computeConflictedJoints([])).toEqual(new Set());
  });

  it("returns an empty set when there are only injury tips and no performance tips", () => {
    const tips = [injuryTip(["leftKnee"]), injuryTip(["rightHip"])];
    expect(computeConflictedJoints(tips)).toEqual(new Set());
  });

  it("returns an empty set when there are only performance tips and no injury tips", () => {
    const tips = [perfTip(["leftKnee"]), perfTip(["rightHip"])];
    expect(computeConflictedJoints(tips)).toEqual(new Set());
  });

  it("returns an empty set when injury and performance tips share no joints", () => {
    const tips = [injuryTip(["leftKnee"]), perfTip(["rightHip"])];
    expect(computeConflictedJoints(tips)).toEqual(new Set());
  });

  it("detects a conflict when one injury tip and one performance tip share a joint", () => {
    const tips = [injuryTip(["leftKnee"]), perfTip(["leftKnee"])];
    const result = computeConflictedJoints(tips);
    expect(result.has("leftKnee")).toBe(true);
    expect(result.size).toBe(1);
  });

  it("detects multiple conflicted joints across multiple tips", () => {
    const tips = [
      injuryTip(["leftKnee", "rightHip"]),
      perfTip(["leftKnee", "rightHip", "leftElbow"]),
    ];
    const result = computeConflictedJoints(tips);
    expect(result.has("leftKnee")).toBe(true);
    expect(result.has("rightHip")).toBe(true);
    expect(result.has("leftElbow")).toBe(false);
    expect(result.size).toBe(2);
  });

  it("does NOT flag a joint when both tips covering it are the same type (both injury)", () => {
    const tips = [injuryTip(["leftKnee"]), injuryTip(["leftKnee"])];
    expect(computeConflictedJoints(tips)).toEqual(new Set());
  });

  it("does NOT flag a joint when both tips covering it are the same type (both performance)", () => {
    const tips = [perfTip(["rightHip"]), perfTip(["rightHip"])];
    expect(computeConflictedJoints(tips)).toEqual(new Set());
  });

  it("classifies a tip with severity 'warning' as an injury tip even if tipType is unset", () => {
    const warnTip: TipForConflict = { tipType: null, severity: "warning", joints: ["leftKnee"] };
    const tips = [warnTip, perfTip(["leftKnee"])];
    expect(computeConflictedJoints(tips).has("leftKnee")).toBe(true);
  });

  it("classifies a tip with severity 'critical' as an injury tip even if tipType is unset", () => {
    const critTip: TipForConflict = { tipType: null, severity: "critical", joints: ["rightHip"] };
    const tips = [critTip, perfTip(["rightHip"])];
    expect(computeConflictedJoints(tips).has("rightHip")).toBe(true);
  });

  it("does NOT treat a performance tip with severity 'warning' as conflicted with itself", () => {
    const tips: TipForConflict[] = [
      { tipType: "performance", severity: "warning", joints: ["leftKnee"] },
    ];
    expect(computeConflictedJoints(tips)).toEqual(new Set());
  });

  it("handles tips with null or missing joints without throwing", () => {
    const tips: TipForConflict[] = [
      { tipType: "injury", severity: "warning", joints: null },
      { tipType: "performance", severity: "info", joints: undefined },
    ];
    expect(() => computeConflictedJoints(tips)).not.toThrow();
    expect(computeConflictedJoints(tips)).toEqual(new Set());
  });

  it("handles a large mixed set and only reports the overlapping joints", () => {
    const tips: TipForConflict[] = [
      injuryTip(["leftKnee", "rightKnee"]),
      injuryTip(["leftHip"]),
      perfTip(["rightKnee", "leftElbow"]),
      perfTip(["rightElbow"]),
    ];
    const result = computeConflictedJoints(tips);
    expect(result.has("rightKnee")).toBe(true);
    expect(result.has("leftKnee")).toBe(false);
    expect(result.has("leftHip")).toBe(false);
    expect(result.has("leftElbow")).toBe(false);
    expect(result.size).toBe(1);
  });
});

// ── sortInjuryTips ────────────────────────────────────────────────────────────

describe("sortInjuryTips", () => {
  it("returns an empty array without throwing when the input is empty", () => {
    expect(sortInjuryTips([], new Set())).toEqual([]);
  });

  it("leaves order unchanged when no tips are conflicted", () => {
    const tips: TipForConflict[] = [
      injuryTip(["leftKnee"]),
      injuryTip(["rightHip"]),
    ];
    const result = sortInjuryTips(tips, new Set());
    expect(result).toEqual(tips);
  });

  it("raises a conflicted injury tip above a non-conflicted one", () => {
    const nonConflicted = injuryTip(["rightHip"]);
    const conflicted    = injuryTip(["leftKnee"]);
    const result = sortInjuryTips(
      [nonConflicted, conflicted],
      new Set(["leftKnee"]),
    );
    expect(result[0]).toBe(conflicted);
    expect(result[1]).toBe(nonConflicted);
  });

  it("keeps multiple conflicted tips at the front and non-conflicted at the back", () => {
    const nc1        = injuryTip(["rightElbow"]);
    const nc2        = injuryTip(["leftHip"]);
    const conflict1  = injuryTip(["leftKnee"]);
    const conflict2  = injuryTip(["rightKnee"]);
    const conflictedJoints = new Set(["leftKnee", "rightKnee"]);
    const result = sortInjuryTips([nc1, conflict1, nc2, conflict2], conflictedJoints);
    const firstTwoIds = result.slice(0, 2).map((t) => t.joints![0]);
    expect(firstTwoIds).toContain("leftKnee");
    expect(firstTwoIds).toContain("rightKnee");
    const lastTwoIds = result.slice(2).map((t) => t.joints![0]);
    expect(lastTwoIds).toContain("rightElbow");
    expect(lastTwoIds).toContain("leftHip");
  });

  it("does not mutate the original array", () => {
    const tips: TipForConflict[] = [injuryTip(["rightHip"]), injuryTip(["leftKnee"])];
    const copy = [...tips];
    sortInjuryTips(tips, new Set(["leftKnee"]));
    expect(tips).toEqual(copy);
  });

  it("handles tips with null joints without throwing", () => {
    const tips: TipForConflict[] = [
      { tipType: "injury", severity: "warning", joints: null },
      { tipType: "injury", severity: "warning", joints: undefined },
    ];
    expect(() => sortInjuryTips(tips, new Set(["leftKnee"]))).not.toThrow();
    expect(sortInjuryTips(tips, new Set(["leftKnee"]))).toHaveLength(2);
  });
});

// ── sortPerformanceTips ───────────────────────────────────────────────────────

describe("sortPerformanceTips", () => {
  it("returns an empty array without throwing when the input is empty", () => {
    expect(sortPerformanceTips([], new Set())).toEqual([]);
  });

  it("leaves order unchanged when no tips are conflicted", () => {
    const tips: TipForConflict[] = [
      perfTip(["leftKnee"]),
      perfTip(["rightHip"]),
    ];
    const result = sortPerformanceTips(tips, new Set());
    expect(result).toEqual(tips);
  });

  it("sinks a conflicted performance tip below a non-conflicted one", () => {
    const nonConflicted = perfTip(["rightHip"]);
    const conflicted    = perfTip(["leftKnee"]);
    const result = sortPerformanceTips(
      [conflicted, nonConflicted],
      new Set(["leftKnee"]),
    );
    expect(result[0]).toBe(nonConflicted);
    expect(result[1]).toBe(conflicted);
  });

  it("keeps non-conflicted tips at the front and conflicted at the back", () => {
    const nc1       = perfTip(["rightElbow"]);
    const nc2       = perfTip(["leftHip"]);
    const conflict1 = perfTip(["leftKnee"]);
    const conflict2 = perfTip(["rightKnee"]);
    const conflictedJoints = new Set(["leftKnee", "rightKnee"]);
    const result = sortPerformanceTips([conflict1, nc1, conflict2, nc2], conflictedJoints);
    const firstTwoIds = result.slice(0, 2).map((t) => t.joints![0]);
    expect(firstTwoIds).toContain("rightElbow");
    expect(firstTwoIds).toContain("leftHip");
    const lastTwoIds = result.slice(2).map((t) => t.joints![0]);
    expect(lastTwoIds).toContain("leftKnee");
    expect(lastTwoIds).toContain("rightKnee");
  });

  it("does not mutate the original array", () => {
    const tips: TipForConflict[] = [perfTip(["leftKnee"]), perfTip(["rightHip"])];
    const copy = [...tips];
    sortPerformanceTips(tips, new Set(["leftKnee"]));
    expect(tips).toEqual(copy);
  });

  it("handles tips with null joints without throwing", () => {
    const tips: TipForConflict[] = [
      { tipType: "performance", severity: "info", joints: null },
      { tipType: "performance", severity: "info", joints: undefined },
    ];
    expect(() => sortPerformanceTips(tips, new Set(["leftKnee"]))).not.toThrow();
    expect(sortPerformanceTips(tips, new Set(["leftKnee"]))).toHaveLength(2);
  });
});

// ── Full pipeline integration: computeConflictedJoints → sort → label ────────
//
// These tests mirror exactly what the skeleton screen's renderTip() does:
//
//   const hasConflict = tjoints.some((j) => conflictedJoints.has(j));
//   {hasConflict && kind === "injury"      && <Text>⚠ Fix this first</Text>}
//   {hasConflict && kind === "performance" && <Text>After injury risk is resolved</Text>}
//
// They run the full pipeline (computeConflictedJoints → sort helpers) and then
// apply that exact conditional to derive the label string each tip card would
// display, asserting on the literal text rather than just the positional order.
//
/**
 * Mirrors the renderTip() label-derivation logic from the skeleton screen.
 * Returns the conflict banner text the tip card would display, or null if the
 * tip is not conflicted (no banner shown).
 */
function deriveTipLabel(
  tip: TipForConflict,
  kind: "injury" | "performance",
  conflictedJoints: Set<string>,
): string | null {
  const hasConflict = (tip.joints ?? []).some((j) => conflictedJoints.has(j));
  if (!hasConflict) return null;
  return kind === "injury" ? INJURY_CONFLICT_LABEL : PERFORMANCE_CONFLICT_LABEL;
}

describe("full pipeline: computeConflictedJoints → sortInjuryTips / sortPerformanceTips → labels", () => {
  // Realistic mixed-type tip array:
  //   • leftKnee  — appears in both an injury tip AND a performance tip → conflicted
  //   • rightHip  — appears only in an injury tip → not conflicted
  //   • rightElbow — appears only in a performance tip → not conflicted
  const allTips: TipForConflict[] = [
    { tipType: "injury",      severity: "warning", joints: ["rightHip"] },   // non-conflicted injury
    { tipType: "injury",      severity: "warning", joints: ["leftKnee"] },   // conflicted injury
    { tipType: "performance", severity: "info",    joints: ["leftKnee"] },   // conflicted performance
    { tipType: "performance", severity: "info",    joints: ["rightElbow"] }, // non-conflicted performance
  ];

  const injuryTips      = allTips.filter((t) => t.tipType === "injury");
  const performanceTips = allTips.filter((t) => t.tipType === "performance" && t.severity === "info");

  it("pipeline: first sorted injury tip shows '⚠ Fix this first', non-conflicted tip shows no label", () => {
    const conflicted    = computeConflictedJoints(allTips);
    const sorted        = sortInjuryTips(injuryTips, conflicted);

    // The tip floated to position 0 is the conflicted one → banner present
    const firstLabel = deriveTipLabel(sorted[0], "injury", conflicted);
    expect(firstLabel).toBe(INJURY_CONFLICT_LABEL);

    // The tip at the end is the non-conflicted one → no banner
    const lastLabel = deriveTipLabel(sorted[sorted.length - 1], "injury", conflicted);
    expect(lastLabel).toBeNull();
  });

  it("pipeline: last sorted performance tip shows 'After injury risk is resolved', non-conflicted tip shows no label", () => {
    const conflicted = computeConflictedJoints(allTips);
    const sorted     = sortPerformanceTips(performanceTips, conflicted);

    // The tip sunk to the last position is the conflicted one → banner present
    const lastLabel = deriveTipLabel(sorted[sorted.length - 1], "performance", conflicted);
    expect(lastLabel).toBe(PERFORMANCE_CONFLICT_LABEL);

    // The tip at the front is the non-conflicted one → no banner
    const firstLabel = deriveTipLabel(sorted[0], "performance", conflicted);
    expect(firstLabel).toBeNull();
  });

  it("every label in the sorted injury list is correct: exactly one '⚠ Fix this first', one null", () => {
    const conflicted = computeConflictedJoints(allTips);
    const sorted     = sortInjuryTips(injuryTips, conflicted);
    const labels     = sorted.map((t) => deriveTipLabel(t, "injury", conflicted));
    expect(labels).toContain(INJURY_CONFLICT_LABEL);
    expect(labels).toContain(null);
    expect(labels.filter((l) => l === INJURY_CONFLICT_LABEL)).toHaveLength(1);
    expect(labels.filter((l) => l === null)).toHaveLength(1);
  });

  it("every label in the sorted performance list is correct: exactly one 'After injury risk is resolved', one null", () => {
    const conflicted = computeConflictedJoints(allTips);
    const sorted     = sortPerformanceTips(performanceTips, conflicted);
    const labels     = sorted.map((t) => deriveTipLabel(t, "performance", conflicted));
    expect(labels).toContain(PERFORMANCE_CONFLICT_LABEL);
    expect(labels).toContain(null);
    expect(labels.filter((l) => l === PERFORMANCE_CONFLICT_LABEL)).toHaveLength(1);
    expect(labels.filter((l) => l === null)).toHaveLength(1);
  });

  it("pipeline with no conflicts: all injury tip labels are null (no 'Fix this first' banner)", () => {
    const noConflictTips: TipForConflict[] = [
      { tipType: "injury",      severity: "warning", joints: ["leftHip"] },
      { tipType: "performance", severity: "info",    joints: ["rightKnee"] },
    ];
    const inj        = noConflictTips.filter((t) => t.tipType === "injury");
    const conflicted = computeConflictedJoints(noConflictTips);
    const sorted     = sortInjuryTips(inj, conflicted);
    sorted.forEach((t) => {
      expect(deriveTipLabel(t, "injury", conflicted)).toBeNull();
    });
  });

  it("pipeline with no conflicts: all performance tip labels are null (no 'After injury risk is resolved' banner)", () => {
    const noConflictTips: TipForConflict[] = [
      { tipType: "injury",      severity: "warning", joints: ["leftHip"] },
      { tipType: "performance", severity: "info",    joints: ["rightKnee"] },
    ];
    const perf       = noConflictTips.filter((t) => t.tipType === "performance" && t.severity === "info");
    const conflicted = computeConflictedJoints(noConflictTips);
    const sorted     = sortPerformanceTips(perf, conflicted);
    sorted.forEach((t) => {
      expect(deriveTipLabel(t, "performance", conflicted)).toBeNull();
    });
  });

  it("multiple conflicted joints: all shared joints get their tips labelled correctly", () => {
    const multiConflictTips: TipForConflict[] = [
      { tipType: "injury",      severity: "warning", joints: ["leftKnee", "rightHip"] },
      { tipType: "injury",      severity: "warning", joints: ["leftElbow"] },            // not conflicted
      { tipType: "performance", severity: "info",    joints: ["leftKnee"] },
      { tipType: "performance", severity: "info",    joints: ["rightHip", "rightElbow"] },
    ];
    const inj        = multiConflictTips.filter((t) => t.tipType === "injury");
    const perf       = multiConflictTips.filter((t) => t.tipType === "performance" && t.severity === "info");
    const conflicted = computeConflictedJoints(multiConflictTips);

    // leftKnee and rightHip are shared → both in conflictedJoints
    expect(conflicted.has("leftKnee")).toBe(true);
    expect(conflicted.has("rightHip")).toBe(true);
    expect(conflicted.has("leftElbow")).toBe(false);
    expect(conflicted.has("rightElbow")).toBe(false);

    // Injury tip covering leftKnee+rightHip → conflicted → "Fix this first"
    const sortedInj = sortInjuryTips(inj, conflicted);
    expect(deriveTipLabel(sortedInj[0], "injury", conflicted)).toBe(INJURY_CONFLICT_LABEL);

    // Injury tip covering leftElbow only → not conflicted → null
    const leftElbowInjTip = sortedInj.find((t) => t.joints?.includes("leftElbow"))!;
    expect(deriveTipLabel(leftElbowInjTip, "injury", conflicted)).toBeNull();

    // Both performance tips cover at least one conflicted joint → both labelled
    const sortedPerf = sortPerformanceTips(perf, conflicted);
    sortedPerf.forEach((t) => {
      expect(deriveTipLabel(t, "performance", conflicted)).toBe(PERFORMANCE_CONFLICT_LABEL);
    });
  });
});

