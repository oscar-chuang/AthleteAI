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
 *
 * Non-square-pixel (anamorphic) section:
 *  Some devices encode video at one resolution but display it at another,
 *  making the pixel aspect ratio (PAR) ≠ 1.  The pipeline must use the
 *  *display* resolution's aspect ratio for containRect, not the encoded
 *  resolution's aspect ratio.  Failing to do so causes landmark drift that
 *  grows towards the edges of the frame.
 *
 *  Two representative scenarios are covered:
 *  1. Uniform 2× scale    — encoded 480×270, display 960×540  (PAR = 1, AR = 16:9)
 *     Both resolutions share the same AR so no drift is expected even if the
 *     encoded dimensions are mistakenly passed in.  This establishes a baseline.
 *  2. Anamorphic widescreen — encoded 720×576 (5:4), display 1024×576 (16:9)
 *     The encoded AR (1.25) differs from the display AR (1.778).  Using the
 *     encoded AR shifts edge landmarks by ~190 px in a 1280×720 canvas —
 *     a clearly visible joint-drift bug.  Tests confirm the display AR gives
 *     the correct positions and that the encoded AR gives detectably different
 *     (wrong) positions.
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

// ═══════════════════════════════════════════════════════════════════════════════
// Crop-locked (person-selected) projection path
// ═══════════════════════════════════════════════════════════════════════════════
//
// When a person is selected, `drawSkeleton` switches to crop-local landmarks
// and maps them to full-frame-normalised coordinates before projecting:
//
//   fx = (p.x * cropW + cropX0) / VW
//   fy = (p.y * cropH + cropY0) / VH
//
// The resulting (fx, fy) is then projected through the same containRect /
// projectLandmark pipeline as the non-locked path.  This section guards the
// same four aspect-ratio combinations as the full-frame tests above.
//
// Two crop geometries are tested for each aspect ratio:
//   • Centred half-size crop  — cropX0 = VW/4, cropY0 = VH/4, cropW = VW/2, cropH = VH/2
//   • Top-left quarter crop   — cropX0 = 0,    cropY0 = 0,    cropW = VW/2, cropH = VH/2

/** Reproduce the WebView's toFull() for the person-locked crop path. */
function projectCrop(
  lmX: number,
  lmY: number,
  cropX0: number,
  cropY0: number,
  cropW: number,
  cropH: number,
  videoW: number,
  videoH: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const fx = (lmX * cropW + cropX0) / videoW;
  const fy = (lmY * cropH + cropY0) / videoH;
  const rect = containRect(canvasW, canvasH, videoW / videoH);
  return projectLandmark({ x: fx, y: fy }, rect);
}

/** Assert that a point lies inside the video rect (not in the letterbox bars). */
function expectInsideVideoRect(
  pt: { x: number; y: number },
  rect: ReturnType<typeof containRect>,
) {
  expect(pt.x).toBeGreaterThanOrEqual(rect.left - 0.01);
  expect(pt.x).toBeLessThanOrEqual(rect.left + rect.width + 0.01);
  expect(pt.y).toBeGreaterThanOrEqual(rect.top - 0.01);
  expect(pt.y).toBeLessThanOrEqual(rect.top + rect.height + 0.01);
}

// ─── Crop-locked: portrait 9:16 video in landscape 16:9 canvas ───────────────
// Canvas 1280×720 (pillarboxed) — video rect: left≈437.5, top=0, w≈405, h=720
describe("crop-locked: portrait 9:16 video in landscape 16:9 canvas (pillarboxed)", () => {
  const [VW, VH, CW, CH] = [360, 640, 1280, 720];
  const rect = containRect(CW, CH, VW / VH);

  describe("centred half-size crop", () => {
    const [cropX0, cropY0, cropW, cropH] = [VW / 4, VH / 4, VW / 2, VH / 2];

    it("center crop landmark (0.5, 0.5) maps to the canvas center", () => {
      // fx = (0.5*VW/2 + VW/4) / VW = (VW/4 + VW/4) / VW = 0.5
      // fy = same → screen = canvas center
      const pt = projectCrop(0.5, 0.5, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
      expect(pt.x).toBeCloseTo(CW / 2, 1);
      expect(pt.y).toBeCloseTo(CH / 2, 1);
    });

    it("all four crop corners project inside the video rect", () => {
      for (const [lx, ly] of [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]) {
        const pt = projectCrop(lx, ly, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
        expectInsideVideoRect(pt, rect);
      }
    });
  });

  describe("top-left quarter crop", () => {
    const [cropX0, cropY0, cropW, cropH] = [0, 0, VW / 2, VH / 2];

    it("center crop landmark maps to the top-left quadrant of the video rect", () => {
      // fx = (0.5*VW/2 + 0) / VW = 0.25 → screen x = rect.left + 0.25 * rect.width
      const pt = projectCrop(0.5, 0.5, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
      const expectedX = rect.left + 0.25 * rect.width;
      const expectedY = rect.top + 0.25 * rect.height;
      expect(pt.x).toBeCloseTo(expectedX, 1);
      expect(pt.y).toBeCloseTo(expectedY, 1);
    });

    it("top-left crop corner (0, 0) maps to the video rect origin", () => {
      const pt = projectCrop(0, 0, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
      expect(pt.x).toBeCloseTo(rect.left, 1);
      expect(pt.y).toBeCloseTo(rect.top, 1);
    });

    it("all four crop corners project inside the video rect", () => {
      for (const [lx, ly] of [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]) {
        const pt = projectCrop(lx, ly, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
        expectInsideVideoRect(pt, rect);
      }
    });
  });
});

// ─── Crop-locked: ultra-wide 21:9 video in landscape 16:9 canvas ─────────────
// Canvas 1280×720 (letterboxed) — video rect: left=0, top≈85.7, w=1280, h≈548.6
describe("crop-locked: ultra-wide 21:9 video in landscape 16:9 canvas (letterboxed)", () => {
  const [VW, VH, CW, CH] = [2560, 1080, 1280, 720];
  const rect = containRect(CW, CH, VW / VH);

  describe("centred half-size crop", () => {
    const [cropX0, cropY0, cropW, cropH] = [VW / 4, VH / 4, VW / 2, VH / 2];

    it("center crop landmark (0.5, 0.5) maps to the canvas center", () => {
      const pt = projectCrop(0.5, 0.5, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
      expect(pt.x).toBeCloseTo(CW / 2, 1);
      expect(pt.y).toBeCloseTo(CH / 2, 1);
    });

    it("all four crop corners project inside the video rect", () => {
      for (const [lx, ly] of [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]) {
        const pt = projectCrop(lx, ly, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
        expectInsideVideoRect(pt, rect);
      }
    });
  });

  describe("top-left quarter crop", () => {
    const [cropX0, cropY0, cropW, cropH] = [0, 0, VW / 2, VH / 2];

    it("center crop landmark maps to the top-left quadrant of the video rect", () => {
      const pt = projectCrop(0.5, 0.5, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
      const expectedX = rect.left + 0.25 * rect.width;
      const expectedY = rect.top + 0.25 * rect.height;
      expect(pt.x).toBeCloseTo(expectedX, 1);
      expect(pt.y).toBeCloseTo(expectedY, 1);
    });

    it("top-left crop corner (0, 0) maps to the video rect origin", () => {
      const pt = projectCrop(0, 0, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
      expect(pt.x).toBeCloseTo(rect.left, 1);
      expect(pt.y).toBeCloseTo(rect.top, 1);
    });

    it("all four crop corners project inside the video rect", () => {
      for (const [lx, ly] of [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]) {
        const pt = projectCrop(lx, ly, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
        expectInsideVideoRect(pt, rect);
      }
    });
  });
});

// ─── Crop-locked: standard 16:9 video in matching 16:9 canvas ────────────────
// Aspect ratios match — exact fit, no bars. video rect = full canvas.
describe("crop-locked: standard 16:9 video in matching 16:9 canvas (exact fit)", () => {
  const [VW, VH, CW, CH] = [1280, 720, 1280, 720];
  const rect = containRect(CW, CH, VW / VH);

  describe("centred half-size crop", () => {
    const [cropX0, cropY0, cropW, cropH] = [VW / 4, VH / 4, VW / 2, VH / 2];

    it("center crop landmark (0.5, 0.5) maps to the canvas center", () => {
      const pt = projectCrop(0.5, 0.5, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
      expect(pt.x).toBeCloseTo(CW / 2, 1);
      expect(pt.y).toBeCloseTo(CH / 2, 1);
    });

    it("all four crop corners project inside the video rect", () => {
      for (const [lx, ly] of [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]) {
        const pt = projectCrop(lx, ly, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
        expectInsideVideoRect(pt, rect);
      }
    });
  });

  describe("top-left quarter crop", () => {
    const [cropX0, cropY0, cropW, cropH] = [0, 0, VW / 2, VH / 2];

    it("top-left crop corner (0, 0) maps to the canvas origin (no bars)", () => {
      const pt = projectCrop(0, 0, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
      expect(pt.x).toBeCloseTo(0, 1);
      expect(pt.y).toBeCloseTo(0, 1);
    });

    it("bottom-right crop corner (1, 1) maps to the canvas center", () => {
      // fx = (1*VW/2 + 0)/VW = 0.5 → x = CW/2; fy same → y = CH/2
      const pt = projectCrop(1, 1, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
      expect(pt.x).toBeCloseTo(CW / 2, 1);
      expect(pt.y).toBeCloseTo(CH / 2, 1);
    });

    it("all four crop corners project inside the video rect", () => {
      for (const [lx, ly] of [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]) {
        const pt = projectCrop(lx, ly, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
        expectInsideVideoRect(pt, rect);
      }
    });
  });
});

// ─── Crop-locked: square 1:1 video in a square canvas ────────────────────────
// Both square — exact fit, no bars.
describe("crop-locked: square 1:1 video in square canvas (exact fit)", () => {
  const [VW, VH, CW, CH] = [640, 640, 720, 720];
  const rect = containRect(CW, CH, VW / VH);

  describe("centred half-size crop", () => {
    const [cropX0, cropY0, cropW, cropH] = [VW / 4, VH / 4, VW / 2, VH / 2];

    it("center crop landmark (0.5, 0.5) maps to the canvas center", () => {
      const pt = projectCrop(0.5, 0.5, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
      expect(pt.x).toBeCloseTo(CW / 2, 1);
      expect(pt.y).toBeCloseTo(CH / 2, 1);
    });

    it("all four crop corners project inside the video rect", () => {
      for (const [lx, ly] of [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]) {
        const pt = projectCrop(lx, ly, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
        expectInsideVideoRect(pt, rect);
      }
    });
  });

  describe("top-left quarter crop", () => {
    const [cropX0, cropY0, cropW, cropH] = [0, 0, VW / 2, VH / 2];

    it("top-left crop corner (0, 0) maps to the canvas origin", () => {
      const pt = projectCrop(0, 0, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
      expect(pt.x).toBeCloseTo(0, 1);
      expect(pt.y).toBeCloseTo(0, 1);
    });

    it("bottom-right crop corner (1, 1) maps to the canvas center", () => {
      const pt = projectCrop(1, 1, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
      expect(pt.x).toBeCloseTo(CW / 2, 1);
      expect(pt.y).toBeCloseTo(CH / 2, 1);
    });

    it("all four crop corners project inside the video rect", () => {
      for (const [lx, ly] of [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]) {
        const pt = projectCrop(lx, ly, cropX0, cropY0, cropW, cropH, VW, VH, CW, CH);
        expectInsideVideoRect(pt, rect);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Non-square-pixel (anamorphic) projection — display AR must drive containRect
// ═══════════════════════════════════════════════════════════════════════════════
//
// Some devices encode at one resolution but display at another, making the
// pixel aspect ratio (PAR) ≠ 1.  The landmark coordinate space is defined by
// the *encoded* frame (MediaPipe scans those pixels), but containRect must
// receive the *display* aspect ratio so the overlay aligns with what the user
// sees.
//
// Helper that accepts explicit display dimensions separately from encoded ones.
// `displayW / displayH` is passed to containRect; landmarks are in [0,1]×[0,1]
// of the encoded frame, which is identical to [0,1]×[0,1] of the display frame
// (they share the same normalised landmark space).

function projectNSP(
  lmX: number,
  lmY: number,
  displayW: number,
  displayH: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const rect = containRect(canvasW, canvasH, displayW / displayH);
  return projectLandmark({ x: lmX, y: lmY }, rect);
}

function projectNSPCrop(
  lmX: number,
  lmY: number,
  cropX0: number,
  cropY0: number,
  cropW: number,
  cropH: number,
  encodedW: number,
  encodedH: number,
  displayW: number,
  displayH: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const fx = (lmX * cropW + cropX0) / encodedW;
  const fy = (lmY * cropH + cropY0) / encodedH;
  const rect = containRect(canvasW, canvasH, displayW / displayH);
  return projectLandmark({ x: fx, y: fy }, rect);
}

// ─── Scenario 1: Uniform 2× scale (PAR = 1, AR unchanged) ────────────────────
// Encoded 480×270 displayed as 960×540 — both are 16:9.  No drift is expected
// regardless of which resolution is used, because the AR is identical.  This
// acts as a sanity baseline for the non-square-pixel helper.
//
// Canvas 1280×720 (16:9) → exact fit, no bars.
describe("non-square-pixel: uniform 2× scale (encoded 480×270, display 960×540)", () => {
  const [EW, EH] = [480, 270];   // encoded
  const [DW, DH] = [960, 540];   // display
  const [CW, CH] = [1280, 720];  // canvas

  it("center landmark (0.5, 0.5) maps to the canvas center", () => {
    const pt = projectNSP(0.5, 0.5, DW, DH, CW, CH);
    expect(pt.x).toBeCloseTo(CW / 2, 1);
    expect(pt.y).toBeCloseTo(CH / 2, 1);
  });

  it("top-left landmark (0, 0) maps to the canvas origin (exact fit, no bars)", () => {
    const pt = projectNSP(0, 0, DW, DH, CW, CH);
    expect(pt.x).toBeCloseTo(0, 1);
    expect(pt.y).toBeCloseTo(0, 1);
  });

  it("bottom-right landmark (1, 1) maps to the canvas bottom-right", () => {
    const pt = projectNSP(1, 1, DW, DH, CW, CH);
    expect(pt.x).toBeCloseTo(CW, 1);
    expect(pt.y).toBeCloseTo(CH, 1);
  });

  it("all four frame corners stay inside the canvas", () => {
    for (const [lx, ly] of [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]) {
      const pt = projectNSP(lx, ly, DW, DH, CW, CH);
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThanOrEqual(CW);
      expect(pt.y).toBeGreaterThanOrEqual(0);
      expect(pt.y).toBeLessThanOrEqual(CH);
    }
  });

  it("using display AR and encoded AR produces identical results (same 16:9 ratio)", () => {
    // Because PAR = 1 here, both paths give the same answer.
    // This documents the contract: when AR is unchanged by scaling, it is safe
    // to pass either dimension pair — but only because the ratio is identical.
    const ptDisplay  = projectNSP(0.75, 0.25, DW, DH, CW, CH);
    const ptEncoded  = projectNSP(0.75, 0.25, EW, EH, CW, CH);
    expect(ptDisplay.x).toBeCloseTo(ptEncoded.x, 1);
    expect(ptDisplay.y).toBeCloseTo(ptEncoded.y, 1);
  });

  describe("crop-locked: centred half-size crop in encoded space", () => {
    // crop covers the centre quarter of the encoded frame
    const [cropX0, cropY0, cropW, cropH] = [EW / 4, EH / 4, EW / 2, EH / 2];
    const rect = containRect(CW, CH, DW / DH);

    it("center crop landmark (0.5, 0.5) maps to the canvas center", () => {
      // fx = (0.5*EW/2 + EW/4)/EW = 0.5, fy = 0.5 → canvas center
      const pt = projectNSPCrop(0.5, 0.5, cropX0, cropY0, cropW, cropH, EW, EH, DW, DH, CW, CH);
      expect(pt.x).toBeCloseTo(CW / 2, 1);
      expect(pt.y).toBeCloseTo(CH / 2, 1);
    });

    it("all four crop corners project inside the video rect", () => {
      for (const [lx, ly] of [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]) {
        const pt = projectNSPCrop(lx, ly, cropX0, cropY0, cropW, cropH, EW, EH, DW, DH, CW, CH);
        expectInsideVideoRect(pt, rect);
      }
    });
  });
});

// ─── Scenario 2: Anamorphic widescreen (PAR ≠ 1, AR changes) ─────────────────
// Encoded 720×576 (PAL DVB 5:4, AR ≈ 1.25) displayed as 1024×576 (16:9, AR ≈ 1.778).
// Canvas 1280×720 (16:9).
//
// With the correct display AR the video is an exact fit in the canvas (no bars).
// With the wrong encoded AR the video is pillarboxed (vX ≈ 190, vW ≈ 900), and
// landmarks near the horizontal edges drift by ≈ 190 px — clearly visible drift.
//
// Concrete geometry for the wrong-AR path:
//   containRect(1280, 720, 720/576=1.25) → pillarboxed:
//     vH=720, vW=720*1.25=900, vX=(1280-900)/2=190, vY=0
//   top-right corner (1, 0) → x = 190 + 1*900 = 1090  (correct: 1280)  drift = 190
//   top-left corner  (0, 0) → x = 190 + 0*900 = 190   (correct:    0)  drift = 190
describe("non-square-pixel: anamorphic widescreen (encoded 720×576 5:4, display 1024×576 16:9)", () => {
  const [EW, EH] = [720, 576];   // encoded (PAL DVB, 5:4)
  const [DW, DH] = [1024, 576];  // display (16:9 after PAR correction)
  const [CW, CH] = [1280, 720];  // canvas (16:9)

  // ── Full-frame (non-locked) path ──────────────────────────────────────────

  it("center landmark (0.5, 0.5) maps to the canvas center with display AR", () => {
    const pt = projectNSP(0.5, 0.5, DW, DH, CW, CH);
    expect(pt.x).toBeCloseTo(CW / 2, 1);
    expect(pt.y).toBeCloseTo(CH / 2, 1);
  });

  it("top-left landmark (0, 0) maps to the canvas origin with display AR (exact fit)", () => {
    // Display AR = 16:9 → exact fit in 16:9 canvas → no bars → corner = (0, 0)
    const pt = projectNSP(0, 0, DW, DH, CW, CH);
    expect(pt.x).toBeCloseTo(0, 1);
    expect(pt.y).toBeCloseTo(0, 1);
  });

  it("top-right landmark (1, 0) maps to the canvas top-right with display AR", () => {
    const pt = projectNSP(1, 0, DW, DH, CW, CH);
    expect(pt.x).toBeCloseTo(CW, 1);
    expect(pt.y).toBeCloseTo(0, 1);
  });

  it("all four frame corners stay inside the canvas with display AR", () => {
    for (const [lx, ly] of [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]) {
      const pt = projectNSP(lx, ly, DW, DH, CW, CH);
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThanOrEqual(CW);
      expect(pt.y).toBeGreaterThanOrEqual(0);
      expect(pt.y).toBeLessThanOrEqual(CH);
    }
  });

  it("using encoded AR (5:4) instead of display AR (16:9) causes measurable edge drift", () => {
    // This test deliberately exercises the WRONG path to prove the drift is real.
    // A joint at the top-right of the frame should sit at canvas x=1280, but the
    // encoded-AR path places it at x≈1090 — a drift of ~190 px.
    const ptCorrect = projectNSP(1, 0, DW, DH, CW, CH); // display AR → correct
    const ptWrong   = projectNSP(1, 0, EW, EH, CW, CH); // encoded AR → wrong (pillarboxed)
    // The correct position is at the canvas right edge (x=1280).
    expect(ptCorrect.x).toBeCloseTo(CW, 0);
    // The wrong position is visibly inset (pillar bar pushes everything inward).
    expect(ptWrong.x).toBeLessThan(CW - 100);
    // The drift itself is significant (≈190 px for this geometry).
    expect(ptCorrect.x - ptWrong.x).toBeGreaterThan(100);
  });

  it("encoded-AR path also drifts the top-left corner inward", () => {
    // Left edge: encoded AR pillarboxes with vX≈190; display AR is exact fit (vX=0).
    const ptCorrect = projectNSP(0, 0, DW, DH, CW, CH);
    const ptWrong   = projectNSP(0, 0, EW, EH, CW, CH);
    expect(ptCorrect.x).toBeCloseTo(0, 0);
    expect(ptWrong.x).toBeGreaterThan(100);
    expect(ptWrong.x - ptCorrect.x).toBeGreaterThan(100);
  });

  // ── Crop-locked path ──────────────────────────────────────────────────────

  describe("crop-locked: centred half-size crop in encoded space", () => {
    // Crop covers the central quarter of the encoded (720×576) frame.
    const [cropX0, cropY0, cropW, cropH] = [EW / 4, EH / 4, EW / 2, EH / 2];
    const rect = containRect(CW, CH, DW / DH); // rect uses display AR

    it("center crop landmark (0.5, 0.5) maps to the canvas center", () => {
      // fx = (0.5*EW/2 + EW/4)/EW = 0.5, fy = 0.5 → canvas centre regardless of PAR
      const pt = projectNSPCrop(0.5, 0.5, cropX0, cropY0, cropW, cropH, EW, EH, DW, DH, CW, CH);
      expect(pt.x).toBeCloseTo(CW / 2, 1);
      expect(pt.y).toBeCloseTo(CH / 2, 1);
    });

    it("all four crop corners project inside the video rect", () => {
      for (const [lx, ly] of [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]) {
        const pt = projectNSPCrop(lx, ly, cropX0, cropY0, cropW, cropH, EW, EH, DW, DH, CW, CH);
        expectInsideVideoRect(pt, rect);
      }
    });

    it("top-right crop corner projects inside the video rect (not into a pillar bar)", () => {
      // With the correct display AR the canvas is an exact fit (no bars), so the
      // entire canvas IS the video rect and any point is trivially inside.
      // This also verifies the crop path does not accidentally introduce a bar offset.
      const pt = projectNSPCrop(1, 0, cropX0, cropY0, cropW, cropH, EW, EH, DW, DH, CW, CH);
      expectInsideVideoRect(pt, rect);
    });
  });

  describe("crop-locked: top-left quarter crop in encoded space", () => {
    const [cropX0, cropY0, cropW, cropH] = [0, 0, EW / 2, EH / 2];
    const rect = containRect(CW, CH, DW / DH);

    it("top-left crop corner (0, 0) maps to the video rect origin", () => {
      // fx = 0/EW = 0, fy = 0/EH = 0 → top-left of video rect
      const pt = projectNSPCrop(0, 0, cropX0, cropY0, cropW, cropH, EW, EH, DW, DH, CW, CH);
      expect(pt.x).toBeCloseTo(rect.left, 1);
      expect(pt.y).toBeCloseTo(rect.top, 1);
    });

    it("center crop landmark maps to the top-left quadrant of the video rect", () => {
      // fx = (0.5*EW/2)/EW = 0.25, fy = 0.25
      const pt = projectNSPCrop(0.5, 0.5, cropX0, cropY0, cropW, cropH, EW, EH, DW, DH, CW, CH);
      const expectedX = rect.left + 0.25 * rect.width;
      const expectedY = rect.top + 0.25 * rect.height;
      expect(pt.x).toBeCloseTo(expectedX, 1);
      expect(pt.y).toBeCloseTo(expectedY, 1);
    });

    it("all four crop corners project inside the video rect", () => {
      for (const [lx, ly] of [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]) {
        const pt = projectNSPCrop(lx, ly, cropX0, cropY0, cropW, cropH, EW, EH, DW, DH, CW, CH);
        expectInsideVideoRect(pt, rect);
      }
    });
  });
});
