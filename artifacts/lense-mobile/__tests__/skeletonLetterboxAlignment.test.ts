/**
 * Skeleton letterbox alignment tests.
 *
 * The WebView `drawSkeleton` function projects MediaPipe landmarks onto a
 * canvas using the same contain-fit (object-fit: contain) math exposed by
 * `containRect` + `projectLandmark` in utils/skeleton:
 *
 *   vAR = VW / VH  (video aspect ratio)
 *   cAR = cW / cH  (canvas aspect ratio)
 *   if (vAR > cAR): vW=cW, vH=cW/vAR, vX=0,          vY=(cH-vH)/2  ← letterboxed
 *   else:           vH=cH, vW=cH*vAR, vX=(cW-vW)/2,   vY=0          ← pillarboxed
 *   screen = { x: vX + lm.x*vW, y: vY + lm.y*vH }
 *
 * These tests guard the four aspect-ratio branches that can cause drift:
 *  • portrait  9:16 video in a landscape 16:9 canvas  (pillarboxed)
 *  • ultra-wide 21:9 video in a landscape 16:9 canvas (letterboxed)
 *  • matching  16:9 video in a landscape 16:9 canvas  (exact fit)
 *  • square    1:1  video in a square canvas           (exact fit)
 *  • portrait  9:16 video in a portrait  9:16 canvas  (exact fit)
 */

import { describe, it, expect } from "vitest";
import { containRect, projectLandmark } from "../utils/skeleton";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Reproduce the WebView's toFull() for the non-person-locked path. */
function project(
  lmX: number,
  lmY: number,
  videoW: number,
  videoH: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const rect = containRect(canvasW, canvasH, videoW / videoH);
  return projectLandmark({ x: lmX, y: lmY }, rect);
}

/** Assert that all four corners of the video rect lie within the canvas. */
function expectVideoRectInsideCanvas(
  videoW: number,
  videoH: number,
  canvasW: number,
  canvasH: number,
) {
  const corners: [number, number][] = [
    [0, 0], [1, 0], [1, 1], [0, 1],
  ];
  for (const [lx, ly] of corners) {
    const pt = project(lx, ly, videoW, videoH, canvasW, canvasH);
    expect(pt.x).toBeGreaterThanOrEqual(0);
    expect(pt.x).toBeLessThanOrEqual(canvasW);
    expect(pt.y).toBeGreaterThanOrEqual(0);
    expect(pt.y).toBeLessThanOrEqual(canvasH);
  }
}

// ─── Portrait 9:16 video in a landscape 16:9 canvas ──────────────────────────
// The video is taller than the canvas is, so it is contain-fit by height and
// pillarboxed (black bars on the left and right).
//
// Canvas 1280×720 (aspect ≈ 1.78), video 360×640 (aspect ≈ 0.56)
// → vH = 720, vW = 720 × (9/16) = 405, vX = (1280−405)/2 = 437.5, vY = 0
describe("portrait 9:16 video in landscape 16:9 canvas (pillarboxed)", () => {
  const [VW, VH, CW, CH] = [360, 640, 1280, 720];

  it("video rect stays fully inside the canvas", () => {
    expectVideoRectInsideCanvas(VW, VH, CW, CH);
  });

  it("center landmark (0.5, 0.5) maps to the canvas center", () => {
    const pt = project(0.5, 0.5, VW, VH, CW, CH);
    expect(pt.x).toBeCloseTo(CW / 2, 1); // 640
    expect(pt.y).toBeCloseTo(CH / 2, 1); // 360
  });

  it("top-left video corner (0, 0) is inset from the left canvas edge (pillar bar present)", () => {
    const pt = project(0, 0, VW, VH, CW, CH);
    // Left black bar occupies 437.5 px; the video doesn't start at x=0.
    expect(pt.x).toBeGreaterThan(0);
    expect(pt.x).toBeGreaterThan(CW * 0.25); // well into the center third
    expect(pt.y).toBeCloseTo(0, 1);           // no top bar
  });

  it("top-right video corner (1, 0) is inset from the right canvas edge (pillar bar present)", () => {
    const pt = project(1, 0, VW, VH, CW, CH);
    expect(pt.x).toBeLessThan(CW);
    expect(pt.x).toBeLessThan(CW * 0.75); // well inside the center third
  });

  it("video fills the full canvas height (no letterbox bars top or bottom)", () => {
    const topEdge    = project(0.5, 0, VW, VH, CW, CH);
    const bottomEdge = project(0.5, 1, VW, VH, CW, CH);
    expect(topEdge.y).toBeCloseTo(0, 1);
    expect(bottomEdge.y).toBeCloseTo(CH, 1);
  });
});

// ─── Ultra-wide 21:9 video in a landscape 16:9 canvas ────────────────────────
// The video is wider than the canvas, so it is contain-fit by width and
// letterboxed (black bars above and below).
//
// Canvas 1280×720 (aspect ≈ 1.78), video 2560×1080 (aspect ≈ 2.37)
// → vW = 1280, vH = 1280 / (21/9) ≈ 548.6, vX = 0, vY = (720−548.6)/2 ≈ 85.7
describe("ultra-wide 21:9 video in landscape 16:9 canvas (letterboxed)", () => {
  const [VW, VH, CW, CH] = [2560, 1080, 1280, 720];

  it("video rect stays fully inside the canvas", () => {
    expectVideoRectInsideCanvas(VW, VH, CW, CH);
  });

  it("center landmark (0.5, 0.5) maps to the canvas center", () => {
    const pt = project(0.5, 0.5, VW, VH, CW, CH);
    expect(pt.x).toBeCloseTo(CW / 2, 1); // 640
    expect(pt.y).toBeCloseTo(CH / 2, 1); // 360
  });

  it("top-left video corner (0, 0) is inset from the top canvas edge (letterbox bar present)", () => {
    const pt = project(0, 0, VW, VH, CW, CH);
    expect(pt.x).toBeCloseTo(0, 1);  // no left bar
    expect(pt.y).toBeGreaterThan(0); // top letterbox bar exists
    expect(pt.y).toBeLessThan(CH * 0.25);
  });

  it("bottom-left video corner (0, 1) is inset from the bottom canvas edge (letterbox bar present)", () => {
    const pt = project(0, 1, VW, VH, CW, CH);
    expect(pt.y).toBeLessThan(CH);
    expect(pt.y).toBeGreaterThan(CH * 0.75);
  });

  it("video fills the full canvas width (no pillar bars left or right)", () => {
    const leftEdge  = project(0, 0.5, VW, VH, CW, CH);
    const rightEdge = project(1, 0.5, VW, VH, CW, CH);
    expect(leftEdge.x).toBeCloseTo(0, 1);
    expect(rightEdge.x).toBeCloseTo(CW, 1);
  });
});

// ─── Standard 16:9 video in a matching 16:9 canvas ───────────────────────────
// Aspect ratios match — the video fills the canvas exactly with no bars.
describe("standard 16:9 video in matching 16:9 canvas (exact fit)", () => {
  const [VW, VH, CW, CH] = [1280, 720, 1280, 720];

  it("video rect stays fully inside the canvas", () => {
    expectVideoRectInsideCanvas(VW, VH, CW, CH);
  });

  it("center landmark (0.5, 0.5) maps to the canvas center", () => {
    const pt = project(0.5, 0.5, VW, VH, CW, CH);
    expect(pt.x).toBeCloseTo(CW / 2, 1);
    expect(pt.y).toBeCloseTo(CH / 2, 1);
  });

  it("top-left video corner maps exactly to the canvas origin (no bars at all)", () => {
    const pt = project(0, 0, VW, VH, CW, CH);
    expect(pt.x).toBeCloseTo(0, 1);
    expect(pt.y).toBeCloseTo(0, 1);
  });

  it("bottom-right video corner maps exactly to the canvas bottom-right", () => {
    const pt = project(1, 1, VW, VH, CW, CH);
    expect(pt.x).toBeCloseTo(CW, 1);
    expect(pt.y).toBeCloseTo(CH, 1);
  });
});

// ─── Square 1:1 video in a square canvas ─────────────────────────────────────
// Both square — no bars, the video fills the canvas exactly.
describe("square 1:1 video in square canvas (exact fit)", () => {
  const [VW, VH, CW, CH] = [640, 640, 720, 720];

  it("video rect stays fully inside the canvas", () => {
    expectVideoRectInsideCanvas(VW, VH, CW, CH);
  });

  it("center landmark (0.5, 0.5) maps to the canvas center", () => {
    const pt = project(0.5, 0.5, VW, VH, CW, CH);
    expect(pt.x).toBeCloseTo(CW / 2, 1);
    expect(pt.y).toBeCloseTo(CH / 2, 1);
  });

  it("all four corners of the video map to the four corners of the canvas", () => {
    expect(project(0, 0, VW, VH, CW, CH)).toEqual({ x: 0, y: 0 });
    expect(project(1, 0, VW, VH, CW, CH)).toEqual({ x: CW, y: 0 });
    expect(project(0, 1, VW, VH, CW, CH)).toEqual({ x: 0, y: CH });
    expect(project(1, 1, VW, VH, CW, CH)).toEqual({ x: CW, y: CH });
  });
});

// ─── Portrait 9:16 video in a matching portrait 9:16 canvas ──────────────────
// The video and canvas share the same aspect ratio — exact fit, no bars.
// This is the typical phone portrait recording viewed in a portrait WebView.
// Canvas 450×800 is exactly 9:16 (0.5625) matching the 360×640 video.
describe("portrait 9:16 video in matching portrait 9:16 canvas (exact fit)", () => {
  const [VW, VH, CW, CH] = [360, 640, 450, 800];

  it("video rect stays fully inside the canvas", () => {
    expectVideoRectInsideCanvas(VW, VH, CW, CH);
  });

  it("center landmark (0.5, 0.5) maps to the canvas center", () => {
    const pt = project(0.5, 0.5, VW, VH, CW, CH);
    expect(pt.x).toBeCloseTo(CW / 2, 0);
    expect(pt.y).toBeCloseTo(CH / 2, 0);
  });

  it("top-left video corner maps to the canvas origin (no bars)", () => {
    const pt = project(0, 0, VW, VH, CW, CH);
    expect(pt.x).toBeCloseTo(0, 1);
    expect(pt.y).toBeCloseTo(0, 1);
  });
});
