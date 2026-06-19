/**
 * Unit tests for the resize + skip logic in scripts/src/backfill-thumbnails.ts.
 *
 * Key invariants under test:
 *   1. A thumbnail whose width exceeds THUMBNAIL_MAX_WIDTH is resized AND the
 *      DB update callback is invoked with the new (smaller) data-URL.
 *   2. A thumbnail whose width is already ≤ THUMBNAIL_MAX_WIDTH is skipped —
 *      the DB update callback is never called (idempotency).
 *   3. resizeThumbnail itself preserves the data-URL prefix and respects the
 *      withoutEnlargement constraint.
 *   4. resizeThumbnail throws a descriptive error for a malformed data-URL.
 */

import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";
import {
  resizeThumbnail,
  processRow,
  THUMBNAIL_MAX_WIDTH,
} from "../backfill-thumbnails.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal solid-colour JPEG of the requested dimensions and return it
 * as a base64-encoded data-URL with the standard image/jpeg prefix.
 */
async function makeJpegDataUrl(width: number, height: number): Promise<string> {
  const buf = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 80, g: 120, b: 200 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

/** Decode a data-URL and return the image width via sharp. */
async function widthFromDataUrl(dataUrl: string): Promise<number> {
  const commaIdx = dataUrl.indexOf(",");
  const buf = Buffer.from(dataUrl.slice(commaIdx + 1), "base64");
  const meta = await sharp(buf).metadata();
  return meta.width ?? 0;
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("backfill-thumbnails: processRow — resize + skip (idempotency)", () => {
  // ── Case 1: oversized thumbnail ──────────────────────────────────────────

  it("resizes a wide thumbnail and calls updateFn with the shrunk data-URL", async () => {
    const inputWidth = 320;
    expect(inputWidth).toBeGreaterThan(THUMBNAIL_MAX_WIDTH);

    const dataUrl = await makeJpegDataUrl(inputWidth, 240);
    const updateFn = vi.fn().mockResolvedValue(undefined);

    const result = await processRow({ id: 42, thumbnailUrl: dataUrl }, updateFn);

    expect(result).toBe("resized");
    expect(updateFn).toHaveBeenCalledOnce();

    const [calledId, calledUrl] = updateFn.mock.calls[0] as [number, string];
    expect(calledId).toBe(42);

    const outputWidth = await widthFromDataUrl(calledUrl);
    expect(outputWidth).toBeLessThanOrEqual(THUMBNAIL_MAX_WIDTH);
  });

  // ── Case 2: already-small thumbnail (idempotency) ────────────────────────

  it("skips a ≤160 px thumbnail and never calls updateFn", async () => {
    const inputWidth = 120;
    expect(inputWidth).toBeLessThanOrEqual(THUMBNAIL_MAX_WIDTH);

    const dataUrl = await makeJpegDataUrl(inputWidth, 90);
    const updateFn = vi.fn().mockResolvedValue(undefined);

    const result = await processRow({ id: 99, thumbnailUrl: dataUrl }, updateFn);

    expect(result).toBe("skipped");
    expect(updateFn).not.toHaveBeenCalled(); // DB must not be written
  });

  // ── Case 3: exactly THUMBNAIL_MAX_WIDTH — boundary is inclusive ──────────

  it("skips a thumbnail that is exactly THUMBNAIL_MAX_WIDTH px wide", async () => {
    const dataUrl = await makeJpegDataUrl(THUMBNAIL_MAX_WIDTH, 120);
    const updateFn = vi.fn().mockResolvedValue(undefined);

    const result = await processRow({ id: 7, thumbnailUrl: dataUrl }, updateFn);

    expect(result).toBe("skipped");
    expect(updateFn).not.toHaveBeenCalled();
  });

  // ── Case 4: malformed data-URL (no comma) ────────────────────────────────

  it("skips a malformed data-URL with no comma without calling updateFn", async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);

    const result = await processRow(
      { id: 1, thumbnailUrl: "data:image/jpeg;base64NOCOLON" },
      updateFn,
    );

    expect(result).toBe("skipped");
    expect(updateFn).not.toHaveBeenCalled();
  });
});

describe("backfill-thumbnails: resizeThumbnail — image transform invariants", () => {
  it("preserves the data-URL prefix after resize", async () => {
    const dataUrl = await makeJpegDataUrl(320, 240);
    const resized = await resizeThumbnail(dataUrl);

    expect(resized.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("does not enlarge a thumbnail that is already small (withoutEnlargement)", async () => {
    const inputWidth = 80;
    const dataUrl = await makeJpegDataUrl(inputWidth, 60);

    const resized = await resizeThumbnail(dataUrl);
    const outputWidth = await widthFromDataUrl(resized);

    expect(outputWidth).toBeLessThanOrEqual(inputWidth);
  });

  it("throws for a malformed data-URL with no comma", async () => {
    await expect(resizeThumbnail("data:image/jpeg;base64NOCOLON")).rejects.toThrow(
      "malformed data-URL",
    );
  });
});
