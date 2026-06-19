/**
 * Tests that the weekly-goal confetti fires exactly once when the goal is
 * crossed, and never fires on subsequent loads or on the very first load.
 *
 * This file tests the real functions extracted into
 * `artifacts/lense-mobile/utils/confettiGate.ts`:
 *   - checkConfettiGate
 *   - persistCelebrationToServer
 *   - retryCelebrationSync
 *
 * The wrapper `simulateLoadDataConfetti` mirrors the relevant portion of
 * `loadData` in `app/(tabs)/index.tsx`:
 *
 *   const weekKey = getWeekKey();
 *   await retryCelebrationSync(weekKey, AsyncStorage, persistFn);
 *   const currentCount = statsResult.thisWeekCount ?? 0;
 *   const fired = await checkConfettiGate(
 *     weeklyGoal, currentCount, weekKey, AsyncStorage,
 *     serverCelebratedWeekKey,
 *   );
 *   if (fired) {
 *     await persistCelebrationToServer(weekKey, AsyncStorage, persistFn);
 *   }
 *
 * Mocking strategy:
 *   - `profileApi.stats()` is replaced with a `vi.fn()` so tests control the
 *     count sequence returned on successive loads.
 *   - AsyncStorage is an in-memory fake that implements the same interface the
 *     gate function accepts — no React Native module import needed.
 *   - The server persist function is a `vi.fn()` whose resolved/rejected state
 *     controls success / failure scenarios.
 *
 * Key invariants under test:
 *   1. Confetti fires when prevCount < weeklyGoal and currentCount >= weeklyGoal.
 *   2. Confetti does NOT fire on the next load — the celebrated flag prevents it.
 *   3. Confetti does NOT fire on the very first load — prevCount is null so
 *      justCrossed is false (no pending flag either).
 *   4. Confetti fires when the pending flag is set (written by analyze.tsx on
 *      upload), even before a prevCount snapshot exists.
 *   5. Confetti does NOT fire after reinstall when the server flag matches the
 *      current week key (server-side durability path).
 *   6. A server flag from a previous week does NOT suppress confetti for the
 *      current week.
 *   7. persistCelebrationToServer: success clears the sync marker.
 *   8. persistCelebrationToServer: failure leaves the sync marker for retry.
 *   9. retryCelebrationSync: retries when a sync marker exists and clears on success.
 *  10. retryCelebrationSync: leaves the marker when the retry also fails.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkConfettiGate,
  persistCelebrationToServer,
  retryCelebrationSync,
  type AsyncStorageLike,
} from "../utils/confettiGate";

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
  fetchStats:               (...args: any[]) => unknown,
  weeklyGoal:               number,
  weekKey:                  string,
  storage:                  AsyncStorageLike,
  serverCelebratedWeekKey?: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  persistFn?:               (...args: any[]) => Promise<void>,
): Promise<boolean> {
  // Mirror the retry-sync step that runs at the top of loadData.
  if (persistFn) {
    await retryCelebrationSync(weekKey, storage, persistFn);
  }

  const statsResult  = (await fetchStats()) as StatsResult;
  const currentCount = statsResult.thisWeekCount ?? 0;

  const fired = await checkConfettiGate(
    weeklyGoal,
    currentCount,
    weekKey,
    storage,
    serverCelebratedWeekKey,
  );

  if (fired && persistFn) {
    await persistCelebrationToServer(weekKey, storage, persistFn);
  }

  return fired;
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

  // ── Test 5 — server-side durability (reinstall path) ────────────────────────

  it("does NOT fire confetti after reinstall when server flag matches the current week key", async () => {
    // Simulate: user has already reached their goal this week and the server recorded
    // the celebration (weeklyGoalCelebratedAt = WEEK_KEY). Then they reinstall the app,
    // wiping AsyncStorage entirely.  On the first load the server flag is available.
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 3 });
    const fired = await simulateLoadDataConfetti(
      fetchStats,
      WEEKLY_GOAL,
      WEEK_KEY,
      storage,
      WEEK_KEY, // server says this week was already celebrated
    );
    expect(fired).toBe(false);

    // The gate should have written the local celebrated flag so subsequent loads
    // are also blocked without a server round-trip.
    expect(store[`confetti_celebrated_${WEEK_KEY}`]).toBe("true");
    expect(fetchStats).toHaveBeenCalledTimes(1);
  });

  // ── Test 6 — stale server flag from a previous week ──────────────────────────

  it("does NOT suppress confetti when the server flag is from a previous week", async () => {
    const PREV_WEEK_KEY = "2026-06-08"; // different week

    // Load 1: 2 sessions — below goal; server flag is from last week (irrelevant).
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 2 });
    await simulateLoadDataConfetti(fetchStats, WEEKLY_GOAL, WEEK_KEY, storage, PREV_WEEK_KEY);

    // Load 2: 3 sessions — goal just crossed; server flag still from last week.
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 3 });
    const fired = await simulateLoadDataConfetti(
      fetchStats,
      WEEKLY_GOAL,
      WEEK_KEY,
      storage,
      PREV_WEEK_KEY,
    );
    expect(fired).toBe(true);
    expect(fetchStats).toHaveBeenCalledTimes(2);
  });

  // ── Test 7 — goal lowered mid-week after celebration (AsyncStorage path) ──────

  it("does NOT re-fire confetti when the user lowers their weekly goal after already celebrating", async () => {
    // Phase 1: user has goal=3, completes 2 sessions (below goal).
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 2 });
    const load1 = await simulateLoadDataConfetti(fetchStats, WEEKLY_GOAL, WEEK_KEY, storage);
    expect(load1).toBe(false);

    // Phase 2: user completes a 3rd session — goal crossed, confetti fires.
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 3 });
    const load2 = await simulateLoadDataConfetti(fetchStats, WEEKLY_GOAL, WEEK_KEY, storage);
    expect(load2).toBe(true);
    // Celebrated flag must now be set in AsyncStorage.
    expect(store[`confetti_celebrated_${WEEK_KEY}`]).toBe("true");

    // Phase 3: user lowers their goal to 2 mid-week (still 3 sessions this week).
    // currentCount (3) >= newGoal (2) — without the gate this would look like a
    // "goal just crossed" event, potentially re-firing the confetti.
    const LOWER_GOAL = 2;
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 3 });
    const load3 = await simulateLoadDataConfetti(fetchStats, LOWER_GOAL, WEEK_KEY, storage);
    expect(load3).toBe(false); // celebrated flag must block the re-fire

    // Phase 4: a further reload with the lower goal still must not fire.
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 3 });
    const load4 = await simulateLoadDataConfetti(fetchStats, LOWER_GOAL, WEEK_KEY, storage);
    expect(load4).toBe(false);

    expect(fetchStats).toHaveBeenCalledTimes(4);
  });

  // ── Test 8 — reinstall + goal change (server-flag path) ──────────────────────

  it("does NOT re-fire confetti after reinstall when the server flag matches the current week, even if the goal was subsequently lowered", async () => {
    // Scenario: user celebrated at goal=3 (server recorded weeklyGoalCelebratedAt=WEEK_KEY),
    // then reinstalled the app (AsyncStorage wiped) and lowered their goal to 2.
    // Even though currentCount (3) >= newGoal (2), the server flag must block confetti.
    const LOWER_GOAL = 2;
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 3 });
    const firstLoadAfterReinstall = await simulateLoadDataConfetti(
      fetchStats,
      LOWER_GOAL,
      WEEK_KEY,
      storage,
      WEEK_KEY, // server recorded celebration for this exact week
    );
    expect(firstLoadAfterReinstall).toBe(false);

    // The gate must have written the local celebrated flag so subsequent loads
    // are blocked without needing another server round-trip.
    expect(store[`confetti_celebrated_${WEEK_KEY}`]).toBe("true");

    // Subsequent load after the flag is cached locally must also be blocked.
    fetchStats.mockResolvedValueOnce({ thisWeekCount: 3 });
    const secondLoad = await simulateLoadDataConfetti(
      fetchStats,
      LOWER_GOAL,
      WEEK_KEY,
      storage,
      WEEK_KEY,
    );
    expect(secondLoad).toBe(false);

    expect(fetchStats).toHaveBeenCalledTimes(2);
  });
});

// ── Server-sync durability tests ───────────────────────────────────────────────

describe("persistCelebrationToServer + retryCelebrationSync", () => {
  let storage: AsyncStorageLike;
  let store:   Record<string, string>;

  beforeEach(() => {
    ({ storage, store } = makeFakeStorage());
  });

  // ── Test 7 ──────────────────────────────────────────────────────────────────

  it("persistCelebrationToServer clears the sync marker on success", async () => {
    const persistFn = vi.fn().mockResolvedValue(undefined);

    await persistCelebrationToServer(WEEK_KEY, storage, persistFn);

    expect(persistFn).toHaveBeenCalledWith(WEEK_KEY);
    // Sync marker must be cleared after a successful write.
    expect(store[`confetti_server_sync_${WEEK_KEY}`]).toBeUndefined();
  });

  // ── Test 8 ──────────────────────────────────────────────────────────────────

  it("persistCelebrationToServer leaves the sync marker when persistFn fails", async () => {
    const persistFn = vi.fn().mockRejectedValue(new Error("network error"));

    await persistCelebrationToServer(WEEK_KEY, storage, persistFn);

    expect(persistFn).toHaveBeenCalledWith(WEEK_KEY);
    // Marker must remain so retryCelebrationSync can retry on the next load.
    expect(store[`confetti_server_sync_${WEEK_KEY}`]).toBe("true");
  });

  // ── Test 9 ──────────────────────────────────────────────────────────────────

  it("retryCelebrationSync retries when a sync marker exists and clears it on success", async () => {
    // Simulate a previously failed write by pre-seeding the sync marker.
    store[`confetti_server_sync_${WEEK_KEY}`] = "true";

    const persistFn = vi.fn().mockResolvedValue(undefined);
    await retryCelebrationSync(WEEK_KEY, storage, persistFn);

    expect(persistFn).toHaveBeenCalledWith(WEEK_KEY);
    // Marker cleared on successful retry.
    expect(store[`confetti_server_sync_${WEEK_KEY}`]).toBeUndefined();
  });

  // ── Test 10 ─────────────────────────────────────────────────────────────────

  it("retryCelebrationSync leaves the marker when the retry also fails", async () => {
    store[`confetti_server_sync_${WEEK_KEY}`] = "true";

    const persistFn = vi.fn().mockRejectedValue(new Error("still offline"));
    await retryCelebrationSync(WEEK_KEY, storage, persistFn);

    expect(persistFn).toHaveBeenCalledWith(WEEK_KEY);
    // Marker must remain so the next loadData can try again.
    expect(store[`confetti_server_sync_${WEEK_KEY}`]).toBe("true");
  });

  // ── Test 11 ─────────────────────────────────────────────────────────────────

  it("retryCelebrationSync does nothing when there is no pending sync marker", async () => {
    const persistFn = vi.fn();
    await retryCelebrationSync(WEEK_KEY, storage, persistFn);

    // persistFn must not be called — no marker means nothing to retry.
    expect(persistFn).not.toHaveBeenCalled();
  });
});
