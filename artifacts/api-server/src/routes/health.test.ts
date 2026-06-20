import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../app";
import { _resetAlertCounters, incrementAlertCounter } from "../lib/alerting";
import { _metricsRateLimitWindow } from "./health";

beforeEach(() => {
  _resetAlertCounters();
  _metricsRateLimitWindow.count = 0;
  _metricsRateLimitWindow.resetAt = Date.now() + 60_000;
  delete process.env.RESIZE_FAIL_WARN_THRESHOLD;
});

afterEach(() => {
  delete process.env.RESIZE_FAIL_WARN_THRESHOLD;
});

describe("GET /api/health/metrics", () => {
  it("returns 200 with thumbnail_resize_failed = 0 when no failures have occurred", async () => {
    const res = await request(app).get("/api/health/metrics");
    expect(res.status).toBe(200);
    expect(res.body.thumbnail_resize_failed).toBe(0);
    expect(res.body.alerts).toEqual({ thumbnail_resize_failed: "ok" });
  });

  it("reflects the counter after a failed resize", async () => {
    const { resizeThumbnail } = await import("../lib/resize-thumbnail");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await resizeThumbnail("not-valid-base64!!!");
    await resizeThumbnail("also-garbage!!!");

    const res = await request(app).get("/api/health/metrics");
    expect(res.status).toBe(200);
    expect(res.body.thumbnail_resize_failed).toBe(2);
    expect(res.body.alerts.thumbnail_resize_failed).toBe("ok");

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

describe("GET /api/health/metrics — alert threshold", () => {
  it("alerts.thumbnail_resize_failed is 'ok' when count is below the default threshold (5)", async () => {
    for (let i = 0; i < 4; i++) incrementAlertCounter("thumbnail_resize_failed");
    const res = await request(app).get("/api/health/metrics");
    expect(res.status).toBe(200);
    expect(res.body.thumbnail_resize_failed).toBe(4);
    expect(res.body.alerts.thumbnail_resize_failed).toBe("ok");
  });

  it("alerts.thumbnail_resize_failed flips to 'warn' exactly at the default threshold (5)", async () => {
    for (let i = 0; i < 5; i++) incrementAlertCounter("thumbnail_resize_failed");
    const res = await request(app).get("/api/health/metrics");
    expect(res.status).toBe(200);
    expect(res.body.thumbnail_resize_failed).toBe(5);
    expect(res.body.alerts.thumbnail_resize_failed).toBe("warn");
  });

  it("alerts.thumbnail_resize_failed stays 'warn' above the threshold", async () => {
    for (let i = 0; i < 10; i++) incrementAlertCounter("thumbnail_resize_failed");
    const res = await request(app).get("/api/health/metrics");
    expect(res.status).toBe(200);
    expect(res.body.alerts.thumbnail_resize_failed).toBe("warn");
  });

  it("respects a custom RESIZE_FAIL_WARN_THRESHOLD env override", async () => {
    process.env.RESIZE_FAIL_WARN_THRESHOLD = "2";
    incrementAlertCounter("thumbnail_resize_failed");

    const below = await request(app).get("/api/health/metrics");
    expect(below.body.thumbnail_resize_failed).toBe(1);
    expect(below.body.alerts.thumbnail_resize_failed).toBe("ok");

    incrementAlertCounter("thumbnail_resize_failed");

    const at = await request(app).get("/api/health/metrics");
    expect(at.body.thumbnail_resize_failed).toBe(2);
    expect(at.body.alerts.thumbnail_resize_failed).toBe("warn");
  });

  it("falls back to default threshold (5) when env var is non-numeric", async () => {
    process.env.RESIZE_FAIL_WARN_THRESHOLD = "abc";
    for (let i = 0; i < 4; i++) incrementAlertCounter("thumbnail_resize_failed");

    const below = await request(app).get("/api/health/metrics");
    expect(below.body.alerts.thumbnail_resize_failed).toBe("ok");

    incrementAlertCounter("thumbnail_resize_failed");

    const at = await request(app).get("/api/health/metrics");
    expect(at.body.alerts.thumbnail_resize_failed).toBe("warn");
  });
});
