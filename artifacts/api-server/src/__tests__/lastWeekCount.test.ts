/**
 * Verifies that lastWeekCount never includes sessions uploaded on rest days —
 * days whose weekday index is absent from the user's trainingDays schedule.
 *
 * Uses the same Sunday = day-0 convention as weeklySessionCount.test.ts.
 * "Today" is pinned to Monday 2024-01-08 so all date arithmetic is
 * deterministic and independent of when the suite runs.
 *
 * Last-week window: Sun 2023-12-31 (inclusive) → Sat 2024-01-06 (inclusive),
 * i.e. [lastWeekStart, weekStart).
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// ─── Pin time before any imports that call new Date() at module level ─────────

// 2024-01-08 is a Monday (getDay() === 1).
// weekStart  = 2024-01-07 (Sunday).
// lastWeekStart = 2023-12-31 (Sunday, one week earlier).
const FIXED_TODAY = new Date("2024-01-08T12:00:00.000Z");

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED_TODAY); });
afterAll(() => { vi.useRealTimers(); });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build an ISO timestamp string for a given date string at noon UTC. */
function ts(dateStr: string): string {
  return `${dateStr}T12:00:00.000Z`;
}

// ─── DB mock ──────────────────────────────────────────────────────────────────

let mockRows: { uploadedAt: Date }[] = [];

vi.mock("@workspace/db", () => {
  const orderBy = () => Promise.resolve(mockRows);
  const where   = () => ({ orderBy });
  const from    = () => ({ where });
  const select  = () => ({ from });

  return {
    db: { select },
    analysesTable: { uploadedAt: {}, userId: {}, status: {} },
  };
});

// Import AFTER mock is installed.
import { computeProfileStats } from "../lib/stats";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("lastWeekCount excludes rest days", () => {
  it("does not count a last-week session that falls on a rest day", async () => {
    // 2024-01-01 is Monday (getDay() === 1) — last week, training day? No: schedule is Tue–Sat.
    // Use 2024-01-01 (Monday) with a Tue–Sat schedule so it's a rest day.
    mockRows = [{ uploadedAt: new Date(ts("2024-01-01")) }];

    const { lastWeekCount } = await computeProfileStats(
      1,
      [2, 3, 4, 5, 6], // Tue–Sat; Monday is a rest day
    );

    expect(lastWeekCount).toBe(0);
  });

  it("counts a last-week session that falls on a scheduled training day", async () => {
    // 2024-01-02 is Tuesday (getDay() === 2) — last week, training day in a Tue–Sat schedule.
    mockRows = [{ uploadedAt: new Date(ts("2024-01-02")) }];

    const { lastWeekCount } = await computeProfileStats(
      1,
      [2, 3, 4, 5, 6], // Tue–Sat
    );

    expect(lastWeekCount).toBe(1);
  });

  it("counts only training-day sessions when last week contains both kinds", async () => {
    // Two last-week sessions: Monday (rest day) + Tuesday (training day).
    mockRows = [
      { uploadedAt: new Date(ts("2024-01-02")) }, // Tuesday  → training day ✓
      { uploadedAt: new Date(ts("2024-01-01")) }, // Monday   → rest day    ✗
    ];

    const { lastWeekCount } = await computeProfileStats(
      1,
      [2, 3, 4, 5, 6], // Tue–Sat; Monday excluded
    );

    // Only the Tuesday session should be counted.
    expect(lastWeekCount).toBe(1);
  });

  it("does not count current-week sessions in lastWeekCount", async () => {
    // 2024-01-08 is this week (Monday, today) — must not appear in lastWeekCount.
    mockRows = [{ uploadedAt: new Date(ts("2024-01-08")) }];

    const { lastWeekCount } = await computeProfileStats(
      1,
      [1, 2, 3, 4, 5], // Mon–Fri
    );

    expect(lastWeekCount).toBe(0);
  });

  it("counts all last-week sessions when no trainingDays restriction is provided", async () => {
    // Monday + Tuesday last week — both should count when schedule is unrestricted.
    mockRows = [
      { uploadedAt: new Date(ts("2024-01-02")) }, // Tuesday
      { uploadedAt: new Date(ts("2024-01-01")) }, // Monday
    ];

    const { lastWeekCount } = await computeProfileStats(
      1,
      undefined, // no restriction → all days count
    );

    expect(lastWeekCount).toBe(2);
  });
});
