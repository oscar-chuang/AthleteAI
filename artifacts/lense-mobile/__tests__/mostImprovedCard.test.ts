import { describe, it, expect } from "vitest";
import { computeMostImproved } from "../lib/jointImprovement";
import type { JointImprovement } from "../lib/api";

function imp(joint: string, deltaDeg: number, improved: boolean, sessions = 3): JointImprovement {
  return { joint, deltaDeg, improved, sessions };
}

describe("computeMostImproved", () => {
  it("returns null for undefined input", () => {
    expect(computeMostImproved(undefined)).toBeNull();
  });

  it("returns null for null input", () => {
    expect(computeMostImproved(null)).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(computeMostImproved([])).toBeNull();
  });

  it("returns null when no entry has improved === true", () => {
    const data = [imp("leftKnee", 10, false), imp("rightKnee", 8, false)];
    expect(computeMostImproved(data)).toBeNull();
  });

  it("returns null when improved entries all have deltaDeg <= 0", () => {
    const data = [imp("leftKnee", 0, true), imp("rightKnee", -5, true)];
    expect(computeMostImproved(data)).toBeNull();
  });

  it("returns the single positive improved entry", () => {
    const data = [imp("leftKnee", 12, true)];
    expect(computeMostImproved(data)).toEqual(data[0]);
  });

  it("picks the entry with the highest deltaDeg", () => {
    const data = [
      imp("leftKnee", 5, true),
      imp("rightHip", 15, true),
      imp("leftAnkle", 10, true),
    ];
    expect(computeMostImproved(data)?.joint).toBe("rightHip");
  });

  it("ignores entries where improved is false even if deltaDeg is large", () => {
    const data = [
      imp("leftKnee", 3, true),
      imp("rightHip", 99, false),
    ];
    expect(computeMostImproved(data)?.joint).toBe("leftKnee");
  });

  it("ignores entries where deltaDeg <= 0 even if improved is true", () => {
    const data = [
      imp("leftKnee", 7, true),
      imp("rightHip", 0, true),
      imp("leftAnkle", -2, true),
    ];
    expect(computeMostImproved(data)?.joint).toBe("leftKnee");
  });

  it("returns the first max when two entries share the highest deltaDeg", () => {
    const data = [
      imp("leftKnee", 10, true),
      imp("rightKnee", 10, true),
    ];
    expect(computeMostImproved(data)?.joint).toBe("leftKnee");
  });
});
