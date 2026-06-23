import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  let store: Row[] = [];
  let seq = 0;

  const analysesTable: Record<string, unknown> = {
    __name: "analyses",
    id: { __col: "id" },
    userId: { __col: "userId" },
    biomechanicsApplied: { __col: "biomechanicsApplied" },
  };
  const profilesTable: Record<string, unknown> = {
    __name: "profiles",
    userId: { __col: "userId" },
  };

  function evalCond(row: Row, cond: unknown): boolean {
    const c = cond as { op: string; key: string; val: unknown; conds: unknown[] };
    if (!c) return true;
    if (c.op === "eq") return row[c.key] === c.val;
    if (c.op === "and") return c.conds.every((x) => evalCond(row, x));
    return true;
  }

  const fakeDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn((cond: unknown) => ({
          then: (res: (r: Row[]) => unknown, rej: unknown) =>
            Promise.resolve().then(() => store.filter((r) => evalCond(r, cond))).then(res, rej as never),
          limit: vi.fn((n: number) => ({
            then: (res: (r: Row[]) => unknown, rej: unknown) =>
              Promise.resolve().then(() => store.filter((r) => evalCond(r, cond)).slice(0, n)).then(res, rej as never),
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((vals: Row) => ({
        where: vi.fn((cond: unknown) =>
          Promise.resolve().then(() => {
            for (const r of store) {
              if (evalCond(r, cond)) Object.assign(r, vals);
            }
          })
        ),
      })),
    })),
  };

  const mockCache = {
    releaseLock: vi.fn(async () => {}),
    invalidate: vi.fn(async () => {}),
    invalidatePrefix: vi.fn(async () => {}),
    acquireLock: vi.fn(async () => true),
  };

  const mockAnalyzeResult = {
    overallScore: 75, techniqueScore: 75, powerScore: 75, balanceScore: 75,
    consistencyScore: 75, mobilityScore: 75, speedScore: 75,
    strengths: ["good form"], improvements: ["better stance"],
    tips: [], injuryRisks: [],
  };

  return {
    fakeDb, analysesTable, profilesTable, mockCache, mockAnalyzeResult,
    getStore: () => store,
    addRow: (r: Row) => { store.push(r); },
    reset: () => { store = []; seq = 0; void seq; },
  };
});

vi.mock("@workspace/db", () => ({
  db: h.fakeDb,
  analysesTable: h.analysesTable,
  profilesTable: h.profilesTable,
}));
vi.mock("drizzle-orm", () => ({
  eq: (col: { __col: string }, val: unknown) => ({ op: "eq", key: col.__col, val }),
  and: (...conds: unknown[]) => ({ op: "and", conds }),
}));
vi.mock("../anthropic", () => ({
  analyzeAthletePerformance: vi.fn(async () => h.mockAnalyzeResult),
}));
vi.mock("../redis", () => ({ cache: h.mockCache }));

import { enqueueBiomechanicsJob, _resetQueueForTesting } from "../queue";
import { analyzeAthletePerformance } from "../anthropic";

beforeEach(() => {
  h.reset();
  _resetQueueForTesting();
  vi.clearAllMocks();
});

const flush = async (n = 5) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

describe("enqueueBiomechanicsJob (inline mode — no Redis/BullMQ)", () => {
  it("returns 'inline' when no queue is configured", async () => {
    h.addRow({
      id: 1, userId: 10, sport: "running", title: "Test run",
      videoUrl: null, jointAngles: { leftKnee: 90 }, jointRisks: { leftKnee: 1 },
      biomechanicsApplied: false, status: "processing",
    });
    const mode = await enqueueBiomechanicsJob({ analysisId: 1, userId: 10 });
    expect(mode).toBe("inline");
  });

  it("calls Claude and marks biomechanicsApplied=true after inline run", async () => {
    h.addRow({
      id: 2, userId: 10, sport: "soccer", title: "Kick session",
      videoUrl: "https://example.com/video.mp4",
      jointAngles: { leftKnee: 120 }, jointRisks: { leftKnee: 2 },
      biomechanicsApplied: false, status: "processing",
    });

    await enqueueBiomechanicsJob({ analysisId: 2, userId: 10, frameBase64: "abc123" });
    await flush();

    expect(analyzeAthletePerformance).toHaveBeenCalledOnce();
    const row = h.getStore().find((r) => r.id === 2)!;
    expect(row.biomechanicsApplied).toBe(true);
    expect(row.status).toBe("complete");
    expect(h.mockCache.releaseLock).toHaveBeenCalledWith("lock:analysis:2");
    expect(h.mockCache.invalidate).toHaveBeenCalled();
  });

  it("skips Claude if biomechanicsApplied is already true", async () => {
    h.addRow({
      id: 3, userId: 10, sport: "tennis", title: "Serve drill",
      videoUrl: null, jointAngles: {}, jointRisks: {},
      biomechanicsApplied: true, status: "complete",
    });

    await enqueueBiomechanicsJob({ analysisId: 3, userId: 10 });
    await flush();

    expect(analyzeAthletePerformance).not.toHaveBeenCalled();
    expect(h.mockCache.releaseLock).toHaveBeenCalledWith("lock:analysis:3");
  });

  it("marks analysis as failed when Claude throws", async () => {
    vi.mocked(analyzeAthletePerformance).mockRejectedValueOnce(new Error("Claude error"));
    h.addRow({
      id: 4, userId: 10, sport: "boxing", title: "Jab combo",
      videoUrl: null, jointAngles: { leftElbow: 90 }, jointRisks: { leftElbow: 1 },
      biomechanicsApplied: false, status: "processing",
    });

    await enqueueBiomechanicsJob({ analysisId: 4, userId: 10 });
    await flush();

    const row = h.getStore().find((r) => r.id === 4)!;
    expect(row.status).toBe("failed");
    expect(h.mockCache.releaseLock).toHaveBeenCalledWith("lock:analysis:4");
  });
});
