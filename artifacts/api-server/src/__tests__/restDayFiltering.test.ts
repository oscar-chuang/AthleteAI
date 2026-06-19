/**
 * Tests that rest-day sessions are excluded from the weekly goal count.
 *
 * Two layers under test:
 *   1. computeProfileStats (pure stat helper) — weeklyProgress only counts
 *      sessions whose day-of-week is in the supplied trainingDays array.
 *   2. GET /profile/stats route — thisWeekCount obeys the same filtering rule
 *      using the profile's stored trainingDays.
 *
 * Both suites use trainingDays = [1, 3, 5] (Mon / Wed / Fri) and plant five
 * completed analyses within the current week: one on each training day (Mon,
 * Wed, Fri) and one on each rest day (Sat = 6, Sun = 0).  The expected count
 * is 3 in both cases.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a Date set to noon on the given day-of-week (0=Sun…6=Sat) of the
 * CURRENT calendar week.  Noon avoids DST / UTC-midnight edge cases that can
 * make getDay() return the wrong value in the local timezone.
 */
function dateOnDayThisWeek(dayOfWeek: number): Date {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // rewind to Sunday
  const d = new Date(weekStart);
  d.setDate(weekStart.getDate() + dayOfWeek);
  return d;
}

const TRAINING_DAYS = [1, 3, 5]; // Mon, Wed, Fri

const SESSION_ROWS = [
  { uploadedAt: dateOnDayThisWeek(1) }, // Mon — training day ✓
  { uploadedAt: dateOnDayThisWeek(3) }, // Wed — training day ✓
  { uploadedAt: dateOnDayThisWeek(5) }, // Fri — training day ✓
  { uploadedAt: dateOnDayThisWeek(6) }, // Sat — rest day   ✗
  { uploadedAt: dateOnDayThisWeek(0) }, // Sun — rest day   ✗
];

// ─── Shared mock infrastructure ───────────────────────────────────────────────

/**
 * Hoisted state so vi.mock factories can reference it.
 *
 * `queue` is a list of row-arrays consumed in order — each call to
 * db.select()…where()…orderBy() / limit() pops from the front.
 */
const h = vi.hoisted(() => {
  const state: { queue: any[][]; idx: number } = { queue: [], idx: 0 };

  function rowsForCurrentCall() {
    return state.queue[state.idx++] ?? [];
  }

  const fakeDb = {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(rowsForCurrentCall()),
          limit: (n: number) => {
            const rows = rowsForCurrentCall();
            return {
              then(res: any, rej: any) {
                return Promise.resolve(rows.slice(0, n)).then(res, rej);
              },
            };
          },
        }),
      }),
    })),
  };

  return { state, fakeDb };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: h.fakeDb,
  analysesTable: {
    uploadedAt: { __col: "uploadedAt" },
    userId: { __col: "userId" },
    status: { __col: "status" },
  },
  profilesTable: {
    trainingDays: { __col: "trainingDays" },
    userId: { __col: "userId" },
  },
  pool: { end: vi.fn() },
}));

vi.mock("drizzle-orm", () => ({
  eq:   (col: any, val: any) => ({ op: "eq",  key: col.__col, val }),
  and:  (...conds: any[])    => ({ op: "and", conds }),
  desc: (col: any)           => ({ op: "desc", key: col.__col }),
}));

vi.mock("../routes/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = 99;
    next();
  },
}));

// ─── Lazy imports (must come after vi.mock calls) ─────────────────────────────

import { computeProfileStats } from "../lib/stats";
import profileRouter from "../routes/profile";

// ─── Reset mock state before every test ───────────────────────────────────────

beforeEach(() => {
  h.state.queue = [];
  h.state.idx   = 0;
  h.fakeDb.select.mockClear();
});

// ─── Suite 1: computeProfileStats ─────────────────────────────────────────────

describe("computeProfileStats — rest-day filtering", () => {
  it("excludes Sat/Sun sessions when trainingDays = [Mon, Wed, Fri]", async () => {
    // The function makes one db.select() call that returns all completed rows.
    h.state.queue = [SESSION_ROWS];

    const { weeklyProgress } = await computeProfileStats(99, TRAINING_DAYS);

    expect(weeklyProgress).toBe(3); // only Mon + Wed + Fri counted
  });

  it("counts all sessions when trainingDays is empty (legacy behaviour)", async () => {
    h.state.queue = [SESSION_ROWS];

    const { weeklyProgress } = await computeProfileStats(99, []);

    expect(weeklyProgress).toBe(5); // all five sessions this week counted
  });

  it("returns 0 when every session this week falls on a rest day", async () => {
    const restOnlySessions = [
      { uploadedAt: dateOnDayThisWeek(6) }, // Sat
      { uploadedAt: dateOnDayThisWeek(0) }, // Sun
    ];
    h.state.queue = [restOnlySessions];

    const { weeklyProgress } = await computeProfileStats(99, TRAINING_DAYS);

    expect(weeklyProgress).toBe(0);
  });
});

// ─── Suite 2: GET /profile/stats route ────────────────────────────────────────

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(profileRouter);
  return app;
}

describe("GET /profile/stats — rest-day filtering", () => {
  it("thisWeekCount excludes Sat/Sun sessions when trainingDays = [Mon, Wed, Fri]", async () => {
    // The route makes two db.select() calls via Promise.all:
    //   1st — profile row (gives the training-day config)
    //   2nd — analysis rows (all completed analyses ordered by date)
    h.state.queue = [
      [{ trainingDays: TRAINING_DAYS }], // profile query result
      SESSION_ROWS,                       // analyses query result
    ];

    const app = makeApp();
    const res = await request(app).get("/profile/stats");

    expect(res.status).toBe(200);
    expect(res.body.thisWeekCount).toBe(3); // Mon + Wed + Fri only
    expect(res.body.totalAnalyses).toBe(5); // all five rows present
  });

  it("thisWeekCount equals all this-week sessions when no profile row exists", async () => {
    // No profile → trainingDaySet stays null → all sessions counted.
    h.state.queue = [
      [],            // profile query returns empty (no profile)
      SESSION_ROWS,  // five sessions this week
    ];

    const app = makeApp();
    const res = await request(app).get("/profile/stats");

    expect(res.status).toBe(200);
    expect(res.body.thisWeekCount).toBe(5);
  });

  it("thisWeekCount is 0 when every session this week is on a rest day", async () => {
    const restOnlySessions = [
      { ...SESSION_ROWS[3], userId: 99, status: "complete" }, // Sat
      { ...SESSION_ROWS[4], userId: 99, status: "complete" }, // Sun
    ];
    h.state.queue = [
      [{ trainingDays: TRAINING_DAYS }],
      restOnlySessions,
    ];

    const app = makeApp();
    const res = await request(app).get("/profile/stats");

    expect(res.status).toBe(200);
    expect(res.body.thisWeekCount).toBe(0);
  });
});
