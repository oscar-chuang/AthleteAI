/**
 * Route-level integration tests for avatar compression on PATCH /profile.
 *
 * These tests call the real Express route via supertest and assert that:
 *   1. A large base64 image sent as avatarUrl comes back as data:image/jpeg;base64,...
 *   2. The decoded bytes of that URI are ≤ 20 KB.
 *   3. avatarUrl: null passes through unchanged (avatar removal path stays intact).
 *
 * sharp is NOT mocked — real compression must run to verify the size contract.
 * @workspace/db IS mocked with an in-memory store to isolate from the database.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import sharp from "sharp";
import { randomBytes } from "crypto";

const AVATAR_MAX_BYTES = 20 * 1024;

// ─── Shared mock infrastructure (hoisted so vi.mock factories can reference it) ──

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

const TEST_USER_ID = 42;
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

// Imports that depend on mocks must come AFTER vi.mock calls.
import express from "express";
import request from "supertest";
import profileRouter from "../routes/profile";

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(profileRouter);
  return app;
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

let largeImageDataUri: string;

beforeAll(async () => {
  // 400×400 random-pixel PNG — noise is incompressible, guarantees size > 20 KB
  const rawPixels = randomBytes(400 * 400 * 3);
  const buf = await sharp(rawPixels, {
    raw: { width: 400, height: 400, channels: 3 },
  })
    .png()
    .toBuffer();

  largeImageDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  // Sanity check the fixture is actually large enough to trigger compression
  expect(buf.byteLength).toBeGreaterThan(AVATAR_MAX_BYTES);
});

beforeEach(() => {
  // Reset the in-memory store before each test so tests are independent
  h.store.length = 0;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PATCH /profile — avatar compression", () => {
  it("returns a data:image/jpeg;base64,... URI when a large image is sent", async () => {
    const app = makeApp();
    const res = await request(app)
      .patch("/profile")
      .send({ avatarUrl: largeImageDataUri });

    expect(res.status).toBe(200);
    expect(res.body.profile.avatarUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("stores a compressed avatarUrl whose decoded bytes are ≤ 20 KB", async () => {
    const app = makeApp();
    const res = await request(app)
      .patch("/profile")
      .send({ avatarUrl: largeImageDataUri });

    expect(res.status).toBe(200);
    const base64Part = res.body.profile.avatarUrl.replace(
      /^data:image\/jpeg;base64,/,
      "",
    );
    const decoded = Buffer.from(base64Part, "base64");
    expect(decoded.byteLength).toBeLessThanOrEqual(AVATAR_MAX_BYTES);
  });

  it("passes avatarUrl: null through unchanged so avatar removal stays intact", async () => {
    const app = makeApp();

    // First, give the user an avatar so there is something to remove
    await request(app)
      .patch("/profile")
      .send({ avatarUrl: largeImageDataUri });

    // Now clear it
    const res = await request(app)
      .patch("/profile")
      .send({ avatarUrl: null });

    expect(res.status).toBe(200);
    expect(res.body.profile.avatarUrl).toBeNull();
  });
});
