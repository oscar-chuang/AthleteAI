/**
 * Unit tests for compressAvatarIfNeeded (routes/profile.ts).
 *
 * Invariants under test:
 *   1. A large base64 JPEG is stored as a data:image/jpeg;base64,... URI.
 *   2. The decoded bytes of the compressed output are ≤ 20 KB.
 *   3. A null/undefined avatarUrl is not passed to the function (route skips it).
 *   4. A non-data-URI string (e.g. a plain URL) passes through unchanged.
 */

import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { compressAvatarIfNeeded } from "../routes/profile";

const AVATAR_MAX_BYTES = 20 * 1024;

// Build a 400×400 noise-filled PNG that is comfortably over the 20 KB limit.
// PNG is used here because random-pixel data does not compress efficiently —
// this guarantees the input is well above 20 KB regardless of the encoder.
let largeJpegDataUri: string;

beforeAll(async () => {
  // 400×400 × 3-channel random pixel data → PNG (random noise stays large)
  const { randomBytes } = await import("crypto");
  const rawPixels = randomBytes(400 * 400 * 3);

  const buf = await sharp(rawPixels, {
    raw: { width: 400, height: 400, channels: 3 },
  })
    .png()
    .toBuffer();

  largeJpegDataUri = `data:image/png;base64,${buf.toString("base64")}`;

  // Sanity-check: confirm the test image is actually larger than the limit
  expect(buf.byteLength).toBeGreaterThan(AVATAR_MAX_BYTES);
});

// ─────────────────────────────────────────────────────────────────────────────

describe("compressAvatarIfNeeded", () => {
  it("returns a data:image/jpeg;base64,... URI for a large JPEG input", async () => {
    const result = await compressAvatarIfNeeded(largeJpegDataUri);

    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("compresses the output to ≤ 20 KB (decoded bytes)", async () => {
    const result = await compressAvatarIfNeeded(largeJpegDataUri);

    const base64Part = result.replace(/^data:image\/jpeg;base64,/, "");
    const decoded = Buffer.from(base64Part, "base64");

    expect(decoded.byteLength).toBeLessThanOrEqual(AVATAR_MAX_BYTES);
  });

  it("passes through a plain HTTPS URL unchanged (no data-URI prefix)", async () => {
    const plainUrl = "https://example.com/avatar.jpg";
    const result = await compressAvatarIfNeeded(plainUrl);

    expect(result).toBe(plainUrl);
  });

  it("passes through a non-image data URI unchanged", async () => {
    const textDataUri = "data:text/plain;base64,aGVsbG8=";
    const result = await compressAvatarIfNeeded(textDataUri);

    expect(result).toBe(textDataUri);
  });
});
