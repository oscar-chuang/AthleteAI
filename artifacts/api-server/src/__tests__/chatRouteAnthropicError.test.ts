/**
 * Route-level integration tests for POST /chat — Anthropic API error handling.
 *
 * Mounts the real Express chat router via supertest with:
 *   - a mock Anthropic client whose messages.create is configured to throw
 *   - an in-memory DB mock (same pattern as chatRouteSystemPrompt.test.ts)
 *
 * Asserts that when the Anthropic API is unavailable (network error, quota
 * exceeded, invalid key, etc.) the route catches the error and returns a
 * clean 500 JSON payload rather than crashing with an unhandled rejection.
 *
 * Security note: the error message returned to the client is intentionally
 * generic — SDK internals (error messages, model names, quota details) must
 * never be forwarded to the client. Full errors are logged server-side only.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── hoisted mock infrastructure ────────────────────────────────────────────────

const h = vi.hoisted(() => {
  type AnalysisRow = {
    id: number;
    userId: number;
    status: string;
    sport: string;
    uploadedAt: Date;
    title: string;
    tips?: any[] | null;
    strengths?: string[] | null;
    improvements?: string[] | null;
    overallScore?: number | null;
  };

  type ProfileRow = {
    userId: number;
    name: string | null;
    sport: string | null;
    level: string | null;
    goals: string[] | null;
    injuryConcerns: string[] | null;
  };

  const analysesStore: AnalysisRow[] = [];
  const profileStore: ProfileRow[] = [];
  let msgSeq = 0;

  // Controls whether messages.create resolves or rejects in each test.
  const anthropicBehaviour = { shouldThrow: true, errorMessage: "Service unavailable" };

  const col = (name: string) => ({ __col: name });

  const profilesTable: any = { __name: "profiles", userId: col("userId") };
  const analysesTable: any = {
    __name: "analyses",
    id: col("id"),
    userId: col("userId"),
    uploadedAt: col("uploadedAt"),
    status: col("status"),
  };
  const completedDrillsTable: any = {
    __name: "completed_drills",
    userId: col("userId"),
    analysisId: col("analysisId"),
    tipId: col("tipId"),
    completedAt: col("completedAt"),
  };
  const chatMessagesTable: any = {
    __name: "chat_messages",
    userId: col("userId"),
    createdAt: col("createdAt"),
    $inferSelect: {} as any,
  };

  function evalCond(row: any, cond: any): boolean {
    if (!cond) return true;
    if (cond.op === "eq") return row[cond.key] === cond.val;
    if (cond.op === "and") return cond.conds.every((c: any) => evalCond(row, c));
    return true;
  }

  function rowsThenable<T>(getRows: () => T[]): any {
    const obj: any = {
      then(res: any, rej: any) {
        return Promise.resolve().then(getRows).then(res, rej);
      },
      orderBy() {
        return rowsThenable(getRows);
      },
      limit(n: number) {
        return rowsThenable(() => getRows().slice(0, n));
      },
    };
    return obj;
  }

  const fakeDb = {
    select(_fields?: any) {
      return {
        from(table: any) {
          return {
            where(cond: any) {
              let src: any[];
              if (table.__name === "profiles") src = profileStore;
              else if (table.__name === "analyses") src = analysesStore;
              else src = [];
              return rowsThenable(() => src.filter((r) => evalCond(r, cond)));
            },
          };
        },
      };
    },
    insert(_table: any) {
      return {
        values(v: any) {
          return {
            returning() {
              const row = {
                id: ++msgSeq,
                createdAt: new Date(),
                referencedAnalysisId: null,
                ...v,
              };
              return Promise.resolve([row]);
            },
          };
        },
      };
    },
  };

  return {
    analysesStore,
    profileStore,
    anthropicBehaviour,
    profilesTable,
    analysesTable,
    completedDrillsTable,
    chatMessagesTable,
    fakeDb,
  };
});

// ── module mocks ───────────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: h.fakeDb,
  profilesTable: h.profilesTable,
  analysesTable: h.analysesTable,
  completedDrillsTable: h.completedDrillsTable,
  chatMessagesTable: h.chatMessagesTable,
  pool: { end: vi.fn() },
}));

vi.mock("drizzle-orm", () => ({
  eq:   (col: any, val: any) => ({ op: "eq",  key: col.__col, val }),
  and:  (...conds: any[])    => ({ op: "and", conds }),
  desc: (col: any)           => col,
  asc:  (col: any)           => col,
}));

// Anthropic mock — throws or resolves based on h.anthropicBehaviour.
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      messages = {
        create: vi.fn(async () => {
          if (h.anthropicBehaviour.shouldThrow) {
            throw new Error(h.anthropicBehaviour.errorMessage);
          }
          return { content: [{ type: "text", text: "All good!" }] };
        }),
      };
    },
  };
});

// Bypass JWT auth: stamp every request with TEST_USER_ID.
const TEST_USER_ID = 99;
vi.mock("../routes/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = TEST_USER_ID;
    next();
  },
}));

// Mock pino logger to suppress output in tests
vi.mock("../lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── imports after mocks ────────────────────────────────────────────────────────

import express from "express";
import request from "supertest";
import chatRouter from "../routes/chat";

// ── helpers ────────────────────────────────────────────────────────────────────

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(chatRouter);
  return app;
}

function seedProfile() {
  h.profileStore.length = 0;
  h.profileStore.push({
    userId: TEST_USER_ID,
    name: "Test Athlete",
    sport: "running",
    level: "intermediate",
    goals: null,
    injuryConcerns: null,
  });
}

// ── setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  h.analysesStore.length = 0;
  h.profileStore.length = 0;
  h.anthropicBehaviour.shouldThrow = true;
  h.anthropicBehaviour.errorMessage = "Service unavailable";
});

// ── tests ──────────────────────────────────────────────────────────────────────

describe("POST /chat — Anthropic API error handling", () => {
  it("returns 500 with a non-empty error field when Anthropic throws a generic error", async () => {
    seedProfile();
    h.anthropicBehaviour.errorMessage = "Service unavailable";

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "How do I improve?" });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it("returns a generic error message and does NOT leak the upstream SDK error", async () => {
    seedProfile();
    h.anthropicBehaviour.errorMessage = "Connection refused";

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "Give me a drill plan" });

    expect(res.status).toBe(500);
    // The client must receive a generic message — SDK internals must not be forwarded.
    expect(res.body.error).not.toContain("Connection refused");
    expect(res.body.error).toMatch(/unavailable/i);
  });

  it("returns a generic error even when Anthropic simulates a quota-exceeded error", async () => {
    seedProfile();
    h.anthropicBehaviour.errorMessage = "429 Too Many Requests: quota exceeded";

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "What should I focus on?" });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
    // Quota details must not leak to the client
    expect(res.body.error).not.toContain("quota exceeded");
    expect(res.body.error).not.toContain("429");
  });

  it("returns a generic error even when Anthropic simulates an invalid API key error", async () => {
    seedProfile();
    h.anthropicBehaviour.errorMessage = "401 Unauthorized: invalid API key";

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "Rate my technique" });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
    // Auth/key details must not leak to the client
    expect(res.body.error).not.toContain("invalid API key");
    expect(res.body.error).not.toContain("401");
  });

  it("still returns 200 when Anthropic is healthy (control case)", async () => {
    seedProfile();
    h.anthropicBehaviour.shouldThrow = false;

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "How is my progress?" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("userMessage");
    expect(res.body).toHaveProperty("assistantMessage");
  });
});
