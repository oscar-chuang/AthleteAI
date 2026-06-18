/**
 * Unit tests for buildSystemPrompt in routes/chat.ts.
 *
 * Key invariants under test:
 *   1. buildSystemPrompt re-reads the profile from the DB on every call —
 *      a sport change between two calls must be reflected immediately in the
 *      next system prompt without any restart or cache flush.
 *   2. The returned prompt embeds the sport read from the DB, so Claude's
 *      coaching context is always current.
 *   3. When there is no profile the prompt still returns a safe default.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── hoisted mock infrastructure ───────────────────────────────────────────────
// vi.mock factories are hoisted, so all shared state must be created here.
const h = vi.hoisted(() => {
  type ProfileRow = {
    userId: number;
    name: string | null;
    sport: string | null;
    level: string | null;
    goals: string[] | null;
    injuryConcerns: string[] | null;
  };

  let profileStore: ProfileRow[] = [];
  let analysesStore: { userId: number; status: string; sport: string; uploadedAt: Date; title: string }[] = [];

  function rowsThenable<T>(getRows: () => T[]): any {
    return {
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
  }

  const col = (name: string) => ({ __col: name });
  const profilesTable: any = { __name: "profiles", userId: col("userId") };
  const analysesTable: any = {
    __name: "analyses",
    userId: col("userId"),
    uploadedAt: col("uploadedAt"),
  };

  function evalCond(row: any, cond: any): boolean {
    if (!cond) return true;
    if (cond.op === "eq") return row[cond.key] === cond.val;
    if (cond.op === "and") return cond.conds.every((c: any) => evalCond(row, c));
    return true;
  }

  const fakeDb = {
    select() {
      return {
        from(table: any) {
          return {
            where(cond: any) {
              const src = table.__name === "profiles" ? profileStore : analysesStore;
              return rowsThenable(() => src.filter((r) => evalCond(r, cond)));
            },
          };
        },
      };
    },
  };

  return { profileStore, analysesStore, profilesTable, analysesTable, fakeDb };
});

// ── module mocks ──────────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: h.fakeDb,
  profilesTable: h.profilesTable,
  analysesTable: h.analysesTable,
  chatMessagesTable: { __name: "chat_messages" },
  pool: { end: vi.fn() },
}));

vi.mock("drizzle-orm", () => ({
  eq:   (col: any, val: any) => ({ op: "eq",  key: col.__col, val }),
  and:  (...conds: any[])    => ({ op: "and", conds }),
  desc: (col: any)           => col,
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: vi.fn() }; },
}));

// ── import after mocks ────────────────────────────────────────────────────────

import { buildSystemPrompt } from "../routes/chat";

// ── helpers ───────────────────────────────────────────────────────────────────

const USER_ID = 42;

function setProfile(sport: string | null, name = "Test Athlete", level = "intermediate") {
  h.profileStore.length = 0;
  if (sport !== null) {
    h.profileStore.push({ userId: USER_ID, name, sport, level, goals: null, injuryConcerns: null });
  }
}

function clearAnalyses() {
  h.analysesStore.length = 0;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("buildSystemPrompt — reads latest profile on every call", () => {
  beforeEach(() => {
    clearAnalyses();
  });

  it("embeds the profile sport in the returned prompt", async () => {
    setProfile("tennis");
    const prompt = await buildSystemPrompt(USER_ID);
    expect(prompt).toContain("tennis");
  });

  it("reflects a sport change between two successive calls (no restart required)", async () => {
    setProfile("running");
    const prompt1 = await buildSystemPrompt(USER_ID);
    expect(prompt1).toContain("running");

    // Athlete updates their profile to swimming mid-session
    setProfile("swimming");
    const prompt2 = await buildSystemPrompt(USER_ID);

    expect(prompt2).toContain("swimming");
    // The old sport must NOT appear in the fresh prompt
    expect(prompt2).not.toContain("running");
  });

  it("switches from one sport to another across multiple changes", async () => {
    const sports = ["basketball", "cycling", "weightlifting"];
    for (const sport of sports) {
      setProfile(sport);
      const prompt = await buildSystemPrompt(USER_ID);
      expect(prompt).toContain(sport);
      // Previous sports are gone
      for (const prev of sports.slice(0, sports.indexOf(sport))) {
        expect(prompt).not.toContain(prev);
      }
    }
  });

  it("falls back to 'general sport' when no profile exists", async () => {
    // Remove all profiles
    h.profileStore.length = 0;
    const prompt = await buildSystemPrompt(USER_ID);
    expect(prompt).toContain("general sport");
  });

  it("includes the athlete name and level from the current profile", async () => {
    setProfile("volleyball", "Alex", "advanced");
    const prompt = await buildSystemPrompt(USER_ID);
    expect(prompt).toContain("Alex");
    expect(prompt).toContain("advanced");
    expect(prompt).toContain("volleyball");
  });
});
