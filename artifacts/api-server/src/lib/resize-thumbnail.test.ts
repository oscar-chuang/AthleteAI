import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import sharp from "sharp";
import { resizeThumbnail, THUMBNAIL_MAX_WIDTH } from "./resize-thumbnail";
import { getAlertCounter, _resetAlertCounters } from "./alerting";

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

  describe("alerting on resize failure", () => {
    beforeEach(() => {
      _resetAlertCounters();
    });

    it("increments the thumbnail_resize_failed counter when resize fails", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(getAlertCounter("thumbnail_resize_failed")).toBe(0);

      await resizeThumbnail("not-valid-base64!!!");

      expect(getAlertCounter("thumbnail_resize_failed")).toBe(1);

      await resizeThumbnail("also-garbage!!!");

      expect(getAlertCounter("thumbnail_resize_failed")).toBe(2);
      vi.restoreAllMocks();
    });

    it("does not increment the counter when resize succeeds", async () => {
      const inputBuf = await makeSyntheticJpeg(320, 240);
      await resizeThumbnail(inputBuf.toString("base64"));
      expect(getAlertCounter("thumbnail_resize_failed")).toBe(0);
    });

    it("POSTs to ALERT_WEBHOOK_URL with error and inputBytes when set", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 200 })
      );
      vi.spyOn(console, "warn").mockImplementation(() => {});

      process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/test";
      try {
        await resizeThumbnail("not-valid-base64!!!");

        expect(fetchSpy).toHaveBeenCalledOnce();
        const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://hooks.example.com/test");
        expect(init.method).toBe("POST");

        const body = JSON.parse(init.body as string) as Record<string, unknown>;
        expect(body).toHaveProperty("text");
        expect(JSON.stringify(body)).toContain("thumbnail_resize_failed");

        const attachments = body["attachments"] as Array<Record<string, unknown>>;
        const fields = attachments[0]!["fields"] as Array<{ title: string; value: string }>;
        const errorField = fields.find((f) => f.title === "Error");
        const sizeField = fields.find((f) => f.title === "Input size");
        expect(errorField).toBeDefined();
        expect(typeof errorField!.value).toBe("string");
        expect(sizeField).toBeDefined();
        expect(sizeField!.value).toContain("bytes");
      } finally {
        delete process.env.ALERT_WEBHOOK_URL;
        vi.restoreAllMocks();
      }
    });

    it("does not POST when ALERT_WEBHOOK_URL is not set", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      vi.spyOn(console, "warn").mockImplementation(() => {});
      delete process.env.ALERT_WEBHOOK_URL;

      await resizeThumbnail("not-valid-base64!!!");

      expect(fetchSpy).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it("swallows webhook errors without affecting the resize fallback result", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network failure"));
      vi.spyOn(console, "warn").mockImplementation(() => {});

      process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/test";
      try {
        const result = await resizeThumbnail("not-valid-base64!!!");
        expect(result).toBe("not-valid-base64!!!");
      } finally {
        delete process.env.ALERT_WEBHOOK_URL;
        vi.restoreAllMocks();
      }
    });
  });
});
