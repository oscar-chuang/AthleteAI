import { describe, it, expect } from "vitest";
import {
  SWIPE_THRESHOLD,
  SWIPE_VELOCITY_THRESHOLD,
  resolveAdjacentIds,
  shouldActivateSwipe,
  resolveSwipeDirection,
  resolveSwipeTranslation,
} from "../utils/swipeNavigation";

// ─────────────────────────────────────────────────────────────────────────────
// Tests: prevId / nextId index math
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveAdjacentIds — index math", () => {
  const ids = ["session-1", "session-2", "session-3", "session-4", "session-5"];

  it("middle item has correct currIndex, prevId, and nextId", () => {
    const { currIndex, prevId, nextId } = resolveAdjacentIds(ids, "session-3");
    expect(currIndex).toBe(2);
    expect(prevId).toBe("session-2");
    expect(nextId).toBe("session-4");
  });

  it("first item has no prevId and does have nextId", () => {
    const { currIndex, prevId, nextId } = resolveAdjacentIds(ids, "session-1");
    expect(currIndex).toBe(0);
    expect(prevId).toBeNull();
    expect(nextId).toBe("session-2");
  });

  it("last item has prevId and no nextId", () => {
    const { currIndex, prevId, nextId } = resolveAdjacentIds(ids, "session-5");
    expect(currIndex).toBe(4);
    expect(prevId).toBe("session-4");
    expect(nextId).toBeNull();
  });

  it("ID not in list returns currIndex -1 and both IDs null", () => {
    const { currIndex, prevId, nextId } = resolveAdjacentIds(ids, "session-99");
    expect(currIndex).toBe(-1);
    expect(prevId).toBeNull();
    expect(nextId).toBeNull();
  });

  it("null id returns currIndex -1 and both IDs null", () => {
    const { currIndex, prevId, nextId } = resolveAdjacentIds(ids, null);
    expect(currIndex).toBe(-1);
    expect(prevId).toBeNull();
    expect(nextId).toBeNull();
  });

  it("undefined id returns currIndex -1 and both IDs null", () => {
    const { currIndex, prevId, nextId } = resolveAdjacentIds(ids, undefined);
    expect(currIndex).toBe(-1);
    expect(prevId).toBeNull();
    expect(nextId).toBeNull();
  });

  it("single-item list: currIndex 0, no prev and no next", () => {
    const { currIndex, prevId, nextId } = resolveAdjacentIds(["solo"], "solo");
    expect(currIndex).toBe(0);
    expect(prevId).toBeNull();
    expect(nextId).toBeNull();
  });

  it("two-item list first item: no prev, has next", () => {
    const { prevId, nextId } = resolveAdjacentIds(["a", "b"], "a");
    expect(prevId).toBeNull();
    expect(nextId).toBe("b");
  });

  it("two-item list second item: has prev, no next", () => {
    const { prevId, nextId } = resolveAdjacentIds(["a", "b"], "b");
    expect(prevId).toBe("a");
    expect(nextId).toBeNull();
  });

  it("second item in a longer list resolves correctly", () => {
    const { currIndex, prevId, nextId } = resolveAdjacentIds(ids, "session-2");
    expect(currIndex).toBe(1);
    expect(prevId).toBe("session-1");
    expect(nextId).toBe("session-3");
  });

  it("second-to-last item in a longer list resolves correctly", () => {
    const { currIndex, prevId, nextId } = resolveAdjacentIds(ids, "session-4");
    expect(currIndex).toBe(3);
    expect(prevId).toBe("session-3");
    expect(nextId).toBe("session-5");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: swipe gesture discrimination (|dx| > |dy| * 1.5 && |dx| > 12)
// ─────────────────────────────────────────────────────────────────────────────

describe("shouldActivateSwipe — gesture discrimination", () => {
  it("activates when horizontal movement clearly dominates vertical", () => {
    expect(shouldActivateSwipe(30, 5)).toBe(true);
  });

  it("activates in the negative-dx direction too", () => {
    expect(shouldActivateSwipe(-30, 5)).toBe(true);
  });

  it("does not activate when |dx| ≤ 12 (below minimum move)", () => {
    expect(shouldActivateSwipe(12, 0)).toBe(false);
  });

  it("does not activate when vertical movement dominates", () => {
    // dy=20, dx=20 → |dx| is NOT > |dy| * 1.5 (20 > 30 is false)
    expect(shouldActivateSwipe(20, 20)).toBe(false);
  });

  it("does not activate on a diagonal gesture where vertical is comparable", () => {
    // dx=20, dy=15 → 20 > 15*1.5=22.5 is false
    expect(shouldActivateSwipe(20, 15)).toBe(false);
  });

  it("activates at exactly the 1.5× boundary when |dx| > 12", () => {
    // dx=30, dy=19 → |dx|=30 > 19*1.5=28.5 → true
    expect(shouldActivateSwipe(30, 19)).toBe(true);
  });

  it("does not activate when both dx and dy are zero", () => {
    expect(shouldActivateSwipe(0, 0)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: onPanResponderRelease navigation decision
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveSwipeDirection — navigation on release", () => {
  it("navigates to next when dx exceeds negative threshold and nextId exists", () => {
    expect(resolveSwipeDirection(-70, 0, "prev-id", "next-id")).toBe("next");
  });

  it("navigates to prev when dx exceeds positive threshold and prevId exists", () => {
    expect(resolveSwipeDirection(70, 0, "prev-id", "next-id")).toBe("prev");
  });

  it("navigates to next via velocity alone (slow swipe, fast flick)", () => {
    expect(resolveSwipeDirection(-10, -0.5, "prev-id", "next-id")).toBe("next");
  });

  it("navigates to prev via velocity alone", () => {
    expect(resolveSwipeDirection(10, 0.5, "prev-id", "next-id")).toBe("prev");
  });

  it("returns none when dx is below threshold and velocity is below threshold", () => {
    expect(resolveSwipeDirection(-30, -0.2, "prev-id", "next-id")).toBe("none");
  });

  it("returns none when navigating next but nextId is null (boundary)", () => {
    expect(resolveSwipeDirection(-70, 0, "prev-id", null)).toBe("none");
  });

  it("returns none when navigating prev but prevId is null (boundary)", () => {
    expect(resolveSwipeDirection(70, 0, null, "next-id")).toBe("none");
  });

  it("returns none when both IDs are null and gesture exceeds threshold", () => {
    expect(resolveSwipeDirection(-70, -1.0, null, null)).toBe("none");
  });

  it("exactly at SWIPE_THRESHOLD does NOT trigger navigation (< required)", () => {
    // dx = -SWIPE_THRESHOLD → -60 < -60 is false; vx below velocity threshold
    expect(resolveSwipeDirection(-SWIPE_THRESHOLD, 0, "prev-id", "next-id")).toBe("none");
  });

  it("one unit past SWIPE_THRESHOLD triggers navigation", () => {
    expect(resolveSwipeDirection(-(SWIPE_THRESHOLD + 1), 0, "prev-id", "next-id")).toBe("next");
  });

  it("exactly at SWIPE_VELOCITY_THRESHOLD does NOT trigger navigation", () => {
    // vx = -SWIPE_VELOCITY_THRESHOLD → -0.4 < -0.4 is false
    expect(resolveSwipeDirection(0, -SWIPE_VELOCITY_THRESHOLD, "prev-id", "next-id")).toBe("none");
  });

  it("slightly past SWIPE_VELOCITY_THRESHOLD triggers navigation", () => {
    expect(resolveSwipeDirection(0, -(SWIPE_VELOCITY_THRESHOLD + 0.01), "prev-id", "next-id")).toBe("next");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: rubber-band resistance during pan move
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveSwipeTranslation — rubber-band resistance at boundaries", () => {
  it("returns dx unchanged when both IDs exist (no resistance)", () => {
    expect(resolveSwipeTranslation(80, "prev-id", "next-id")).toBe(80);
    expect(resolveSwipeTranslation(-80, "prev-id", "next-id")).toBe(-80);
  });

  it("applies 0.18× resistance when swiping right (prev) with no prevId", () => {
    expect(resolveSwipeTranslation(100, null, "next-id")).toBeCloseTo(18);
  });

  it("applies 0.18× resistance when swiping left (next) with no nextId", () => {
    expect(resolveSwipeTranslation(-100, "prev-id", null)).toBeCloseTo(-18);
  });

  it("applies resistance when both IDs are null and swiping right", () => {
    expect(resolveSwipeTranslation(50, null, null)).toBeCloseTo(9);
  });

  it("applies resistance when both IDs are null and swiping left", () => {
    expect(resolveSwipeTranslation(-50, null, null)).toBeCloseTo(-9);
  });

  it("does not apply resistance when swiping left (next) with a valid nextId", () => {
    const result = resolveSwipeTranslation(-60, null, "next-id");
    expect(result).toBe(-60);
  });

  it("does not apply resistance when swiping right (prev) with a valid prevId", () => {
    const result = resolveSwipeTranslation(60, "prev-id", null);
    expect(result).toBe(60);
  });
});
