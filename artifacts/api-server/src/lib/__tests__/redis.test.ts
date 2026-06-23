import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const store = new Map<string, string>();

  const fakeRedis = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
      const nxIdx = args.indexOf("NX");
      if (nxIdx !== -1 && store.has(key)) return null;
      store.set(key, value);
      return "OK";
    }),
    del: vi.fn(async (...keys: string[]) => {
      let n = 0;
      for (const k of keys) { if (store.delete(k)) n++; }
      return n;
    }),
    pipeline: vi.fn(() => ({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => [[null, 1], [null, 1]]),
    })),
    on: vi.fn(),
  };

  function FakeRedisConstructor() { return fakeRedis; }
  FakeRedisConstructor.prototype = {};

  return { store, fakeRedis, FakeRedisConstructor };
});

vi.mock("ioredis", () => ({ default: h.FakeRedisConstructor }));

import { cache, _resetRedisForTesting } from "../redis";

function withRedisUrl(fn: () => Promise<void>) {
  return async () => {
    process.env["REDIS_URL"] = "redis://localhost:6379";
    _resetRedisForTesting();
    try {
      await fn();
    } finally {
      delete process.env["REDIS_URL"];
      _resetRedisForTesting();
      h.store.clear();
      vi.clearAllMocks();
    }
  };
}

describe("cache.getOrSet", () => {
  it(
    "returns MISS on first call and stores the value",
    withRedisUrl(async () => {
      const fn = vi.fn(async () => ({ score: 42 }));
      const result = await cache.getOrSet("test:key", 60, fn);
      expect(result.hit).toBe(false);
      expect(result.value).toEqual({ score: 42 });
      expect(fn).toHaveBeenCalledTimes(1);
      expect(h.store.has("test:key")).toBe(true);
    })
  );

  it(
    "returns HIT on second call without invoking fn",
    withRedisUrl(async () => {
      const fn = vi.fn(async () => ({ score: 99 }));
      await cache.getOrSet("test:hit", 60, fn);
      const second = await cache.getOrSet("test:hit", 60, fn);
      expect(second.hit).toBe(true);
      expect(second.value).toEqual({ score: 99 });
      expect(fn).toHaveBeenCalledTimes(1);
    })
  );

  it("falls through to fn when Redis is unavailable", async () => {
    delete process.env["REDIS_URL"];
    _resetRedisForTesting();
    const fn = vi.fn(async () => "fallback");
    const result = await cache.getOrSet("no-redis", 60, fn);
    expect(result.hit).toBe(false);
    expect(result.value).toBe("fallback");
    expect(fn).toHaveBeenCalledTimes(1);
    _resetRedisForTesting();
  });
});

describe("cache.invalidate", () => {
  it(
    "removes keys from Redis",
    withRedisUrl(async () => {
      await cache.getOrSet("del:a", 60, async () => 1);
      await cache.getOrSet("del:b", 60, async () => 2);
      await cache.invalidate("del:a", "del:b");
      expect(h.store.has("del:a")).toBe(false);
      expect(h.store.has("del:b")).toBe(false);
    })
  );

  it("is a no-op when Redis is unavailable", async () => {
    delete process.env["REDIS_URL"];
    _resetRedisForTesting();
    await expect(cache.invalidate("x")).resolves.toBeUndefined();
    _resetRedisForTesting();
  });
});

describe("cache.acquireLock / releaseLock", () => {
  it(
    "acquires lock when key is absent",
    withRedisUrl(async () => {
      const acquired = await cache.acquireLock("lock:test:1", 5000);
      expect(acquired).toBe(true);
    })
  );

  it(
    "returns false when lock is already held",
    withRedisUrl(async () => {
      await cache.acquireLock("lock:test:2", 5000);
      const second = await cache.acquireLock("lock:test:2", 5000);
      expect(second).toBe(false);
    })
  );

  it(
    "allows re-acquisition after release",
    withRedisUrl(async () => {
      await cache.acquireLock("lock:test:3", 5000);
      await cache.releaseLock("lock:test:3");
      const reacquired = await cache.acquireLock("lock:test:3", 5000);
      expect(reacquired).toBe(true);
    })
  );

  it("acquireLock returns true when Redis is unavailable (graceful degradation)", async () => {
    delete process.env["REDIS_URL"];
    _resetRedisForTesting();
    const result = await cache.acquireLock("lock:no-redis", 5000);
    expect(result).toBe(true);
    _resetRedisForTesting();
  });
});
