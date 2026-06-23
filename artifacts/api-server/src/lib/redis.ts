import Redis from "ioredis";

let _client: Redis | null = null;
let _disabled = false;

function getClient(): Redis | null {
  if (_disabled) return null;
  if (_client) return _client;

  const url = process.env["REDIS_URL"];
  if (!url) {
    console.warn("[redis] REDIS_URL not set — caching, rate-limiting and distributed locks are disabled");
    _disabled = true;
    return null;
  }

  _client = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
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

  return _client;
}

export function redisClient(): Redis | null {
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
