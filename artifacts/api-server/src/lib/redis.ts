// ioredis is loaded at runtime via require() so that a missing binary does not
// cause a static import error.  When unavailable, the module falls back to
// no-op stubs (caching, rate-limiting and distributed locks are disabled).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;
let _disabled = false;

function getClient(): any {
  if (_disabled) return null;
  if (_client) return _client;

  const url = process.env["REDIS_URL"];
  if (!url) {
    console.warn("[redis] REDIS_URL not set — caching, rate-limiting and distributed locks are disabled");
    _disabled = true;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RedisClass = require("ioredis");
    _client = new RedisClass(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.warn(`[redis] Connection failed after ${times} attempts — disabling Redis features`);
          _disabled = true;
          _client = null;
          return null;
        }
        return Math.min(times * 500, 2000);
      },
    });

    _client.on("error", (err: Error) => {
      console.warn("[redis] Connection error:", err.message);
    });
  } catch {
    console.warn("[redis] ioredis not available — Redis features disabled");
    _disabled = true;
    return null;
  }

  return _client;
}

export function redisClient(): any {
  return getClient();
}

export function isRedisAvailable(): boolean {
  return !_disabled && !!process.env["REDIS_URL"];
}

export const cache = {
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>
  ): Promise<{ value: T; hit: boolean }> {
    const client = getClient();
    if (client) {
      try {
        const raw = await client.get(key);
        if (raw !== null) {
          return { value: JSON.parse(raw) as T, hit: true };
        }
      } catch {
      }
    }

    const value = await fn();

    if (client) {
      try {
        await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
      } catch {
      }
    }

    return { value, hit: false };
  },

  async invalidate(...keys: string[]): Promise<void> {
    const client = getClient();
    if (!client || keys.length === 0) return;
    try {
      await client.del(...keys);
    } catch {
    }
  },

  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    const client = getClient();
    if (!client) return true;
    try {
      const result = await client.set(key, "1", "PX", ttlMs, "NX");
      return result === "OK";
    } catch {
      return true;
    }
  },

  async releaseLock(key: string): Promise<void> {
    const client = getClient();
    if (!client) return;
    try {
      await client.del(key);
    } catch {
    }
  },

  async invalidatePrefix(prefix: string): Promise<void> {
    const client = getClient();
    if (!client) return;
    try {
      const keys: string[] = [];
      let cursor = "0";
      do {
        const [nextCursor, batch] = await client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
        cursor = nextCursor;
        keys.push(...batch);
      } while (cursor !== "0");
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch {
    }
  },
};

export function _resetRedisForTesting(): void {
  _client = null;
  _disabled = false;
}
