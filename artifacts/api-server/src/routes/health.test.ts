import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../app";
import { _resetAlertCounters } from "../lib/alerting";
import { _metricsRateLimitWindow } from "./health";

beforeEach(() => {
  _resetAlertCounters();
  _metricsRateLimitWindow.count = 0;
  _metricsRateLimitWindow.resetAt = Date.now() + 60_000;
});

describe("GET /api/health/metrics", () => {
  it("returns 200 with thumbnail_resize_failed = 0 when no failures have occurred", async () => {
    const res = await request(app).get("/api/health/metrics");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ thumbnail_resize_failed: 0 });
  });

  it("reflects the counter after a failed resize", async () => {
    const { resizeThumbnail } = await import("../lib/resize-thumbnail");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await resizeThumbnail("not-valid-base64!!!");
    await resizeThumbnail("also-garbage!!!");

    const res = await request(app).get("/api/health/metrics");
    expect(res.status).toBe(200);
    expect(res.body.thumbnail_resize_failed).toBe(2);

    vi.restoreAllMocks();
  });

  it("returns 429 once the rate limit window is exhausted", async () => {
    _metricsRateLimitWindow.count = 60;

    const res = await request(app).get("/api/health/metrics");
    expect(res.status).toBe(429);
  });

  it("resets the counter when the window expires", async () => {
    _metricsRateLimitWindow.count = 60;
    _metricsRateLimitWindow.resetAt = Date.now() - 1;

    const res = await request(app).get("/api/health/metrics");
    expect(res.status).toBe(200);
    expect(res.body.thumbnail_resize_failed).toBe(0);
  });
});
