import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import sharp from "sharp";
import { resizeThumbnail, THUMBNAIL_MAX_WIDTH } from "./resize-thumbnail";

/**
 * Build a synthetic JPEG buffer with the given dimensions using sharp.
 * The image is a solid colour so it compresses well and is trivially small
 * to create, but still valid enough for sharp to decode on the output side.
 */
async function makeSyntheticJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe("resizeThumbnail()", () => {
  it("reduces a wide image to at most THUMBNAIL_MAX_WIDTH pixels", async () => {
    const inputWidth = 640;
    const inputBuf = await makeSyntheticJpeg(inputWidth, 360);
    const inputBase64 = inputBuf.toString("base64");

    const outputBase64 = await resizeThumbnail(inputBase64);

    const outputBuf = Buffer.from(outputBase64, "base64");
    const { width } = await sharp(outputBuf).metadata();

    expect(width).toBeDefined();
    expect(width!).toBeLessThanOrEqual(THUMBNAIL_MAX_WIDTH);
  });

  it("produces a noticeably smaller byte count than the original", async () => {
    const inputBuf = await makeSyntheticJpeg(640, 360);
    const inputBase64 = inputBuf.toString("base64");

    const outputBase64 = await resizeThumbnail(inputBase64);

    expect(outputBase64.length).toBeLessThan(inputBase64.length * 0.5);
  });

  it("handles a data-URL prefix and round-trips the prefix intact", async () => {
    const inputBuf = await makeSyntheticJpeg(320, 240);
    const inputBase64 = inputBuf.toString("base64");
    const dataUrl = `data:image/jpeg;base64,${inputBase64}`;

    const outputDataUrl = await resizeThumbnail(dataUrl);

    expect(outputDataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);

    const outputBuf = Buffer.from(outputDataUrl.split(",")[1]!, "base64");
    const { width } = await sharp(outputBuf).metadata();
    expect(width!).toBeLessThanOrEqual(THUMBNAIL_MAX_WIDTH);
  });

  it("does not enlarge an image that is already within the size limit", async () => {
    const inputWidth = 80;
    const inputBuf = await makeSyntheticJpeg(inputWidth, 60);
    const inputBase64 = inputBuf.toString("base64");

    const outputBase64 = await resizeThumbnail(inputBase64);

    const outputBuf = Buffer.from(outputBase64, "base64");
    const { width } = await sharp(outputBuf).metadata();
    expect(width!).toBeLessThanOrEqual(inputWidth);
  });

  it("falls back to the original string when given invalid input", async () => {
    const garbage = "not-valid-base64!!!";
    const result = await resizeThumbnail(garbage);
    expect(result).toBe(garbage);
  });

  it("logs a structured warning with input size when the fallback is hit", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const garbage = "not-valid-base64!!!";
      await resizeThumbnail(garbage);

      expect(warnSpy).toHaveBeenCalledOnce();

      const [label, payload] = warnSpy.mock.calls[0] as [string, Record<string, unknown>];
      expect(label).toBe("thumbnail_resize_failed");
      expect(typeof payload.error).toBe("string");
      expect(typeof payload.inputBytes).toBe("number");
      expect(typeof payload.inputKB).toBe("number");
      expect(typeof payload.note).toBe("string");
    } finally {
      warnSpy.mockRestore();
    }
  });
});
