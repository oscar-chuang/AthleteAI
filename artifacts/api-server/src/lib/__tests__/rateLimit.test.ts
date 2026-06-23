import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => {
  let callCount = 0;
  const fakeRedis = {
    pipeline: vi.fn(() => {
      callCount++;
      const count = callCount;
      return {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn(async () => [[null, count], [null, 1]]),
      };
    }),
    on: vi.fn(),
  };
  return { fakeRedis, getCallCount: () => callCount, resetCallCount: () => { callCount = 0; } };
});

vi.mock("ioredis", () => ({ default: vi.fn(() => h.fakeRedis) }));
vi.mock("../redis", () => ({
  redisClient: vi.fn(() => h.fakeRedis),
  isRedisAvailable: vi.fn(() => true),
  _resetRedisForTesting: vi.fn(),
}));

import { globalRateLimit, aiRateLimit } from "../../middleware/rateLimit";

function makeApp(middleware: typeof globalRateLimit) {
  const app = express();
  app.use((req, _res, next) => { (req as express.Request & { userId?: number }).userId = 99; next(); });
  app.use(middleware);
  app.get("/test", (_req, res) => { res.json({ ok: true }); });
  return app;
}

describe("globalRateLimit", () => {
  beforeEach(() => { h.resetCallCount(); });

  it("passes requests under the limit", async () => {
    const app = makeApp(globalRateLimit);
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
  });

  it("returns 429 when limit exceeded (count > 120)", async () => {
    vi.mocked(h.fakeRedis.pipeline).mockImplementationOnce(() => ({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => [[null, 121], [null, 1]]),
    }));
    const app = makeApp(globalRateLimit);
    const res = await request(app).get("/test");
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("Too many requests");
    expect(res.headers["retry-after"]).toBeDefined();
  });
});

describe("aiRateLimit", () => {
  beforeEach(() => { h.resetCallCount(); });

  it("passes requests under AI limit (10/min)", async () => {
    vi.mocked(h.fakeRedis.pipeline).mockImplementationOnce(() => ({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => [[null, 5], [null, 1]]),
    }));
    const app = makeApp(aiRateLimit);
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
  });

  it("returns 429 with Retry-After when AI limit exceeded", async () => {
    vi.mocked(h.fakeRedis.pipeline).mockImplementationOnce(() => ({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => [[null, 11], [null, 1]]),
    }));
    const app = makeApp(aiRateLimit);
    const res = await request(app).get("/test");
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("Too many requests");
    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("passes through when Redis is unavailable", async () => {
    const { redisClient } = await import("../redis");
    vi.mocked(redisClient).mockReturnValueOnce(null);
    const app = makeApp(aiRateLimit);
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
  });
});
