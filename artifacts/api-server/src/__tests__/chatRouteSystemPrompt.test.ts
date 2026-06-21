/**
 * Route-level integration tests for POST /chat — system prompt filtering.
 *
 * Mounts the real Express chat router via supertest with:
 *   - a mock Anthropic client that captures the `system` argument
 *   - an in-memory DB mock seeded with a mix of "complete" and "processing" analyses
 *
 * Asserts that the systemPrompt delivered to Claude contains only data from
 * completed sessions, never from sessions that are still processing or failed.
 *
 * This complements the unit-level buildSystemPrompt tests in chatSystemPrompt.test.ts
 * with a route-level integration signal through the real POST /chat handler.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── hoisted mock infrastructure ────────────────────────────────────────────────
// All state shared between vi.mock factories must be created here (hoisted).

const h = vi.hoisted(() => {
  // Mutable container so the Anthropic mock can write the captured system prompt
  // and tests can read it back after each request.
  const captured = { systemPrompt: "" };

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
    techniqueScore?: number | null;
    balanceScore?: number | null;
    powerScore?: number | null;
    mobilityScore?: number | null;
    speedScore?: number | null;
    consistencyScore?: number | null;
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

  const col = (name: string) => ({ __col: name });

  const profilesTable: any = {
    __name: "profiles",
    userId: col("userId"),
  };
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
        return Promise.resolve()
          .then(getRows)
          .then(res, rej);
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
    captured,
    analysesStore,
    profileStore,
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

// Anthropic mock — captures the `system` argument from messages.create.
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      messages = {
        create: vi.fn(async (params: any) => {
          h.captured.systemPrompt = params.system ?? "";
          return {
            content: [{ type: "text", text: "Great session!" }],
          };
        }),
      };
    },
  };
});

// Bypass JWT auth: stamp every request with TEST_USER_ID.
const TEST_USER_ID = 42;
vi.mock("../routes/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = TEST_USER_ID;
    next();
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

let idSeq = 0;

function addAnalysis(overrides: {
  status?: string;
  title?: string;
  sport?: string;
  strengths?: string[];
  improvements?: string[];
  overallScore?: number;
  tips?: any[];
} = {}) {
  const id = ++idSeq;
  h.analysesStore.push({
    id,
    userId: TEST_USER_ID,
    status: overrides.status ?? "complete",
    sport: overrides.sport ?? "running",
    uploadedAt: new Date("2026-01-01"),
    title: overrides.title ?? "Session",
    tips: overrides.tips ?? null,
    strengths: overrides.strengths ?? null,
    improvements: overrides.improvements ?? null,
    overallScore: overrides.overallScore ?? null,
  });
  return id;
}

function setProfile(sport = "running", name = "Test Athlete", level = "intermediate") {
  h.profileStore.length = 0;
  h.profileStore.push({ userId: TEST_USER_ID, name, sport, level, goals: null, injuryConcerns: null });
}

// ── setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  h.analysesStore.length = 0;
  h.profileStore.length = 0;
  h.captured.systemPrompt = "";
  idSeq = 0;
});

// ── tests ──────────────────────────────────────────────────────────────────────

describe("POST /chat — systemPrompt only reflects completed sessions", () => {
  it("includes completed session data in the system prompt", async () => {
    setProfile("running");
    addAnalysis({
      status: "complete",
      title: "Morning Run",
      strengths: ["Explosive start"],
      improvements: ["Finish mechanics"],
      overallScore: 82,
    });

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "How do I improve?" });

    expect(res.status).toBe(200);
    expect(h.captured.systemPrompt).toContain("Morning Run");
    expect(h.captured.systemPrompt).toContain("Explosive start");
    expect(h.captured.systemPrompt).toContain("Finish mechanics");
  });

  it("excludes a processing session when a completed session is also present", async () => {
    setProfile("cycling");
    addAnalysis({
      status: "complete",
      title: "Completed Ride",
      strengths: ["Strong cadence"],
      overallScore: 75,
    });
    addAnalysis({
      status: "processing",
      title: "Processing Ride",
      strengths: ["Good warm-up"],
      overallScore: 60,
    });

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "What should I focus on?" });

    expect(res.status).toBe(200);

    const prompt = h.captured.systemPrompt;
    // Complete session must be present
    expect(prompt).toContain("Completed Ride");
    expect(prompt).toContain("Strong cadence");
    // Processing session must be absent
    expect(prompt).not.toContain("Processing Ride");
    expect(prompt).not.toContain("Good warm-up");
  });

  it("excludes a failed session when a completed session is also present", async () => {
    setProfile("swimming");
    addAnalysis({
      status: "complete",
      title: "Swim Session",
      strengths: ["Good body rotation"],
      overallScore: 78,
    });
    addAnalysis({
      status: "failed",
      title: "Failed Upload",
      strengths: ["Effort noted"],
      overallScore: 50,
    });

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "Give me feedback" });

    expect(res.status).toBe(200);

    const prompt = h.captured.systemPrompt;
    expect(prompt).toContain("Swim Session");
    expect(prompt).toContain("Good body rotation");
    expect(prompt).not.toContain("Failed Upload");
    expect(prompt).not.toContain("Effort noted");
  });

  it("shows the 'no completed analyses yet' fallback when all sessions are still processing", async () => {
    setProfile("tennis");
    addAnalysis({
      status: "processing",
      title: "In-flight Analysis",
      strengths: ["Great serve"],
      overallScore: 70,
    });
    addAnalysis({
      status: "processing",
      title: "Another Pending",
      strengths: ["Footwork improving"],
      overallScore: 65,
    });

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "What's my status?" });

    expect(res.status).toBe(200);

    const prompt = h.captured.systemPrompt;
    expect(prompt).toContain("no completed analyses yet");
    expect(prompt).not.toContain("Recent training data");
    expect(prompt).not.toContain("In-flight Analysis");
    expect(prompt).not.toContain("Another Pending");
    expect(prompt).not.toContain("Great serve");
  });

  it("only includes the complete session when mixed with both processing and failed", async () => {
    setProfile("basketball");
    addAnalysis({
      status: "complete",
      title: "Completed Practice",
      strengths: ["Sharp defense"],
      improvements: ["Free-throw consistency"],
      overallScore: 80,
    });
    addAnalysis({
      status: "processing",
      title: "Processing Practice",
      strengths: ["Fast breaks"],
    });
    addAnalysis({
      status: "failed",
      title: "Failed Session",
      strengths: ["Tried hard"],
    });

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "How is my basketball?" });

    expect(res.status).toBe(200);

    const prompt = h.captured.systemPrompt;
    // Only the complete session should appear
    expect(prompt).toContain("Completed Practice");
    expect(prompt).toContain("Sharp defense");
    expect(prompt).toContain("Free-throw consistency");
    // Non-complete sessions must not appear
    expect(prompt).not.toContain("Processing Practice");
    expect(prompt).not.toContain("Fast breaks");
    expect(prompt).not.toContain("Failed Session");
    expect(prompt).not.toContain("Tried hard");
  });

  it("shows an older completed session even when the 5 most-recent analyses are all processing", async () => {
    /**
     * Regression guard for the limit-before-filter bug.
     *
     * Old behaviour: WHERE userId LIMIT 5 → client filter for complete
     *   → if all 5 most-recent are "processing", the fallback fired even though
     *     older completed sessions existed.
     *
     * Fixed behaviour: WHERE userId AND status='complete' LIMIT 5
     *   → .limit(5) applies AFTER filtering, so older completed sessions are
     *     always reachable.
     */
    setProfile("triathlon");

    // 5 processing analyses followed by 1 older completed session
    for (let i = 1; i <= 5; i++) {
      addAnalysis({ status: "processing", title: `Pending Session ${i}` });
    }
    addAnalysis({
      status: "complete",
      title: "Older Completed Triathlon",
      strengths: ["Solid T1 transition"],
      overallScore: 79,
    });

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "What should I work on?" });

    expect(res.status).toBe(200);

    const prompt = h.captured.systemPrompt;
    // The older completed session must appear in the prompt
    expect(prompt).toContain("Older Completed Triathlon");
    expect(prompt).toContain("Solid T1 transition");
    expect(prompt).toContain("Overall 79");
    expect(prompt).toContain("Recent training data");
    expect(prompt).not.toContain("no completed analyses yet");

    // Processing sessions must not bleed into the coach context
    for (let i = 1; i <= 5; i++) {
      expect(prompt).not.toContain(`Pending Session ${i}`);
    }
  });

  it("forwards the athlete's name in the system prompt sent to Anthropic", async () => {
    setProfile("tennis", "Serena", "advanced");

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "What should I work on today?" });

    expect(res.status).toBe(200);
    expect(h.captured.systemPrompt).toContain("Serena");
  });

  it("addresses a different athlete by their own name — not a generic placeholder", async () => {
    setProfile("basketball", "Marcus", "beginner");

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "Give me some tips" });

    expect(res.status).toBe(200);
    const prompt = h.captured.systemPrompt;
    expect(prompt).toContain("Marcus");
    // Must not fall back to the generic 'this athlete' placeholder when a name is set
    expect(prompt).not.toContain("this athlete");
  });

  it("uses the generic placeholder only when no profile name is set", async () => {
    // Profile with no name (null)
    h.profileStore.length = 0;
    h.profileStore.push({ userId: TEST_USER_ID, name: null, sport: "running", level: "intermediate", goals: null, injuryConcerns: null });

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "How do I get faster?" });

    expect(res.status).toBe(200);
    expect(h.captured.systemPrompt).toContain("this athlete");
  });

  it("includes drill tips from a completed session but not from a processing session", async () => {
    setProfile("running");
    addAnalysis({
      status: "complete",
      title: "Track Session",
      tips: [
        {
          tipType: "technique",
          title: "Arm drive",
          drill: {
            name: "Arm swing drill",
            cue: "Drive elbows back, not across your body",
            drillFeelCue: "Feel the rhythm from your arms transfer to your legs",
          },
        },
      ],
    });
    addAnalysis({
      status: "processing",
      title: "Unfinished Session",
      tips: [
        {
          tipType: "power",
          title: "Stride power",
          drill: {
            name: "Bounding drill",
            cue: "Push through the toe with each bound",
            drillFeelCue: "Feel each foot fully loaded before push-off",
          },
        },
      ],
    });

    const app = makeApp();
    const res = await request(app)
      .post("/chat")
      .send({ content: "What drills should I do?" });

    expect(res.status).toBe(200);

    const prompt = h.captured.systemPrompt;
    // Completed session drill present
    expect(prompt).toContain("Arm swing drill");
    expect(prompt).toContain("Drive elbows back, not across your body");
    expect(prompt).toContain("Feel the rhythm from your arms transfer to your legs");
    // Processing session drill absent
    expect(prompt).not.toContain("Bounding drill");
    expect(prompt).not.toContain("Push through the toe with each bound");
    expect(prompt).not.toContain("Feel each foot fully loaded before push-off");
  });
});
