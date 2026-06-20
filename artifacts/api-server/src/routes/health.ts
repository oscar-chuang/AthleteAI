import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getAlertCounter } from "../lib/alerting";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

const _window = { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW_MS };

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now >= _window.resetAt) {
    _window.count = 0;
    _window.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  _window.count += 1;
  return _window.count <= RATE_LIMIT_MAX;
}

const DEFAULT_RESIZE_FAIL_WARN_THRESHOLD = 5;

function getResizeFailWarnThreshold(): number {
  const parsed = parseInt(
    process.env.RESIZE_FAIL_WARN_THRESHOLD ?? String(DEFAULT_RESIZE_FAIL_WARN_THRESHOLD),
    10,
  );
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_RESIZE_FAIL_WARN_THRESHOLD;
}

router.get("/health/metrics", (_req: Request, res: Response) => {
  if (!checkRateLimit()) {
    res.status(429).json({ error: "rate limit exceeded" });
    return;
  }
  const resizeFailed = getAlertCounter("thumbnail_resize_failed");
  const threshold = getResizeFailWarnThreshold();
  res.json({
    thumbnail_resize_failed: resizeFailed,
    alerts: {
      thumbnail_resize_failed: resizeFailed >= threshold ? "warn" : "ok",
    },
  });
});

export { _window as _metricsRateLimitWindow };
export default router;
