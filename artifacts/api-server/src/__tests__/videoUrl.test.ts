/**
 * Policy tests for videoUrl validation in routes/analyses.ts.
 *
 * Key invariants under test (unit level):
 *   1. A real HTTPS URL is accepted.
 *   2. A data: URI (inline base64) is always rejected — regardless of length.
 *   3. A string whose byte length exceeds MAX_VIDEO_URL_BYTES is rejected.
 *   4. An empty string is accepted (caller decides whether undefined/null is
 *      preferred; the guard only fires when a non-null value is supplied).
 *   5. A URL exactly at the byte limit is accepted; one byte over is rejected.
 *
 * Key invariants under test (route level — POST /analyses and PATCH /analyses/:id):
 *   6. A data: URI sent as videoUrl in a POST body is rejected with 400.
 *   7. An oversized videoUrl string sent in a POST body is rejected with 400.
 *   8. A valid videoUrl in a POST body returns 201.
 *   9. A data: URI sent as videoUrl in a PATCH body is rejected with 400.
 *  10. An oversized videoUrl string sent in a PATCH body is rejected with 400.
 *  11. A valid videoUrl in a PATCH body does not trigger the URL error path.
 */

import { describe, it, expect, vi } from "vitest";
import { validateVideoUrl, MAX_VIDEO_URL_BYTES } from "../routes/analyses";

// ─── Shared mock setup ─────────────────────────────────────────────────────────
//
// vi.hoisted runs before module imports are resolved, so env vars and mock
// factories defined here are available when the modules load.

const h = vi.hoisted(() => {
  const TEST_USER_ID = 99;
  const fakeRow = {
    id: 1,
    userId: TEST_USER_ID,
    title: "test session",
    sport: "running",
    status: "processing",
    videoUrl: null,
    thumbnailUrl: null,
    duration: null,
    overallScore: null,
    techniqueScore: null,
    powerScore: null,
    balanceScore: null,
    consistencyScore: null,
    mobilityScore: null,
    speedScore: null,
    strengths: [],
    improvements: [],
    jointAngles: null,
    jointRisks: null,
    biomechanicsApplied: false,
    coachingMoments: null,
    movementSummary: null,
    movementSummaryAt: null,
    uploadedAt: new Date(),
    movementType: null,
    tips: [],
    injuryRisks: [],
  };

  const analysesTable: any = {
    __name: "analyses",
    id: { __col: "id" },
    userId: { __col: "userId" },
    sport: { __col: "sport" },
    status: { __col: "status" },
    biomechanicsApplied: { __col: "biomechanicsApplied" },
    uploadedAt: { __col: "uploadedAt" },
    jointAngles: { __col: "jointAngles" },
    jointRisks: { __col: "jointRisks" },
    thumbnailUrl: { __col: "thumbnailUrl" },
    movementType: { __col: "movementType" },
  };

  const fakeDb = {
    select() {
      return {
        from(_t: any) {
          return {
            where(_c: any) {
              return Promise.resolve([{ ...fakeRow }]);
            },
            orderBy(_c: any) {
              return {
                limit(_n: any) {
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
    update(_t: any) {
      return {
        set(_v: any) {
          return {
            where(_c: any) {
              return Promise.resolve();
            },
          };
        },
      };
    },
    insert(_t: any) {
      return {
        values(_v: any) {
          return {
            returning() {
              return Promise.resolve([{ ...fakeRow }]);
            },
          };
        },
      };
    },
  };

  return { fakeDb, analysesTable, TEST_USER_ID };
});

vi.mock("@workspace/db", () => ({
  db: h.fakeDb,
  analysesTable: h.analysesTable,
  profilesTable: { __name: "profiles" },
  completedDrillsTable: { __name: "completed_drills" },
  pool: { end: vi.fn() },
}));

vi.mock("../routes/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = h.TEST_USER_ID;
    next();
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (_col: any, _val: any) => ({}),
  and: (..._conds: any[]) => ({}),
  desc: (_col: any) => ({}),
  ne: (_col: any, _val: any) => ({}),
}));

vi.mock("../lib/anthropic", () => ({
  analyzeAthletePerformance: vi.fn(async () => ({
    overallScore: 80,
    techniqueScore: 80,
    powerScore: 80,
    balanceScore: 80,
    consistencyScore: 80,
    mobilityScore: 80,
    speedScore: 80,
    strengths: [],
    improvements: [],
    tips: [],
    injuryRisks: [],
  })),
  detectSportFromFrame: vi.fn(async () => ({ sport: "running", movementType: "sprint" })),
  generateCoachingMoments: vi.fn(async () => []),
  generateMovementSummary: vi.fn(async () => ({})),
}));

vi.mock("../lib/resize-thumbnail", () => ({
  resizeThumbnail: vi.fn(async () => "https://thumb.example.com/t.jpg"),
  THUMBNAIL_MAX_WIDTH: 160,
}));

import express from "express";
import request from "supertest";
import analysesRouter from "../routes/analyses";

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(analysesRouter);
  return app;
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe("validateVideoUrl — policy: only real URLs, never inline base64", () => {
  it("accepts a normal HTTPS URL", () => {
    expect(validateVideoUrl("https://cdn.example.com/videos/session-42.mp4")).toBeNull();
  });

  it("accepts an HTTP URL", () => {
    expect(validateVideoUrl("http://localhost:3000/uploads/video.mp4")).toBeNull();
  });

  it("accepts an empty string (caller decides on undefined/null preference)", () => {
    expect(validateVideoUrl("")).toBeNull();
  });

  it("rejects a data: URI with a video MIME type", () => {
    const dataUri = "data:video/mp4;base64,AAAA";
    expect(validateVideoUrl(dataUri)).toMatch(/data URI/);
  });

  it("rejects a data: URI with an image MIME type (e.g. accidental frame upload)", () => {
    const dataUri = "data:image/jpeg;base64," + "A".repeat(100);
    expect(validateVideoUrl(dataUri)).toMatch(/data URI/);
  });

  it("rejects a bare base64 string that exceeds the byte cap", () => {
    const oversized = "A".repeat(MAX_VIDEO_URL_BYTES + 1);
    expect(validateVideoUrl(oversized)).toMatch(/bytes or fewer/);
  });

  it("accepts a URL exactly at MAX_VIDEO_URL_BYTES", () => {
    const atLimit = "https://x.com/" + "a".repeat(MAX_VIDEO_URL_BYTES - "https://x.com/".length);
    expect(Buffer.byteLength(atLimit, "utf8")).toBe(MAX_VIDEO_URL_BYTES);
    expect(validateVideoUrl(atLimit)).toBeNull();
  });

  it("rejects a URL one byte over MAX_VIDEO_URL_BYTES", () => {
    const overLimit = "https://x.com/" + "a".repeat(MAX_VIDEO_URL_BYTES - "https://x.com/".length + 1);
    expect(Buffer.byteLength(overLimit, "utf8")).toBe(MAX_VIDEO_URL_BYTES + 1);
    expect(validateVideoUrl(overLimit)).toMatch(/bytes or fewer/);
  });

  it("data: check takes precedence over length check", () => {
    const shortDataUri = "data:video/mp4;base64,short";
    const error = validateVideoUrl(shortDataUri);
    expect(error).toMatch(/data URI/);
    expect(error).not.toMatch(/bytes or fewer/);
  });
});

// ─── Route-level tests: POST /analyses applies the guard ──────────────────────

describe("POST /analyses — videoUrl guard applied at route level", () => {
  it("rejects a data: URI sent as videoUrl with 400", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/analyses")
      .send({ title: "Test session", sport: "running", videoUrl: "data:video/mp4;base64,AAAA" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/data URI/);
  });

  it("rejects an oversized videoUrl string with 400", async () => {
    const app = makeApp();
    const oversized = "https://cdn.example.com/" + "a".repeat(MAX_VIDEO_URL_BYTES);
    const res = await request(app)
      .post("/analyses")
      .send({ title: "Test session", sport: "running", videoUrl: oversized });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/bytes or fewer/);
  });

  it("accepts a valid HTTPS videoUrl with 201", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/analyses")
      .send({
        title: "Test session",
        sport: "running",
        videoUrl: "https://cdn.example.com/videos/session-42.mp4",
      });

    expect(res.status).toBe(201);
    expect(res.body.analysis).toBeDefined();
  });
});

// ─── Route-level tests: PATCH /analyses/:id applies the same guard ─────────────

describe("PATCH /analyses/:id — videoUrl guard applied at route level", () => {
  it("rejects a data: URI sent as videoUrl with 400", async () => {
    const app = makeApp();
    const res = await request(app)
      .patch("/analyses/1")
      .send({ videoUrl: "data:video/mp4;base64,AAAA" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/data URI/);
  });

  it("rejects an oversized videoUrl string with 400", async () => {
    const app = makeApp();
    const oversized = "https://cdn.example.com/" + "a".repeat(MAX_VIDEO_URL_BYTES);
    const res = await request(app)
      .patch("/analyses/1")
      .send({ videoUrl: oversized });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/bytes or fewer/);
  });

  it("accepts a valid videoUrl and returns HTTP 200", async () => {
    const app = makeApp();
    // Include `sport` so the sport-only correction path fires and the route
    // returns 200. A videoUrl-only PATCH would hit the "no measured data"
    // guard (also 400), masking whether the URL policy guard passed.
    const res = await request(app)
      .patch("/analyses/1")
      .send({ videoUrl: "https://cdn.example.com/videos/session-42.mp4", sport: "running" });

    expect(res.status).toBe(200);
  });
});
