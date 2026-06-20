/**
 * Unit tests for the avatar compression migration script
 * (artifacts/api-server/src/scripts/migrate-avatars.ts).
 *
 * Key invariants under test:
 *   1. A data-URL avatar above the 20 KB limit is compressed and the DB
 *      update callback is invoked with the smaller result.
 *   2. A data-URL avatar already within the limit is skipped — the DB
 *      update callback is never called (idempotency).
 *   3. A non-data-URL avatar (plain HTTPS URL) is skipped without a DB write.
 *   4. An error on one row increments the error count and does not abort
 *      processing of subsequent rows.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import sharp from "sharp";
import {
  compressAvatarIfNeeded,
  processRow,
  runWithDeps,
  AVATAR_MAX_BYTES,
  AVATAR_MAX_PX,
} from "./migrate-avatars.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a solid-colour JPEG of the given dimensions and return it as a
 * base64-encoded data-URI.  Used to produce controllably-sized test inputs.
 */
async function makeJpegDataUri(width: number, height: number, quality = 95): Promise<string> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 80, b: 200 } },
  })
    .jpeg({ quality })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

/**
 * Build a random-pixel PNG that is guaranteed to be above AVATAR_MAX_BYTES.
 * PNG is used because random noise does not compress, so the output is large.
 */
async function makeLargeDataUri(): Promise<string> {
  const { randomBytes } = await import("crypto");
  const pixels = randomBytes(400 * 400 * 3);
  const buf = await sharp(pixels, { raw: { width: 400, height: 400, channels: 3 } })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buf.toString("base64")}`;
}

/** Decode a data-URI and return the image dimensions via sharp. */
async function dimensionsFromDataUri(dataUri: string): Promise<{ width: number; height: number }> {
  const commaIdx = dataUri.indexOf(",");
  const buf = Buffer.from(dataUri.slice(commaIdx + 1), "base64");
  const meta = await sharp(buf).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0 };
}

// ─── fixtures ────────────────────────────────────────────────────────────────

let largeDataUri: string;
let smallDataUri: string;

beforeAll(async () => {
  largeDataUri = await makeLargeDataUri();

  // Build a small image that fits within AVATAR_MAX_BYTES.
  // 10×10 solid-colour JPEG is well under 20 KB.
  smallDataUri = await makeJpegDataUri(10, 10, 50);

  // Sanity-checks so a test image change doesn't silently invalidate assumptions.
  const largeBytes = Buffer.from(largeDataUri.split(",")[1]!, "base64").byteLength;
  expect(largeBytes).toBeGreaterThan(AVATAR_MAX_BYTES);

  const smallBytes = Buffer.from(smallDataUri.split(",")[1]!, "base64").byteLength;
  expect(smallBytes).toBeLessThanOrEqual(AVATAR_MAX_BYTES);
});

// ─── compressAvatarIfNeeded ───────────────────────────────────────────────────

describe("compressAvatarIfNeeded", () => {
  it("compresses a large data-URI to ≤ 20 KB (decoded bytes)", async () => {
    const result = await compressAvatarIfNeeded(largeDataUri);

    const base64Part = result.replace(/^data:image\/jpeg;base64,/, "");
    const decoded = Buffer.from(base64Part, "base64");

    expect(decoded.byteLength).toBeLessThanOrEqual(AVATAR_MAX_BYTES);
  });

  it("produces a data:image/jpeg;base64,... URI after compression", async () => {
    const result = await compressAvatarIfNeeded(largeDataUri);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it(`resizes the compressed image to exactly ${AVATAR_MAX_PX}×${AVATAR_MAX_PX} px`, async () => {
    const result = await compressAvatarIfNeeded(largeDataUri);
    const { width, height } = await dimensionsFromDataUri(result);
    expect(width).toBe(AVATAR_MAX_PX);
    expect(height).toBe(AVATAR_MAX_PX);
  });

  it("returns a data-URI unchanged when already within the size limit (idempotency)", async () => {
    const result = await compressAvatarIfNeeded(smallDataUri);
    expect(result).toBe(smallDataUri);
  });

  it("passes a plain HTTPS URL through unchanged (no data-URI prefix)", async () => {
    const plainUrl = "https://example.com/avatar.jpg";
    const result = await compressAvatarIfNeeded(plainUrl);
    expect(result).toBe(plainUrl);
  });

  it("passes a non-image data-URI through unchanged", async () => {
    const textUri = "data:text/plain;base64,aGVsbG8=";
    const result = await compressAvatarIfNeeded(textUri);
    expect(result).toBe(textUri);
  });
});

// ─── processRow ──────────────────────────────────────────────────────────────

describe("processRow", () => {
  it("compresses a large data-URI avatar and calls updateFn with the result", async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const row = { id: 1, userId: 10, avatarUrl: largeDataUri };

    const result = await processRow(row, updateFn);

    expect(result).toBe("compressed");
    expect(updateFn).toHaveBeenCalledOnce();

    const [calledId, calledUrl] = updateFn.mock.calls[0] as [number, string];
    expect(calledId).toBe(1);
    expect(calledUrl).toMatch(/^data:image\/jpeg;base64,/);
    const bytes = Buffer.from(calledUrl.split(",")[1]!, "base64").byteLength;
    expect(bytes).toBeLessThanOrEqual(AVATAR_MAX_BYTES);
  });

  it("skips a data-URI already within the limit and never calls updateFn", async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const row = { id: 2, userId: 10, avatarUrl: smallDataUri };

    const result = await processRow(row, updateFn);

    expect(result).toBe("skipped");
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("skips a plain HTTPS URL and never calls updateFn", async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const row = { id: 3, userId: 10, avatarUrl: "https://example.com/photo.jpg" };

    const result = await processRow(row, updateFn);

    expect(result).toBe("skipped");
    expect(updateFn).not.toHaveBeenCalled();
  });
});

// ─── runWithDeps ─────────────────────────────────────────────────────────────

describe("runWithDeps", () => {
  it("returns correct counts for a mixed batch", async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const rows = [
      { id: 1, userId: 10, avatarUrl: largeDataUri },           // → compressed
      { id: 2, userId: 11, avatarUrl: smallDataUri },           // → skipped (within limit)
      { id: 3, userId: 12, avatarUrl: "https://cdn.example.com/a.jpg" }, // → skipped (non-data-URI)
    ];

    const stats = await runWithDeps(rows, updateFn);

    expect(stats.compressed).toBe(1);
    expect(stats.skipped).toBe(2);
    expect(stats.errors).toBe(0);
    expect(updateFn).toHaveBeenCalledOnce();
  });

  it("increments error count for a failing row and continues processing remaining rows", async () => {
    let callCount = 0;
    const updateFn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error("simulated DB write failure");
    });

    const rows = [
      { id: 10, userId: 1, avatarUrl: largeDataUri }, // updateFn throws → error
      { id: 11, userId: 2, avatarUrl: largeDataUri }, // should still be processed
    ];

    const stats = await runWithDeps(rows, updateFn);

    expect(stats.errors).toBe(1);
    expect(stats.compressed).toBe(1);
    expect(stats.skipped).toBe(0);
    // Both rows were attempted — the second succeeded despite the first failing.
    expect(updateFn).toHaveBeenCalledTimes(2);
  });

  it("returns all-zero stats for an empty batch", async () => {
    const updateFn = vi.fn();
    const stats = await runWithDeps([], updateFn);

    expect(stats).toEqual({ skipped: 0, compressed: 0, errors: 0 });
    expect(updateFn).not.toHaveBeenCalled();
  });
});
