import sharp from "sharp";
import { emitThumbnailResizeAlert } from "./alerting";

/** Thumbnails are displayed at small sizes; cap width at 160 px to limit DB storage. */
export const THUMBNAIL_MAX_WIDTH = 160;
export const THUMBNAIL_JPEG_QUALITY = 40;

/**
 * Down-sample a JPEG/PNG data-URL or raw base64 string to at most
 * THUMBNAIL_MAX_WIDTH pixels wide before it is written to the DB.
 * Returns the original string unchanged if resizing fails so the caller
 * can still persist something rather than losing the frame entirely.
 */
export async function resizeThumbnail(frameBase64: string): Promise<string> {
  try {
    const isDataUrl = frameBase64.startsWith("data:");
    const [prefix, raw] = isDataUrl
      ? (frameBase64.split(",") as [string, string])
      : ["", frameBase64];
    const inputBuf = Buffer.from(raw, "base64");
    const outputBuf = await sharp(inputBuf)
      .resize({ width: THUMBNAIL_MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: THUMBNAIL_JPEG_QUALITY })
      .toBuffer();
    const encoded = outputBuf.toString("base64");
    return isDataUrl ? `${prefix},${encoded}` : encoded;
  } catch (err) {
    const inputBytes = Math.round((frameBase64.length * 3) / 4);
    const inputKB = Math.round(inputBytes / 1024);
    const error = (err as Error).message;
    console.warn("thumbnail_resize_failed", {
      error,
      inputBytes,
      inputKB,
      note: "oversized raw frame may be stored in DB — investigate input source",
    });
    void emitThumbnailResizeAlert({ error, inputBytes, inputKB });
    return frameBase64;
  }
}
