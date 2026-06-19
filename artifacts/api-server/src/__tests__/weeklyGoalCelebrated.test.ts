/**
 * Route-level integration tests for `weeklyGoalCelebratedAt` on PATCH /profile.
 *
 * Asserts:
 *   1. On first write (insert path — no existing profile row), the value is
 *      persisted so the server durability guarantee survives app reinstall.
 *   2. On subsequent writes (update path — profile row already exists), the
 *      value is also persisted and returned correctly.
 *   3. The GET /profile response includes `weeklyGoalCelebratedAt`.
 *
 * @workspace/db is mocked with an in-memory store to isolate from the database.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Shared mock infrastructure ───────────────────────────────────────────────

const h = vi.hoisted(() => {
  type Row = Record<string, any>;
  const store: Row[] = [];
  let seq = 0;

  const col = (name: string) => ({ __col: name });
  const profilesTable: any = {
    __name: "profiles",
    id: col("id"),
    userId: col("userId"),
    avatarUrl: col("avatarUrl"),
    trainingDays: col("trainingDays"),
    weeklyGoalCelebratedAt: col("weeklyGoalCelebratedAt"),
  };

  function evalCond(row: Row, cond: any): boolean {
    if (!cond) return true;
    if (cond.op === "eq") return row[cond.key] === cond.val;
    if (cond.op === "and") return cond.conds.every((c: any) => evalCond(row, c));
    return true;
  }

  function rowsThenable(getRows: () => Row[]): any {
    return {
      then(res: any, rej: any) {
        return Promise.resolve().then(getRows).then(res, rej);
      },
      limit(n: number) {
        return rowsThenable(() => getRows().slice(0, n));
      },
    };
  }

  const fakeDb = {
    select() {
      return {
        from(_table: any) {
          return {
            where(cond: any) {
              return rowsThenable(() => store.filter((r) => evalCond(r, cond)));
            },
          };
        },
      };
    },
    insert(_table: any) {
      return {
        values(v: Row) {
          return {
            returning() {
              const row: Row = {
                id: ++seq,
                name: "",
                sport: "",
                level: "beginner",
                goals: [],
                injuryConcerns: [],
                weeklyGoal: 3,
                trainingDays: [0, 1, 2, 3, 4, 5, 6],
                checkInHour: 9,
                avatarUrl: null,
                weeklyGoalCelebratedAt: null,
                ...v,
              };
              store.push(row);
              return Promise.resolve([row]);
            },
          };
        },
      };
    },
    update(_table: any) {
      return {
        set(vals: Row) {
          return {
            where(cond: any) {
              return {
                returning() {
                  return Promise.resolve().then(() => {
                    const match = store.find((r) => evalCond(r, cond));
                    if (match) Object.assign(match, vals);
                    return match ? [match] : [];
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  return { store, fakeDb, profilesTable };
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: h.fakeDb,
  profilesTable: h.profilesTable,
  analysesTable: { __name: "analyses" },
  pool: { end: vi.fn() },
}));

const TEST_USER_ID = 99;
vi.mock("../routes/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = TEST_USER_ID;
    next();
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: any, val: any) => ({ op: "eq", key: col.__col, val }),
  and: (...conds: any[]) => ({ op: "and", conds }),
  desc: (col: any) => ({ op: "desc", key: col.__col }),
}));

vi.mock("../lib/stats", () => ({
  computeProfileStats: vi.fn(async () => ({ streak: 0, weeklyProgress: 0 })),
}));

import express from "express";
import request from "supertest";
import profileRouter from "../routes/profile";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(profileRouter);
  return app;
}

const WEEK_KEY = "2026-06-15";

beforeEach(() => {
  h.store.length = 0;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PATCH /profile — weeklyGoalCelebratedAt persistence", () => {
  it("persists weeklyGoalCelebratedAt on first write (insert path — no existing profile)", async () => {
    const app = makeApp();

    const res = await request(app)
      .patch("/profile")
      .send({ weeklyGoalCelebratedAt: WEEK_KEY });

    expect(res.status).toBe(200);
    expect(res.body.profile.weeklyGoalCelebratedAt).toBe(WEEK_KEY);

    // Confirm the value is stored in the in-memory DB row
    const stored = h.store.find((r) => r["userId"] === TEST_USER_ID);
    expect(stored?.["weeklyGoalCelebratedAt"]).toBe(WEEK_KEY);
  });

  it("persists weeklyGoalCelebratedAt on subsequent write (update path — profile already exists)", async () => {
    const app = makeApp();

    // First request creates the profile row
    await request(app).patch("/profile").send({ name: "Alice" });

    // Second request updates the celebration flag
    const res = await request(app)
      .patch("/profile")
      .send({ weeklyGoalCelebratedAt: WEEK_KEY });

    expect(res.status).toBe(200);
    expect(res.body.profile.weeklyGoalCelebratedAt).toBe(WEEK_KEY);
  });

  it("GET /profile response includes weeklyGoalCelebratedAt", async () => {
    const app = makeApp();

    // Seed a profile row via PATCH
    await request(app)
      .patch("/profile")
      .send({ weeklyGoalCelebratedAt: WEEK_KEY });

    const res = await request(app).get("/profile");
    expect(res.status).toBe(200);
    expect(res.body.profile).toHaveProperty("weeklyGoalCelebratedAt", WEEK_KEY);
  });

  it("weeklyGoalCelebratedAt defaults to null when not provided", async () => {
    const app = makeApp();

    const res = await request(app).patch("/profile").send({ name: "Bob" });

    expect(res.status).toBe(200);
    expect(res.body.profile.weeklyGoalCelebratedAt).toBeNull();
  });
});

