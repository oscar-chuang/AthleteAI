/**
 * Tests that the weekly-goal confetti fires exactly once when the goal is
 * crossed, and never fires on subsequent loads or on the very first load.
 *
 * This file tests the real `checkConfettiGate` function extracted into
 * `artifacts/lense-mobile/utils/confettiGate.ts`.
 *
 * The wrapper `simulateLoadDataConfetti` mirrors the relevant portion of
 * `loadData` in `app/(tabs)/index.tsx`:
 *
 *   const statsResult = await profileApi.stats();           ← mocked below
 *   const currentCount = statsResult.thisWeekCount ?? 0;
 *   const fired = await checkConfettiGate(                  ← real function
 *     weeklyGoal, currentCount, weekKey, AsyncStorage       ← storage injected
 *   );
 *   if (fired) setShowConfetti(true);
 *
 * Mocking strategy:
 *   - `profileApi.stats()` is replaced with a `vi.fn()` so tests control the
 *     count sequence returned on successive loads.
 *   - AsyncStorage is an in-memory fake that implements the same interface the
 *     gate function accepts — no React Native module import needed.
 *
 * Key invariants under test:
 *   1. Confetti fires when prevCount < weeklyGoal and currentCount >= weeklyGoal.
 *   2. Confetti does NOT fire on the next load — the celebrated flag prevents it.
 *   3. Confetti does NOT fire on the very first load — prevCount is null so
 *      justCrossed is false (no pending flag either).
 *   4. Confetti fires when the pending flag is set (written by analyze.tsx on
 *      upload), even before a prevCount snapshot exists.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkConfettiGate, type AsyncStorageLike } from "../utils/confettiGate";

// ── Minimal fake storage (injectable AsyncStorage stand-in) ───────────────────

function makeFakeStorage(): { storage: AsyncStorageLike; store: Record<string, string> } {
  const store: Record<string, string> = {};
  const storage: AsyncStorageLike = {
    getItem:    vi.fn(async (k)    => store[k] ?? null),
    setItem:    vi.fn(async (k, v) => { store[k] = v; }),
    removeItem: vi.fn(async (k)    => { delete store[k]; }),
  };
  return { storage, store };
}

// ── Mock of profileApi.stats() ────────────────────────────────────────────────
// Returns { thisWeekCount } — the only field consumed by the confetti gate.

type StatsResult = { thisWeekCount: number };

// ── Wrapper mirroring the confetti portion of loadData ────────────────────────

async function simulateLoadDataConfetti(
  // Typed as `any` so vi.fn() MockInstance is assignable here.
  // The internal cast to StatsResult keeps access to thisWeekCount safe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchStats:  (...args: any[]) => unknown,  // mock of profileApi.stats()
  weeklyGoal:  number,
  weekKey:     string,
  storage:     AsyncStorageLike,
): Promise<boolean> {
  const statsResult  = (await fetchStats()) as StatsResult;
  const currentCount = statsResult.thisWeekCount ?? 0;
  return checkConfettiGate(weeklyGoal, currentCount, weekKey, storage);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const WEEK_KEY    = "2026-06-15"; // fixed so tests are deterministic
const WEEKLY_GOAL = 3;

describe("home screen — confetti fires exactly once when weekly goal is crossed", () => {
  let storage: AsyncStorageLike;
  let store:   Record<string, string>;
  // vi.fn() returns MockInstance which has both call + construct signatures.
  // Declaring as `any` lets us pass it freely while retaining mock methods.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchStats: any;

  beforeEach(() => {
    ({ storage, store } = makeFakeStorage());
    fetchStats = vi.fn();
  });

  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("fires confetti when profileApi.stats() count crosses the weekly goal threshold", async () => {
    // Load 1: profileApi.stats() returns 2 sessions — below goal of 3.
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 2 });
    const load1 = await simulateLoadDataConfetti(fetchStats, WEEKLY_GOAL, WEEK_KEY, storage);
    expect(load1).toBe(false);
    expect(store[`confetti_prev_count_${WEEK_KEY}`]).toBe("2");

    // Load 2: profileApi.stats() now returns 3 — goal just crossed!
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 3 });
    const load2 = await simulateLoadDataConfetti(fetchStats, WEEKLY_GOAL, WEEK_KEY, storage);
    expect(load2).toBe(true);

    expect(fetchStats).toHaveBeenCalledTimes(2);
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("does NOT fire confetti on the next loadData() call — celebrated flag prevents it", async () => {
    // Load 1: 2 sessions (below goal)
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 2 });
    await simulateLoadDataConfetti(fetchStats, WEEKLY_GOAL, WEEK_KEY, storage);

    // Load 2: 3 sessions — goal crossed; confetti fires and celebrated is written
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 3 });
    const load2 = await simulateLoadDataConfetti(fetchStats, WEEKLY_GOAL, WEEK_KEY, storage);
    expect(load2).toBe(true);
    expect(store[`confetti_celebrated_${WEEK_KEY}`]).toBe("true");

    // Load 3: still 3 sessions — celebrated flag must block confetti
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 3 });
    const load3 = await simulateLoadDataConfetti(fetchStats, WEEKLY_GOAL, WEEK_KEY, storage);
    expect(load3).toBe(false);

    // Load 4: count rises further — still no second celebration
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 5 });
    const load4 = await simulateLoadDataConfetti(fetchStats, WEEKLY_GOAL, WEEK_KEY, storage);
    expect(load4).toBe(false);

    expect(fetchStats).toHaveBeenCalledTimes(4);
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it("does NOT fire confetti on first-ever load — prevCount is null so justCrossed is false", async () => {
    // Storage is empty: no prevCount, no pending, no celebrated.
    // Even if profileApi.stats() already reports a count above the goal
    // (e.g. data imported from another device), confetti must NOT fire
    // because we can't confirm the threshold was just crossed this week.
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 5 });
    const firstEverLoad = await simulateLoadDataConfetti(fetchStats, WEEKLY_GOAL, WEEK_KEY, storage);
    expect(firstEverLoad).toBe(false);

    // prevCountKey should be written so the next load has a snapshot
    expect(store[`confetti_prev_count_${WEEK_KEY}`]).toBe("5");
    expect(fetchStats).toHaveBeenCalledTimes(1);
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────

  it("fires confetti when the pending flag is set by analyze.tsx, even without a prevCount snapshot", async () => {
    // analyze.tsx writes a pending flag the moment an upload pushes the count to the goal.
    store[`confetti_pending_${WEEK_KEY}`] = "true";

    // Storage has no prevCount yet (first Home load after the upload).
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 3 });
    const fired = await simulateLoadDataConfetti(fetchStats, WEEKLY_GOAL, WEEK_KEY, storage);
    expect(fired).toBe(true);

    // Pending flag must be consumed so it cannot re-trigger
    expect(store[`confetti_pending_${WEEK_KEY}`]).toBeUndefined();
    // Celebrated flag must be written to prevent a second fire
    expect(store[`confetti_celebrated_${WEEK_KEY}`]).toBe("true");

    // Subsequent load with the same count must NOT fire again
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 3 });
    const secondLoad = await simulateLoadDataConfetti(fetchStats, WEEKLY_GOAL, WEEK_KEY, storage);
    expect(secondLoad).toBe(false);
  });
});
