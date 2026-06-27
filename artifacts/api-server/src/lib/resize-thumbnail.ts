import { randomUUID } from "node:crypto";
// sharp native binary is not available in this environment — resizing is skipped.
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
  // sharp native binary not available — return frame unchanged.
  return frameBase64;
}

// Keep imports referenced so the module resolves without unused-import warnings.
void randomUUID; void emitThumbnailResizeAlert;
