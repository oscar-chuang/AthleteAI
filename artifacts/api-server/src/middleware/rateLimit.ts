import type { Request, Response, NextFunction } from "express";
import { redisClient } from "../lib/redis";

interface RateLimitOptions {
  windowSeconds: number;
  max: number;
  keyPrefix: string;
  skipOnNoRedis?: boolean;
}

function getUserId(req: Request): string {
  return String((req as Request & { userId?: number }).userId ?? req.ip ?? "anon");
}

async function checkRateLimit(
  req: Request,
  res: Response,
  opts: RateLimitOptions
): Promise<boolean> {
  const client = redisClient();
  if (!client) {
    if (!opts.skipOnNoRedis) {
      console.warn(`[rateLimit] Redis unavailable — skipping rate limit for ${opts.keyPrefix}`);
    }
    return true;
  }

  const userId = getUserId(req);
  const window = Math.floor(Date.now() / 1000 / opts.windowSeconds);
  const key = `rl:${opts.keyPrefix}:${userId}:${window}`;

  try {
    const pipeline = client.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, opts.windowSeconds);
    const results = await pipeline.exec();

    const count = results?.[0]?.[1] as number | undefined;
    if (count !== undefined && count > opts.max) {
      const retryAfter = opts.windowSeconds - (Math.floor(Date.now() / 1000) % opts.windowSeconds);
      res.set("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "Too many requests",
        retryAfter,
      });
      return false;
    }
  } catch (err) {
    console.warn("[rateLimit] Redis error — skipping rate limit:", (err as Error).message);
  }

  return true;
}

export function globalRateLimit(req: Request, res: Response, next: NextFunction): void {
  checkRateLimit(req, res, {
    windowSeconds: 60,
    max: 120,
    keyPrefix: "global",
    skipOnNoRedis: true,
  }).then((ok) => {
    if (ok) next();
  }).catch(() => next());
}

export function aiRateLimit(req: Request, res: Response, next: NextFunction): void {
  checkRateLimit(req, res, {
    windowSeconds: 60,
    max: 10,
    keyPrefix: "ai",
  }).then((ok) => {
    if (ok) next();
  }).catch(() => next());
}
