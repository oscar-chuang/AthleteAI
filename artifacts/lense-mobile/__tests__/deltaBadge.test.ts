/**
 * Confirms that a single-session list produces a null delta result, meaning
 * the session card's badge branch is never entered.
 *
 * The render-layer counterpart (no badge in the tree) lives alongside this in
 * components/__tests__/DeltaBadge.test.tsx under the
 * "DeltaBadge — null info skips rendering" describe block.
 */

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
    uploadedAt: `2025-06-${String(_id).padStart(2, "0")}T10:00:00Z`,
    ...overrides,
  };
}

// ── Single-session: no delta ──────────────────────────────────────────────────

describe("DeltaBadge — single session produces no delta", () => {
  it("computeBestDelta returns null when the session list has only one entry", () => {
    const only = makeAnalysis({
      jointAngles: { leftKnee: 170, rightKnee: 168 },
      jointRisks:  { leftKnee: 1,   rightKnee: 1 },
    });

    expect(computeBestDelta(only, [only])).toBeNull();
  });

  it("a null delta carries no label text or colour (session-card badge branch is skipped)", () => {
    const only = makeAnalysis({
      jointAngles: { leftKnee: 170, rightKnee: 168 },
      jointRisks:  { leftKnee: 1,   rightKnee: 1 },
    });

    const deltaBadge = computeBestDelta(only, [only]);

    // The session card renders: {deltaBadge && <DeltaBadge info={deltaBadge} />}
    // When deltaBadge is null the guard short-circuits — no label or style props exist.
    expect(deltaBadge).toBeNull();
    expect(deltaBadge?.jointLabel).toBeUndefined();
    expect(deltaBadge?.color).toBeUndefined();
  });
});
