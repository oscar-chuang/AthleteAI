/**
 * Unit tests for injuryConcerns deduplication on PATCH /profile.
 *
 * Invariants under test:
 *   1. Exact-duplicate strings are collapsed to one entry.
 *   2. Duplicate "No current injuries" sentinels are collapsed to one entry.
 *   3. A list with no duplicates is preserved unchanged.
 *   4. An empty array persists without error.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Shared mock infrastructure ───────────────────────────────────────────────

const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const store: Row[] = [];
  let seq = 0;

  const col = (name: string) => ({ __col: name });
  const profilesTable: Record<string, unknown> = {
    __name: "profiles",
    id: col("id"),
    userId: col("userId"),
    updatedAt: col("updatedAt"),
  };

  function evalCond(row: Row, cond: unknown): boolean {
    if (!cond) return true;
    const c = cond as { op: string; key?: string; val?: unknown; conds?: unknown[] };
    if (c.op === "eq") return row[c.key!] === c.val;
    if (c.op === "and") return (c.conds ?? []).every((x) => evalCond(row, x));
    return true;
  }

  function rowsThenable(getRows: () => Row[]): unknown {
    return {
      then(res: (v: Row[]) => unknown, rej: (e: unknown) => unknown) {
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
        from(_table: unknown) {
          return {
            where(cond: unknown) {
              return rowsThenable(() => store.filter((r) => evalCond(r, cond)));
            },
          };
        },
      };
    },
    insert(_table: unknown) {
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
                updatedAt: new Date(),
                createdAt: new Date(),
                ...v,
              };
              store.push(row);
              return Promise.resolve([row]);
            },
          };
        },
      };
    },
    update(_table: unknown) {
      return {
        set(vals: Row) {
          return {
            where(cond: unknown) {
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
  completedDrillsTable: { __name: "completed_drills" },
  pool: { end: vi.fn() },
}));

const TEST_USER_ID = 42;
vi.mock("../routes/auth", () => ({
  requireAuth: (req: Record<string, unknown>, _res: unknown, next: () => void) => {
    req.userId = TEST_USER_ID;
    next();
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: { __col: string }, val: unknown) => ({ op: "eq", key: col.__col, val }),
  and: (...conds: unknown[]) => ({ op: "and", conds }),
  desc: (col: { __col: string }) => ({ op: "desc", key: col.__col }),
  count: () => ({ __agg: "count" }),
}));

vi.mock("../lib/stats", () => ({
  computeProfileStats: vi.fn(async () => ({ streak: 0, weeklyProgress: 0 })),
}));

// Imports that depend on mocks must come AFTER vi.mock calls.
import express from "express";
import request from "supertest";
import profileRouter from "../routes/profile";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(profileRouter);
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  h.store.length = 0;
});

describe("PATCH /profile — injuryConcerns deduplication", () => {
  it("collapses exact-duplicate strings to a single entry", async () => {
    const app = makeApp();
    const res = await request(app)
      .patch("/profile")
      .send({ injuryConcerns: ["knee pain", "knee pain", "shoulder"] });

    expect(res.status).toBe(200);
    expect(res.body.profile.injuryConcerns).toEqual(["knee pain", "shoulder"]);
  });

  it("collapses duplicate 'No current injuries' sentinel entries", async () => {
    const app = makeApp();
    const res = await request(app)
      .patch("/profile")
      .send({
        injuryConcerns: [
          "No current injuries",
          "No current injuries",
          "No current injuries",
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.profile.injuryConcerns).toEqual(["No current injuries"]);
  });

  it("preserves a list with no duplicates unchanged", async () => {
    const app = makeApp();
    const res = await request(app)
      .patch("/profile")
      .send({ injuryConcerns: ["knee pain", "ankle stiffness"] });

    expect(res.status).toBe(200);
    expect(res.body.profile.injuryConcerns).toEqual([
      "knee pain",
      "ankle stiffness",
    ]);
  });

  it("persists an empty array without error", async () => {
    const app = makeApp();
    const res = await request(app)
      .patch("/profile")
      .send({ injuryConcerns: [] });

    expect(res.status).toBe(200);
    expect(res.body.profile.injuryConcerns).toEqual([]);
  });
});
