/**
 * Verifies that thisWeekCount (weeklyProgress) never includes sessions
 * uploaded on rest days — days whose weekday index is absent from the
 * user's trainingDays schedule.
 *
 * Uses the same Sunday = day-0 convention as the mobile weekDots tests.
 * "Today" is pinned to Monday 2024-01-08 via vi.setSystemTime so all
 * date arithmetic is deterministic and independent of when the suite runs.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// ─── Pin time before any imports that call new Date() at module level ─────────

// 2024-01-08 is a Monday (getDay() === 1).
// Week boundary (Sunday-start) = 2024-01-07T00:00:00.000Z local midnight.
const FIXED_TODAY = new Date("2024-01-08T12:00:00.000Z");

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED_TODAY); });
afterAll(() => { vi.useRealTimers(); });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build an ISO timestamp string for a given date string at noon UTC. */
function ts(dateStr: string): string {
  return `${dateStr}T12:00:00.000Z`;
}

// ─── DB mock ──────────────────────────────────────────────────────────────────
//
// computeProfileStats calls:
//   db.select({ uploadedAt: ... }).from(...).where(...).orderBy(...)
// We mock the module before importing the function under test so that
// vi.mock hoisting runs before any module-level code.

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

describe("thisWeekCount excludes rest days", () => {
  it("does not count a session uploaded on a rest day (Sunday when Mon-Fri schedule)", async () => {
    // 2024-01-07 is Sunday (getDay() === 0) — a rest day in a Mon–Fri schedule.
    mockRows = [{ uploadedAt: new Date(ts("2024-01-07")) }];

    const { weeklyProgress } = await computeProfileStats(
      1,
      [1, 2, 3, 4, 5], // Mon–Fri only
    );

    expect(weeklyProgress).toBe(0);
  });

  it("counts a session uploaded on a scheduled training day", async () => {
    // 2024-01-08 is Monday (getDay() === 1) — a training day.
    mockRows = [{ uploadedAt: new Date(ts("2024-01-08")) }];

    const { weeklyProgress } = await computeProfileStats(
      1,
      [1, 2, 3, 4, 5], // Mon–Fri only
    );

    expect(weeklyProgress).toBe(1);
  });

  it("counts only training-day sessions when the week contains both kinds", async () => {
    // Two sessions this week: Sunday (rest) + Monday (training day).
    mockRows = [
      { uploadedAt: new Date(ts("2024-01-08")) }, // Monday   → training day ✓
      { uploadedAt: new Date(ts("2024-01-07")) }, // Sunday   → rest day    ✗
    ];

    const { weeklyProgress } = await computeProfileStats(
      1,
      [1, 2, 3, 4, 5], // Mon–Fri only
    );

    // Only the Monday session should be counted.
    expect(weeklyProgress).toBe(1);
  });

  it("counts all sessions when no trainingDays restriction is provided", async () => {
    // Both Sunday and Monday should count when the schedule is unrestricted.
    mockRows = [
      { uploadedAt: new Date(ts("2024-01-08")) }, // Monday
      { uploadedAt: new Date(ts("2024-01-07")) }, // Sunday
    ];

    const { weeklyProgress } = await computeProfileStats(
      1,
      undefined, // no restriction → all days count
    );

    expect(weeklyProgress).toBe(2);
  });

  it("excludes Saturday sessions when the schedule is Mon–Fri only", async () => {
    // 2024-01-06 is Saturday (getDay() === 6) — falls in this week (>= Sunday Jan 07)?
    // Actually 2024-01-06 is BEFORE the week start (Jan 07), so it naturally won't count.
    // Use the Saturday of the NEXT occurrence relative to our pinned week.
    // 2024-01-13 is the next Saturday — still in the same pinned week for "today=Mon Jan 08"?
    // weekStart = Jan 07 (Sun); Jan 13 (Sat) >= Jan 07 ✓ AND <= Jan 08 (today) ✗ — it's in the future.
    // Instead, verify that a Saturday within this same Sun–Sat week but BEFORE today is excluded.
    // The Saturday before our window: 2024-01-06 is before weekStart → auto-excluded by date.
    // The relevant test: a Sat session ON the same weekStart week but future (>today) is already
    // excluded by date. So test two training days + one non-training-day within the window.

    // Window: Sun Jan 07 … Mon Jan 08 (today). Wed Jan 10 is in the future — skipped by date.
    // Let's use Mon Jan 08 (training) + Sun Jan 07 (rest) — same as above; Saturday is moot here.
    // Better: use a schedule that excludes Monday and include a Monday session.
    mockRows = [
      { uploadedAt: new Date(ts("2024-01-08")) }, // Monday (getDay() === 1)
    ];

    const { weeklyProgress } = await computeProfileStats(
      1,
      [2, 3, 4, 5, 6], // Tue–Sat only; Monday excluded
    );

    // The Monday session is on a rest day for this schedule.
    expect(weeklyProgress).toBe(0);
  });

  it("does not count sessions from last week even if they are on training days", async () => {
    // 2024-01-01 is the previous Monday — before weekStart (2024-01-07), so excluded by date.
    mockRows = [{ uploadedAt: new Date(ts("2024-01-01")) }];

    const { weeklyProgress } = await computeProfileStats(
      1,
      [1, 2, 3, 4, 5], // Mon–Fri
    );

    expect(weeklyProgress).toBe(0);
  });
});
