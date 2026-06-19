import { describe, it, expect } from "vitest";
import { computeScheduleSummary } from "../scheduleUtils";

/**
 * Unit tests for computeScheduleSummary — the function that drives the
 * schedule label ("M · W · F") shown on the Home screen "This Week" card.
 *
 * Two behaviours locked in by the task:
 *   1. Returns the correct abbreviated string for a partial schedule.
 *   2. Returns null (label hidden) when all 7 days are active.
 */

describe("computeScheduleSummary", () => {
  describe("returns null when all 7 days are active", () => {
    it("null for canonical [0..6] input", () => {
      expect(computeScheduleSummary([0, 1, 2, 3, 4, 5, 6])).toBeNull();
    });

    it("null regardless of input array order", () => {
      expect(computeScheduleSummary([6, 5, 4, 3, 2, 1, 0])).toBeNull();
    });

    it("null when duplicate entries still collapse to 7 unique days", () => {
      expect(computeScheduleSummary([0, 0, 1, 2, 3, 4, 5, 6])).toBeNull();
    });
  });

  describe("returns a correctly formatted string for partial schedules", () => {
    it("Mon · Wed · Fri for [1, 3, 5]", () => {
      expect(computeScheduleSummary([1, 3, 5])).toBe("M · W · F");
    });

    it("weekdays only [1,2,3,4,5] → M · T · W · T · F", () => {
      expect(computeScheduleSummary([1, 2, 3, 4, 5])).toBe("M · T · W · T · F");
    });

    it("weekend only [0, 6] → S · S", () => {
      expect(computeScheduleSummary([0, 6])).toBe("S · S");
    });

    it("single day [3] → W", () => {
      expect(computeScheduleSummary([3])).toBe("W");
    });

    it("sorts days by index regardless of input order ([6, 1] → M · S)", () => {
      expect(computeScheduleSummary([6, 1])).toBe("M · S");
    });

    it("six days excluding Sunday [1..6] → non-null label", () => {
      expect(computeScheduleSummary([1, 2, 3, 4, 5, 6])).toBe("M · T · W · T · F · S");
    });

    it("six days excluding Saturday [0..5] → non-null label", () => {
      expect(computeScheduleSummary([0, 1, 2, 3, 4, 5])).toBe("S · M · T · W · T · F");
    });
  });

  describe("edge cases", () => {
    it("empty array → empty string (no days configured)", () => {
      expect(computeScheduleSummary([])).toBe("");
    });

    it("deduplicates repeated indices ([1, 1, 3] → M · W)", () => {
      expect(computeScheduleSummary([1, 1, 3])).toBe("M · W");
    });
  });
});
