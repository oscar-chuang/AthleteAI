import { describe, it, expect, beforeEach, vi } from "vitest";

// All shared mock infrastructure lives in vi.hoisted so the vi.mock factories
// (which are hoisted to the top of the module) can safely reference it.
const h = vi.hoisted(() => {
  // ─── Controllable AI deferreds ─────────────────────────────────────────────
  // runAIAnalysis awaits analyzeAthletePerformance. We hand it a manually-resolved
  // promise per call so the test can force the two concurrent runs (create-time and
  // biomechanics) to resolve in any order — the whole point of the race contract.
  type Deferred = { promise: Promise<any>; resolve: (v: any) => void; reject: (e: any) => void };
  function deferred(): Deferred {
    let resolve!: (v: any) => void;
    let reject!: (e: any) => void;
    const promise = new Promise<any>((res, rej) => { resolve = res; reject = rej; });
    promise.catch(() => {}); // route attaches its own .catch; silence unhandled-rejection noise
    return { promise, resolve, reject };
  }

  const aiCalls = { create: [] as Deferred[], biomech: [] as Deferred[] };

  // ─── In-memory db store that genuinely applies WHERE filters ────────────────
  // The conditional create-time write (`WHERE biomechanicsApplied = false`) is the
  // behaviour under test, so the fake must really honour predicates — otherwise the
  // test would just re-assert the route's own logic.
  type Row = Record<string, any>;
  const store: Record<string, Row[]> = { analyses: [], profiles: [] };
  const seq: Record<string, number> = { analyses: 0, profiles: 0 };

  const col = (name: string) => ({ __col: name });
  const analysesTable: any = {
    __name: "analyses",
    id: col("id"), userId: col("userId"), biomechanicsApplied: col("biomechanicsApplied"), uploadedAt: col("uploadedAt"),
  };
  const profilesTable: any = { __name: "profiles", userId: col("userId") };

  function evalCond(row: Row, cond: any): boolean {
    if (!cond) return true;
    if (cond.op === "eq") return row[cond.key] === cond.val;
    if (cond.op === "and") return cond.conds.every((c: any) => evalCond(row, c));
    return true;
  }

  function rowsThenable(getRows: () => Row[]): any {
    return {
      then(res: any, rej: any) { return Promise.resolve().then(getRows).then(res, rej); },
      orderBy() { return rowsThenable(getRows); },
      limit(n: number) { return rowsThenable(() => getRows().slice(0, n)); },
    };
  }

  const fakeDb = {
    select() {
      return {
        from(table: any) {
          return { where(cond: any) { return rowsThenable(() => store[table.__name]!.filter((r) => evalCond(r, cond))); } };
        },
      };
    },
    insert(table: any) {
      return {
        values(v: Row) {
          return {
            returning() {
              const row: Row = {
                id: ++seq[table.__name]!,
                biomechanicsApplied: false,
                status: "processing",
                tips: null, injuryRisks: null,
                overallScore: null, techniqueScore: null, powerScore: null, balanceScore: null,
                consistencyScore: null, mobilityScore: null, speedScore: null,
                strengths: null, improvements: null,
                uploadedAt: new Date(),
                ...v,
              };
              store[table.__name]!.push(row);
              return Promise.resolve([row]);
            },
          };
        },
      };
    },
    update(table: any) {
      return {
        set(vals: Row) {
          return {
            where(cond: any) {
              return Promise.resolve().then(() => {
                for (const r of store[table.__name]!) if (evalCond(r, cond)) Object.assign(r, vals);
              });
            },
          };
        },
      };
    },
    delete(table: any) {
      return {
        where(cond: any) {
          return Promise.resolve().then(() => {
            store[table.__name] = store[table.__name]!.filter((r) => !evalCond(r, cond));
          });
        },
      };
    },
  };

  return { aiCalls, deferred, store, seq, analysesTable, profilesTable, fakeDb };
});

function aiResult(tag: string) {
  return {
    overallScore: 80, techniqueScore: 80, powerScore: 80, balanceScore: 80,
    consistencyScore: 80, mobilityScore: 80, speedScore: 80,
    strengths: [`${tag}-strength`], improvements: [`${tag}-improvement`],
    tips: [{ tipType: "injury", category: "Knee", severity: "critical", title: `${tag}-tip`, description: "d", joints: ["leftKnee"] }],
    injuryRisks: [{ joint: "leftKnee", riskPercent: 70, description: "d", prevention: "p" }],
  };
}

vi.mock("../lib/anthropic", () => ({
  analyzeAthletePerformance: vi.fn((_sport: string, _title: string, _videoUrl: any, _profile: any, jointAngles: any) => {
    const isBiomechanics = !!jointAngles; // biomechanics run is the only one passing measured angles
    const d = h.deferred();
    (isBiomechanics ? h.aiCalls.biomech : h.aiCalls.create).push(d);
    return d.promise;
  }),
  detectSportFromFrame: vi.fn(async () => "weightlifting"),
}));

const TEST_USER_ID = 1;
vi.mock("./auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.userId = TEST_USER_ID; next(); },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: any, val: any) => ({ op: "eq", key: col.__col, val }),
  and: (...conds: any[]) => ({ op: "and", conds }),
  desc: (col: any) => ({ op: "desc", key: col.__col }),
}));

vi.mock("@workspace/db", () => ({ db: h.fakeDb, analysesTable: h.analysesTable, profilesTable: h.profilesTable }));

// Imports that depend on the mocks must come after the vi.mock calls.
import express from "express";
import request from "supertest";
import analysesRouter from "./analyses";

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(analysesRouter);
  return app;
}

const flush = async (n = 5) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

beforeEach(() => {
  h.store.analyses = [];
  h.store.profiles = [];
  h.seq.analyses = 0;
  h.seq.profiles = 0;
  h.aiCalls.create = [];
  h.aiCalls.biomech = [];
  vi.clearAllMocks();
});

describe("analyses route — biomechanics grounding contract", () => {
  it("skips the create-time write once a biomechanics run has grounded the analysis (out-of-order race)", async () => {
    const app = makeApp();

    // 1. Create — fires the create-time AI run (no measured angles), which we leave pending.
    const created = await request(app).post("/analyses").send({ title: "Squat", sport: "weightlifting" });
    expect(created.status).toBe(201);
    const id = created.body.analysis.id;
    await flush();
    expect(h.aiCalls.create.length).toBe(1);

    // 2. Scan finishes → PATCH fires the biomechanics run (measured angles), also pending.
    const patched = await request(app)
      .patch(`/analyses/${id}`)
      .send({ jointAngles: { leftKnee: 90, rightKnee: 92 }, jointRisks: { leftKnee: 2, rightKnee: 1 } });
    expect(patched.status).toBe(200);
    await flush();
    expect(h.aiCalls.biomech.length).toBe(1);

    // 3. Biomechanics resolves FIRST and lands grounded tips + sets the flag.
    h.aiCalls.biomech[0]!.resolve(aiResult("grounded"));
    await flush();

    // 4. The slower create-time run resolves AFTER — it must NOT clobber the grounded tips.
    h.aiCalls.create[0]!.resolve(aiResult("createtime"));
    await flush();

    const got = await request(app).get(`/analyses/${id}`);
    expect(got.body.analysis.biomechanicsApplied).toBe(true);
    expect(got.body.analysis.status).toBe("complete");
    expect(got.body.tips.map((t: any) => t.title)).toEqual(["grounded-tip"]);
  });

  it("writes create-time tips normally when no biomechanics run has grounded the analysis", async () => {
    const app = makeApp();

    const created = await request(app).post("/analyses").send({ title: "Run", sport: "running" });
    const id = created.body.analysis.id;
    await flush();

    h.aiCalls.create[0]!.resolve(aiResult("createtime"));
    await flush();

    const got = await request(app).get(`/analyses/${id}`);
    expect(got.body.analysis.biomechanicsApplied).toBe(false);
    expect(got.body.analysis.status).toBe("complete");
    expect(got.body.tips.map((t: any) => t.title)).toEqual(["createtime-tip"]);
  });

  it("PATCH marks the analysis processing, then the biomechanics run sets the flag + completes", async () => {
    const app = makeApp();

    const created = await request(app).post("/analyses").send({ title: "Squat", sport: "weightlifting" });
    const id = created.body.analysis.id;
    await flush();
    // Resolve the create-time run so the row is in a settled "complete" state first.
    h.aiCalls.create[0]!.resolve(aiResult("createtime"));
    await flush();

    await request(app)
      .patch(`/analyses/${id}`)
      .send({ jointAngles: { leftKnee: 88 }, jointRisks: { leftKnee: 2 } });
    await flush();

    // Before the biomechanics AI resolves the row is back in "processing" so the client poll resumes.
    let got = await request(app).get(`/analyses/${id}`);
    expect(got.body.analysis.status).toBe("processing");
    expect(got.body.analysis.biomechanicsApplied).toBe(false);

    h.aiCalls.biomech[0]!.resolve(aiResult("grounded"));
    await flush();

    got = await request(app).get(`/analyses/${id}`);
    expect(got.body.analysis.status).toBe("complete");
    expect(got.body.analysis.biomechanicsApplied).toBe(true);
    expect(got.body.tips.map((t: any) => t.title)).toEqual(["grounded-tip"]);
  });

  it("keeps grounded results even if the create-time run fails after grounding", async () => {
    const app = makeApp();

    const created = await request(app).post("/analyses").send({ title: "Squat", sport: "weightlifting" });
    const id = created.body.analysis.id;
    await flush();

    await request(app)
      .patch(`/analyses/${id}`)
      .send({ jointAngles: { leftKnee: 90 }, jointRisks: { leftKnee: 2 } });
    await flush();

    h.aiCalls.biomech[0]!.resolve(aiResult("grounded"));
    await flush();

    // Create-time run rejects (e.g. timeout). The catch only marks failed WHERE
    // biomechanicsApplied=false, so the grounded "complete" status must survive.
    h.aiCalls.create[0]!.reject(new Error("boom"));
    await flush();

    const got = await request(app).get(`/analyses/${id}`);
    expect(got.body.analysis.status).toBe("complete");
    expect(got.body.analysis.biomechanicsApplied).toBe(true);
  });
});
