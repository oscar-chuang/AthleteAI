import { describe, it, expect } from "vitest";
import { computeBestDelta } from "../lib/sessionDelta";
import type { AnalysisRecord } from "../lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

let _id = 0;
function makeAnalysis(
  overrides: Partial<AnalysisRecord> & { uploadedAt?: string }
): AnalysisRecord {
  _id++;
  return {
    id: String(_id),
    userId: "u1",
    title: "Session",
    sport: "running",
    status: "complete",
    strengths: [],
    improvements: [],
    uploadedAt: `2025-01-${String(_id).padStart(2, "0")}T10:00:00Z`,
    ...overrides,
  };
}

const BASE_ANGLES = { leftKnee: 170, rightKnee: 168, leftHip: 90 };
const BASE_RISKS  = { leftKnee: 1,   rightKnee: 1,   leftHip: 1 };

// ── computeBestDelta ──────────────────────────────────────────────────────────

describe("computeBestDelta — color and joint selection", () => {
  it("returns green when a joint risk improves (lower risk in current)", () => {
    const prev    = makeAnalysis({ jointAngles: { leftKnee: 160 }, jointRisks: { leftKnee: 2 } });
    const current = makeAnalysis({ jointAngles: { leftKnee: 170 }, jointRisks: { leftKnee: 1 } });
    const result  = computeBestDelta(current, [prev, current]);

    expect(result).not.toBeNull();
    expect(result!.color).toBe("#22c55e");
    expect(result!.jointLabel).toBe("L Knee");
    expect(result!.delta).toBe(10);
    expect(result!.sign).toBe("+");
  });

  it("returns red when a joint risk worsens (higher risk in current)", () => {
    const prev    = makeAnalysis({ jointAngles: { leftHip: 90 }, jointRisks: { leftHip: 0 } });
    const current = makeAnalysis({ jointAngles: { leftHip: 75 }, jointRisks: { leftHip: 2 } });
    const result  = computeBestDelta(current, [prev, current]);

    expect(result).not.toBeNull();
    expect(result!.color).toBe("#ef4444");
    expect(result!.jointLabel).toBe("L Hip");
    expect(result!.delta).toBe(-15);
    expect(result!.sign).toBe("-");
  });

  it("returns amber when risk is unchanged but angle changed", () => {
    const prev    = makeAnalysis({ jointAngles: { rightKnee: 160 }, jointRisks: { rightKnee: 1 } });
    const current = makeAnalysis({ jointAngles: { rightKnee: 165 }, jointRisks: { rightKnee: 1 } });
    const result  = computeBestDelta(current, [prev, current]);

    expect(result).not.toBeNull();
    expect(result!.color).toBe("#f59e0b");
    expect(result!.jointLabel).toBe("R Knee");
  });

  it("returns amber when jointRisks are absent but angle changed", () => {
    const prev    = makeAnalysis({ jointAngles: { leftElbow: 100 } });
    const current = makeAnalysis({ jointAngles: { leftElbow: 110 } });
    const result  = computeBestDelta(current, [prev, current]);

    expect(result).not.toBeNull();
    expect(result!.color).toBe("#f59e0b");
    expect(result!.jointLabel).toBe("L Elbow");
  });

  it("prefers improvement (green) over regression (red) when both exist", () => {
    const prev = makeAnalysis({
      jointAngles: { leftKnee: 160, rightHip: 90 },
      jointRisks:  { leftKnee: 2,   rightHip: 0 },
    });
    const current = makeAnalysis({
      jointAngles: { leftKnee: 170, rightHip: 80 },
      jointRisks:  { leftKnee: 1,   rightHip: 1 },
    });
    const result = computeBestDelta(current, [prev, current]);

    expect(result).not.toBeNull();
    expect(result!.color).toBe("#22c55e");
    expect(result!.jointLabel).toBe("L Knee");
  });

  it("picks the joint with the largest absolute angle delta when multiple improvements exist", () => {
    const prev = makeAnalysis({
      jointAngles: { leftKnee: 160, rightKnee: 160 },
      jointRisks:  { leftKnee: 2,   rightKnee: 2 },
    });
    const current = makeAnalysis({
      jointAngles: { leftKnee: 168, rightKnee: 171 },
      jointRisks:  { leftKnee: 1,   rightKnee: 1 },
    });
    const result = computeBestDelta(current, [prev, current]);

    expect(result).not.toBeNull();
    expect(result!.color).toBe("#22c55e");
    expect(result!.jointLabel).toBe("R Knee");
    expect(result!.delta).toBe(11);
  });
});

describe("computeBestDelta — edge cases", () => {
  it("returns null when there is no predecessor (only one session)", () => {
    const only = makeAnalysis({ jointAngles: BASE_ANGLES, jointRisks: BASE_RISKS });
    expect(computeBestDelta(only, [only])).toBeNull();
  });

  it("returns null when current session has no jointAngles", () => {
    const prev    = makeAnalysis({ jointAngles: BASE_ANGLES, jointRisks: BASE_RISKS });
    const current = makeAnalysis({ jointAngles: undefined });
    expect(computeBestDelta(current, [prev, current])).toBeNull();
  });

  it("returns null when the predecessor has no jointAngles", () => {
    const prev    = makeAnalysis({ jointAngles: undefined });
    const current = makeAnalysis({ jointAngles: BASE_ANGLES, jointRisks: BASE_RISKS });
    expect(computeBestDelta(current, [prev, current])).toBeNull();
  });

  it("returns null when the angle delta rounds to zero for every joint", () => {
    const angles = { leftKnee: 170.4, rightKnee: 168.3 };
    const risks  = { leftKnee: 1, rightKnee: 1 };
    const prev    = makeAnalysis({ jointAngles: { leftKnee: 170.1, rightKnee: 168.1 }, jointRisks: risks });
    const current = makeAnalysis({ jointAngles: angles, jointRisks: risks });
    expect(computeBestDelta(current, [prev, current])).toBeNull();
  });

  it("ignores sessions with status !== complete when finding the predecessor", () => {
    const pending = makeAnalysis({
      status: "pending",
      jointAngles: { leftKnee: 160 },
      jointRisks:  { leftKnee: 2 },
    });
    const current = makeAnalysis({ jointAngles: { leftKnee: 170 }, jointRisks: { leftKnee: 1 } });
    expect(computeBestDelta(current, [pending, current])).toBeNull();
  });

  it("uses the closest preceding completed session (by uploadedAt), not just list order", () => {
    const old     = makeAnalysis({ uploadedAt: "2025-01-01T00:00:00Z", jointAngles: { leftKnee: 150 }, jointRisks: { leftKnee: 2 } });
    const newer   = makeAnalysis({ uploadedAt: "2025-01-05T00:00:00Z", jointAngles: { leftKnee: 160 }, jointRisks: { leftKnee: 2 } });
    const current = makeAnalysis({ uploadedAt: "2025-01-10T00:00:00Z", jointAngles: { leftKnee: 170 }, jointRisks: { leftKnee: 1 } });
    const result  = computeBestDelta(current, [old, newer, current]);

    expect(result).not.toBeNull();
    expect(result!.delta).toBe(10);
  });
});
