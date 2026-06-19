/**
 * Policy tests for videoUrl validation in routes/analyses.ts.
 *
 * Key invariants under test:
 *   1. A real HTTPS URL is accepted.
 *   2. A data: URI (inline base64) is always rejected — regardless of length.
 *   3. A string whose byte length exceeds MAX_VIDEO_URL_BYTES is rejected.
 *   4. An empty string is accepted (caller decides whether undefined/null is
 *      preferred; the guard only fires when a non-null value is supplied).
 *   5. A URL exactly at the byte limit is accepted; one byte over is rejected.
 */

import { describe, it, expect } from "vitest";
import { validateVideoUrl, MAX_VIDEO_URL_BYTES } from "../routes/analyses";

describe("validateVideoUrl — policy: only real URLs, never inline base64", () => {
  it("accepts a normal HTTPS URL", () => {
    expect(validateVideoUrl("https://cdn.example.com/videos/session-42.mp4")).toBeNull();
  });

  it("accepts an HTTP URL", () => {
    expect(validateVideoUrl("http://localhost:3000/uploads/video.mp4")).toBeNull();
  });

  it("accepts an empty string (caller decides on undefined/null preference)", () => {
    expect(validateVideoUrl("")).toBeNull();
  });

  it("rejects a data: URI with a video MIME type", () => {
    const dataUri = "data:video/mp4;base64,AAAA";
    expect(validateVideoUrl(dataUri)).toMatch(/data URI/);
  });

  it("rejects a data: URI with an image MIME type (e.g. accidental frame upload)", () => {
    const dataUri = "data:image/jpeg;base64," + "A".repeat(100);
    expect(validateVideoUrl(dataUri)).toMatch(/data URI/);
  });

  it("rejects a bare base64 string that exceeds the byte cap", () => {
    const oversized = "A".repeat(MAX_VIDEO_URL_BYTES + 1);
    expect(validateVideoUrl(oversized)).toMatch(/bytes or fewer/);
  });

  it("accepts a URL exactly at MAX_VIDEO_URL_BYTES", () => {
    const atLimit = "https://x.com/" + "a".repeat(MAX_VIDEO_URL_BYTES - "https://x.com/".length);
    expect(Buffer.byteLength(atLimit, "utf8")).toBe(MAX_VIDEO_URL_BYTES);
    expect(validateVideoUrl(atLimit)).toBeNull();
  });

  it("rejects a URL one byte over MAX_VIDEO_URL_BYTES", () => {
    const overLimit = "https://x.com/" + "a".repeat(MAX_VIDEO_URL_BYTES - "https://x.com/".length + 1);
    expect(Buffer.byteLength(overLimit, "utf8")).toBe(MAX_VIDEO_URL_BYTES + 1);
    expect(validateVideoUrl(overLimit)).toMatch(/bytes or fewer/);
  });

  it("data: check takes precedence over length check", () => {
    const shortDataUri = "data:video/mp4;base64,short";
    const error = validateVideoUrl(shortDataUri);
    expect(error).toMatch(/data URI/);
    expect(error).not.toMatch(/bytes or fewer/);
  });
});
