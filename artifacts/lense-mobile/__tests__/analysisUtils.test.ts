import { describe, it, expect } from "vitest";
import {
  computeFlaggedJoints,
  computeWorstLvl,
  computeConflictedJoints,
  type JointKey,
  type RiskMap,
  type TipForConflict,
} from "../utils/analysisUtils";

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
