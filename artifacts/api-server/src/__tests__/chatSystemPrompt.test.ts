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
 *   4. Feel cues (drillFeelCue) on a tip's drill are injected into the prompt
 *      alongside the coaching cue — dropping them is a regression.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── hoisted mock infrastructure ───────────────────────────────────────────────
// vi.mock factories are hoisted, so all shared state must be created here.
const h = vi.hoisted(() => {
  type TipDrill = {
    name?: string;
    sets?: string;
    reps?: string;
    cue?: string;
    drillFeelCue?: string;
  };

  type Tip = {
    tipType?: string;
    title?: string;
    drill?: TipDrill;
  };

  type ProfileRow = {
    userId: number;
    name: string | null;
    sport: string | null;
    level: string | null;
    goals: string[] | null;
    injuryConcerns: string[] | null;
  };

  type AnalysisRow = {
    userId: number;
    status: string;
    sport: string;
    uploadedAt: Date;
    title: string;
    tips?: Tip[] | null;
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

  let profileStore: ProfileRow[] = [];
  let analysesStore: AnalysisRow[] = [];

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

type TipDrill = {
  name?: string;
  sets?: string;
  reps?: string;
  cue?: string;
  drillFeelCue?: string;
};

type Tip = {
  tipType?: string;
  title?: string;
  drill?: TipDrill;
};

function addAnalysis(overrides: {
  status?: string;
  sport?: string;
  title?: string;
  tips?: Tip[];
} = {}) {
  h.analysesStore.push({
    userId: USER_ID,
    status: overrides.status ?? "complete",
    sport: overrides.sport ?? "running",
    uploadedAt: new Date("2026-01-01"),
    title: overrides.title ?? "Test Session",
    tips: overrides.tips ?? null,
  });
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

describe("buildSystemPrompt — feel cues appear in the system prompt", () => {
  beforeEach(() => {
    setProfile("basketball");
    clearAnalyses();
  });

  it("includes drillFeelCue in the prompt when a tip has one", async () => {
    addAnalysis({
      tips: [
        {
          tipType: "technique",
          title: "Improve hip hinge",
          drill: {
            name: "Romanian Deadlift",
            sets: "3 sets",
            reps: "10 reps",
            cue: "Push hips back, keep spine neutral",
            drillFeelCue: "Feel your hamstrings load like a spring",
          },
        },
      ],
    });

    const prompt = await buildSystemPrompt(USER_ID);

    expect(prompt).toContain("Feel your hamstrings load like a spring");
  });

  it("includes the coaching cue alongside the feel cue", async () => {
    addAnalysis({
      tips: [
        {
          tipType: "power",
          title: "Explosive knee drive",
          drill: {
            name: "High Knees",
            sets: "3 sets",
            reps: "20 reps",
            cue: "Drive knee to chest height",
            drillFeelCue: "Feel the ground push back against each step",
          },
        },
      ],
    });

    const prompt = await buildSystemPrompt(USER_ID);

    expect(prompt).toContain("Drive knee to chest height");
    expect(prompt).toContain("Feel the ground push back against each step");
  });

  it("omits the Feel line when drillFeelCue is absent", async () => {
    addAnalysis({
      tips: [
        {
          tipType: "balance",
          title: "Single-leg stance",
          drill: {
            name: "Single-leg hold",
            sets: "2 sets",
            reps: "30 s",
            cue: "Soft knee, eyes on a fixed point",
          },
        },
      ],
    });

    const prompt = await buildSystemPrompt(USER_ID);

    expect(prompt).toContain("Soft knee, eyes on a fixed point");
    expect(prompt).not.toContain("Feel:");
  });

  it("includes feel cues from multiple tips in the same analysis", async () => {
    addAnalysis({
      tips: [
        {
          tipType: "technique",
          title: "Hip rotation",
          drill: {
            name: "Band rotation",
            cue: "Rotate from the hips, not the shoulders",
            drillFeelCue: "Feel tension build across your core",
          },
        },
        {
          tipType: "mobility",
          title: "Ankle dorsiflexion",
          drill: {
            name: "Wall ankle stretch",
            cue: "Keep heel flat on the floor",
            drillFeelCue: "Feel the stretch behind your shin",
          },
        },
      ],
    });

    const prompt = await buildSystemPrompt(USER_ID);

    expect(prompt).toContain("Feel tension build across your core");
    expect(prompt).toContain("Feel the stretch behind your shin");
  });

  it("does not include feel cues from an incomplete analysis", async () => {
    addAnalysis({
      status: "processing",
      tips: [
        {
          tipType: "technique",
          title: "Shoulder alignment",
          drill: {
            name: "Wall slides",
            cue: "Slide arms up without shrugging",
            drillFeelCue: "Feel shoulder blades glide together",
          },
        },
      ],
    });

    const prompt = await buildSystemPrompt(USER_ID);

    expect(prompt).not.toContain("Feel shoulder blades glide together");
  });
});
