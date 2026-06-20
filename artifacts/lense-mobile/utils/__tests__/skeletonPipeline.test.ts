import { describe, it, expect } from "vitest";
import { projectLandmark, containRect } from "../skeleton";

// ─── Math replicated from the WebView HTML in skeleton/[id].tsx ──────────────
//
// paddedBounds and lmRemapped cannot be imported from the source because they
// live inside a template-literal HTML string fed to a WebView.  The math is
// replicated here verbatim — the primary source of truth is still:
//   artifacts/lense-mobile/app/analysis/skeleton/[id].tsx  (paddedBounds ~220,
//                                                            lmRemapped    ~243)

interface RawLandmark { x: number; y: number; visibility?: number }
interface RemappedLandmark { x: number; y: number; v: number }
interface Crop { cropX0: number; cropY0: number; cropW: number; cropH: number }
interface VideoDims { W: number; H: number }

function paddedBounds(
  crop: Crop,
  video: VideoDims,
): { sx: number; sy: number; sw: number; sh: number } {
  const { cropX0, cropY0, cropW, cropH } = crop;
  const { W, H } = video;
  const px = cropW * 0.15;
  const py = cropH * 0.15;
  const sx = Math.max(0, cropX0 - px);
  const sy = Math.max(0, cropY0 - py);
  const ex = Math.min(W, cropX0 + cropW + px);
  const ey = Math.min(H, cropY0 + cropH + py);
  return { sx, sy, sw: Math.max(1, ex - sx), sh: Math.max(1, ey - sy) };
}

function lmRemapped(
  rawLm: RawLandmark[],
  crop: Crop,
  video: VideoDims,
): RemappedLandmark[] {
  const { cropX0, cropY0, cropW, cropH } = crop;
  const { sx, sy, sw, sh } = paddedBounds(crop, video);
  return rawLm.map((p) => ({
    x: +((p.x * cropW + cropX0 - sx) / sw).toFixed(4),
    y: +((p.y * cropH + cropY0 - sy) / sh).toFixed(4),
    v: +(p.visibility ?? 0).toFixed(3),
  }));
}

// ─── Realistic 33-landmark skeleton for a 16:9 video ─────────────────────────
//
// MediaPipe Pose emits 33 landmarks in crop-local normalised coords (0..1).
// These approximate a standing athlete roughly centred in the crop.
// Values are deliberately chosen to exercise the full [0, 1] spread so that any
// remapping error that pushes coords outside that range will be caught.

const REALISTIC_LANDMARKS_33: RawLandmark[] = [
  // head / face cluster (landmarks 0–10)
  { x: 0.50, y: 0.05, visibility: 0.99 }, // 0  nose
  { x: 0.52, y: 0.04, visibility: 0.98 }, // 1  left eye inner
  { x: 0.54, y: 0.04, visibility: 0.97 }, // 2  left eye
  { x: 0.56, y: 0.04, visibility: 0.96 }, // 3  left eye outer
  { x: 0.48, y: 0.04, visibility: 0.98 }, // 4  right eye inner
  { x: 0.46, y: 0.04, visibility: 0.97 }, // 5  right eye
  { x: 0.44, y: 0.04, visibility: 0.96 }, // 6  right eye outer
  { x: 0.55, y: 0.06, visibility: 0.95 }, // 7  left ear
  { x: 0.45, y: 0.06, visibility: 0.95 }, // 8  right ear
  { x: 0.52, y: 0.07, visibility: 0.93 }, // 9  mouth left
  { x: 0.48, y: 0.07, visibility: 0.93 }, // 10 mouth right
  // shoulders (11–12)
  { x: 0.62, y: 0.22, visibility: 0.97 }, // 11 left shoulder
  { x: 0.38, y: 0.22, visibility: 0.97 }, // 12 right shoulder
  // elbows (13–14)
  { x: 0.70, y: 0.42, visibility: 0.94 }, // 13 left elbow
  { x: 0.30, y: 0.42, visibility: 0.94 }, // 14 right elbow
  // wrists (15–16)
  { x: 0.72, y: 0.60, visibility: 0.90 }, // 15 left wrist
  { x: 0.28, y: 0.60, visibility: 0.90 }, // 16 right wrist
  // pinky/index/thumb clusters (17–22)
  { x: 0.74, y: 0.62, visibility: 0.75 }, // 17 left pinky
  { x: 0.26, y: 0.62, visibility: 0.75 }, // 18 right pinky
  { x: 0.73, y: 0.63, visibility: 0.76 }, // 19 left index
  { x: 0.27, y: 0.63, visibility: 0.76 }, // 20 right index
  { x: 0.71, y: 0.61, visibility: 0.72 }, // 21 left thumb
  { x: 0.29, y: 0.61, visibility: 0.72 }, // 22 right thumb
  // hips (23–24)
  { x: 0.58, y: 0.58, visibility: 0.96 }, // 23 left hip
  { x: 0.42, y: 0.58, visibility: 0.96 }, // 24 right hip
  // knees (25–26)
  { x: 0.60, y: 0.76, visibility: 0.95 }, // 25 left knee
  { x: 0.40, y: 0.76, visibility: 0.95 }, // 26 right knee
  // ankles (27–28)
  { x: 0.61, y: 0.93, visibility: 0.92 }, // 27 left ankle
  { x: 0.39, y: 0.93, visibility: 0.92 }, // 28 right ankle
  // heels (29–30)
  { x: 0.60, y: 0.96, visibility: 0.88 }, // 29 left heel
  { x: 0.40, y: 0.96, visibility: 0.88 }, // 30 right heel
  // foot index (31–32)
  { x: 0.62, y: 0.98, visibility: 0.85 }, // 31 left foot index
  { x: 0.38, y: 0.98, visibility: 0.85 }, // 32 right foot index
];

// ─── Helper: run the full pipeline and assert all landmarks land on-screen ────

/**
 * Runs:
 *   rawLm  →  lmRemapped  →  projectLandmark(lm, containRect(…))
 *
 * and asserts that every pixel is within the display rectangle.
 *
 * @param displayW  Width of the phone display box in dp
 * @param displayH  Height of the phone display box in dp
 */
function assertAllLandmarksOnScreen(
  rawLm: RawLandmark[],
  crop: Crop,
  video: VideoDims,
  displayW: number,
  displayH: number,
) {
  // Step 1 – remap landmarks from crop-local to padded-local coords
  const remapped = lmRemapped(rawLm, crop, video);

  // Step 2 – derive the capture aspect ratio (padded crop image's w/h)
  const { sw, sh } = paddedBounds(crop, video);
  const captureAspect = sw / sh;

  // Step 3 – compute the letterboxed rect that contains the image on the screen
  const rect = containRect(displayW, displayH, captureAspect);

  // Step 4 – project every landmark and check it falls inside the rect
  for (let i = 0; i < remapped.length; i++) {
    const lm = remapped[i];
    const pt = projectLandmark(lm, rect);

    expect(
      pt.x,
      `landmark ${i}: x=${pt.x.toFixed(2)} should be >= rect.left=${rect.left.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(rect.left - Number.EPSILON);

    expect(
      pt.x,
      `landmark ${i}: x=${pt.x.toFixed(2)} should be <= rect.left+rect.width=${(rect.left + rect.width).toFixed(2)}`,
    ).toBeLessThanOrEqual(rect.left + rect.width + Number.EPSILON);

    expect(
      pt.y,
      `landmark ${i}: y=${pt.y.toFixed(2)} should be >= rect.top=${rect.top.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(rect.top - Number.EPSILON);

    expect(
      pt.y,
      `landmark ${i}: y=${pt.y.toFixed(2)} should be <= rect.top+rect.height=${(rect.top + rect.height).toFixed(2)}`,
    ).toBeLessThanOrEqual(rect.top + rect.height + Number.EPSILON);
  }
}

// ─── 16:9 video (1280 × 720) — three crop positions ─────────────────────────

const VIDEO_16_9: VideoDims = { W: 1280, H: 720 };

// Display dimensions for a typical phone screen (portrait)
const DISPLAY_W = 390;
const DISPLAY_H = 844;

describe("skeleton pipeline integration — 16:9 video, centred crop", () => {
  // Crop sits well inside the video frame — padding applies on all four sides.
  const CENTRED_CROP: Crop = { cropX0: 300, cropY0: 80, cropW: 680, cropH: 560 };

  it("all 33 landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      REALISTIC_LANDMARKS_33,
      CENTRED_CROP,
      VIDEO_16_9,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("remapped x coords are in [0, 1] for all landmarks", () => {
    const remapped = lmRemapped(REALISTIC_LANDMARKS_33, CENTRED_CROP, VIDEO_16_9);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
    }
  });

  it("remapped y coords are in [0, 1] for all landmarks", () => {
    const remapped = lmRemapped(REALISTIC_LANDMARKS_33, CENTRED_CROP, VIDEO_16_9);
    for (const lm of remapped) {
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });

  it("containRect for padded aspect fits inside the display box", () => {
    const { sw, sh } = paddedBounds(CENTRED_CROP, VIDEO_16_9);
    const rect = containRect(DISPLAY_W, DISPLAY_H, sw / sh);
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.left + rect.width).toBeLessThanOrEqual(DISPLAY_W + Number.EPSILON);
    expect(rect.top + rect.height).toBeLessThanOrEqual(DISPLAY_H + Number.EPSILON);
  });
});

describe("skeleton pipeline integration — 16:9 video, left-edge crop", () => {
  // Crop touches the left and top edges — padding is clamped on those sides.
  const LEFT_EDGE_CROP: Crop = { cropX0: 0, cropY0: 0, cropW: 500, cropH: 480 };

  it("all 33 landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      REALISTIC_LANDMARKS_33,
      LEFT_EDGE_CROP,
      VIDEO_16_9,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("sx and sy are clamped to 0", () => {
    const { sx, sy } = paddedBounds(LEFT_EDGE_CROP, VIDEO_16_9);
    expect(sx).toBe(0);
    expect(sy).toBe(0);
  });

  it("remapped coords remain in [0, 1] despite clamped padding", () => {
    const remapped = lmRemapped(REALISTIC_LANDMARKS_33, LEFT_EDGE_CROP, VIDEO_16_9);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("skeleton pipeline integration — 16:9 video, right-edge crop", () => {
  // Crop is flush with the right and bottom edges — padding is clamped there.
  const RIGHT_EDGE_CROP: Crop = { cropX0: 780, cropY0: 240, cropW: 500, cropH: 480 };

  it("all 33 landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      REALISTIC_LANDMARKS_33,
      RIGHT_EDGE_CROP,
      VIDEO_16_9,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("ex and ey are clamped to video dimensions", () => {
    const { sx, sy, sw, sh } = paddedBounds(RIGHT_EDGE_CROP, VIDEO_16_9);
    expect(sx + sw).toBeLessThanOrEqual(VIDEO_16_9.W);
    expect(sy + sh).toBeLessThanOrEqual(VIDEO_16_9.H);
  });

  it("remapped coords remain in [0, 1] despite clamped padding", () => {
    const remapped = lmRemapped(REALISTIC_LANDMARKS_33, RIGHT_EDGE_CROP, VIDEO_16_9);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });
});

// ─── 9:16 portrait video (720 × 1280) — three crop positions ─────────────────
//
// Portrait-shot footage is the most common source of skeleton drift: the video
// is taller than it is wide, which inverts the normal letterbox direction and
// can expose any axis confusion in containRect / projectLandmark.

const VIDEO_9_16: VideoDims = { W: 720, H: 1280 };

describe("skeleton pipeline integration — 9:16 portrait video, centred crop", () => {
  // Crop sits well inside the video frame — padding applies on all four sides.
  const CENTRED_CROP: Crop = { cropX0: 80, cropY0: 200, cropW: 560, cropH: 880 };

  it("all 33 landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      REALISTIC_LANDMARKS_33,
      CENTRED_CROP,
      VIDEO_9_16,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("remapped coords are in [0, 1] for all landmarks", () => {
    const remapped = lmRemapped(REALISTIC_LANDMARKS_33, CENTRED_CROP, VIDEO_9_16);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });

  it("containRect for padded aspect fits inside the display box", () => {
    const { sw, sh } = paddedBounds(CENTRED_CROP, VIDEO_9_16);
    const rect = containRect(DISPLAY_W, DISPLAY_H, sw / sh);
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.left + rect.width).toBeLessThanOrEqual(DISPLAY_W + Number.EPSILON);
    expect(rect.top + rect.height).toBeLessThanOrEqual(DISPLAY_H + Number.EPSILON);
  });
});

describe("skeleton pipeline integration — 9:16 portrait video, left-edge crop", () => {
  // Crop touches the left and top edges — padding is clamped on those sides.
  const LEFT_EDGE_CROP: Crop = { cropX0: 0, cropY0: 0, cropW: 400, cropH: 700 };

  it("all 33 landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      REALISTIC_LANDMARKS_33,
      LEFT_EDGE_CROP,
      VIDEO_9_16,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("sx and sy are clamped to 0", () => {
    const { sx, sy } = paddedBounds(LEFT_EDGE_CROP, VIDEO_9_16);
    expect(sx).toBe(0);
    expect(sy).toBe(0);
  });

  it("remapped coords remain in [0, 1] despite clamped padding", () => {
    const remapped = lmRemapped(REALISTIC_LANDMARKS_33, LEFT_EDGE_CROP, VIDEO_9_16);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("skeleton pipeline integration — 9:16 portrait video, right-edge crop", () => {
  // Crop is flush with the right and bottom edges — padding is clamped there.
  const RIGHT_EDGE_CROP: Crop = { cropX0: 320, cropY0: 580, cropW: 400, cropH: 700 };

  it("all 33 landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      REALISTIC_LANDMARKS_33,
      RIGHT_EDGE_CROP,
      VIDEO_9_16,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("ex and ey are clamped to video dimensions", () => {
    const { sx, sy, sw, sh } = paddedBounds(RIGHT_EDGE_CROP, VIDEO_9_16);
    expect(sx + sw).toBeLessThanOrEqual(VIDEO_9_16.W);
    expect(sy + sh).toBeLessThanOrEqual(VIDEO_9_16.H);
  });

  it("remapped coords remain in [0, 1] despite clamped padding", () => {
    const remapped = lmRemapped(REALISTIC_LANDMARKS_33, RIGHT_EDGE_CROP, VIDEO_9_16);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });
});

// ─── 21:9 ultra-wide video (2560 × 1080) — three crop positions ──────────────
//
// Sports broadcast clips and cinema-format recordings are often 21:9. The crop
// region covers a narrow vertical band of a very wide frame, producing a capture
// aspect that is drastically different from a standard phone display and is a
// common source of vertical skeleton drift.

const VIDEO_21_9: VideoDims = { W: 2560, H: 1080 };

describe("skeleton pipeline integration — 21:9 ultra-wide video, centred crop", () => {
  // Crop centred in the wide frame — plenty of padding on all sides.
  const CENTRED_CROP: Crop = { cropX0: 800, cropY0: 100, cropW: 960, cropH: 880 };

  it("all 33 landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      REALISTIC_LANDMARKS_33,
      CENTRED_CROP,
      VIDEO_21_9,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("remapped coords are in [0, 1] for all landmarks", () => {
    const remapped = lmRemapped(REALISTIC_LANDMARKS_33, CENTRED_CROP, VIDEO_21_9);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });

  it("containRect for padded aspect fits inside the display box", () => {
    const { sw, sh } = paddedBounds(CENTRED_CROP, VIDEO_21_9);
    const rect = containRect(DISPLAY_W, DISPLAY_H, sw / sh);
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.left + rect.width).toBeLessThanOrEqual(DISPLAY_W + Number.EPSILON);
    expect(rect.top + rect.height).toBeLessThanOrEqual(DISPLAY_H + Number.EPSILON);
  });
});

describe("skeleton pipeline integration — 21:9 ultra-wide video, left-edge crop", () => {
  // Crop starts at x=0, y=0 — padding clamped on both leading edges.
  const LEFT_EDGE_CROP: Crop = { cropX0: 0, cropY0: 0, cropW: 700, cropH: 800 };

  it("all 33 landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      REALISTIC_LANDMARKS_33,
      LEFT_EDGE_CROP,
      VIDEO_21_9,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("sx and sy are clamped to 0", () => {
    const { sx, sy } = paddedBounds(LEFT_EDGE_CROP, VIDEO_21_9);
    expect(sx).toBe(0);
    expect(sy).toBe(0);
  });

  it("remapped coords remain in [0, 1] despite clamped padding", () => {
    const remapped = lmRemapped(REALISTIC_LANDMARKS_33, LEFT_EDGE_CROP, VIDEO_21_9);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("skeleton pipeline integration — 21:9 ultra-wide video, right-edge crop", () => {
  // Crop is flush with the right and bottom edges — padding clamped there.
  const RIGHT_EDGE_CROP: Crop = { cropX0: 1860, cropY0: 280, cropW: 700, cropH: 800 };

  it("all 33 landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      REALISTIC_LANDMARKS_33,
      RIGHT_EDGE_CROP,
      VIDEO_21_9,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("ex and ey are clamped to video dimensions", () => {
    const { sx, sy, sw, sh } = paddedBounds(RIGHT_EDGE_CROP, VIDEO_21_9);
    expect(sx + sw).toBeLessThanOrEqual(VIDEO_21_9.W);
    expect(sy + sh).toBeLessThanOrEqual(VIDEO_21_9.H);
  });

  it("remapped coords remain in [0, 1] despite clamped padding", () => {
    const remapped = lmRemapped(REALISTIC_LANDMARKS_33, RIGHT_EDGE_CROP, VIDEO_21_9);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });
});

// ─── Edge-position landmark sets ─────────────────────────────────────────────
//
// Each set simulates an athlete who is standing very close to one corner of the
// crop region.  All coords are pushed toward the extreme (0 or 1) while still
// forming a plausible standing pose — the pipeline must keep every projected
// pixel within the display rect regardless of how close to the boundary the
// landmarks sit.

/** Athlete crammed into the top-left corner of the crop (low x, low y). */
const EDGE_LANDMARKS_TOP_LEFT: RawLandmark[] = [
  { x: 0.02, y: 0.01, visibility: 0.99 }, // 0  nose
  { x: 0.03, y: 0.01, visibility: 0.98 }, // 1  left eye inner
  { x: 0.04, y: 0.01, visibility: 0.97 }, // 2  left eye
  { x: 0.05, y: 0.01, visibility: 0.96 }, // 3  left eye outer
  { x: 0.01, y: 0.01, visibility: 0.98 }, // 4  right eye inner
  { x: 0.00, y: 0.01, visibility: 0.97 }, // 5  right eye
  { x: 0.00, y: 0.01, visibility: 0.96 }, // 6  right eye outer
  { x: 0.05, y: 0.02, visibility: 0.95 }, // 7  left ear
  { x: 0.00, y: 0.02, visibility: 0.95 }, // 8  right ear
  { x: 0.03, y: 0.02, visibility: 0.93 }, // 9  mouth left
  { x: 0.01, y: 0.02, visibility: 0.93 }, // 10 mouth right
  { x: 0.10, y: 0.10, visibility: 0.97 }, // 11 left shoulder
  { x: 0.00, y: 0.10, visibility: 0.97 }, // 12 right shoulder
  { x: 0.14, y: 0.22, visibility: 0.94 }, // 13 left elbow
  { x: 0.00, y: 0.22, visibility: 0.94 }, // 14 right elbow
  { x: 0.16, y: 0.35, visibility: 0.90 }, // 15 left wrist
  { x: 0.00, y: 0.35, visibility: 0.90 }, // 16 right wrist
  { x: 0.18, y: 0.37, visibility: 0.75 }, // 17 left pinky
  { x: 0.00, y: 0.37, visibility: 0.75 }, // 18 right pinky
  { x: 0.17, y: 0.38, visibility: 0.76 }, // 19 left index
  { x: 0.00, y: 0.38, visibility: 0.76 }, // 20 right index
  { x: 0.15, y: 0.36, visibility: 0.72 }, // 21 left thumb
  { x: 0.00, y: 0.36, visibility: 0.72 }, // 22 right thumb
  { x: 0.07, y: 0.40, visibility: 0.96 }, // 23 left hip
  { x: 0.00, y: 0.40, visibility: 0.96 }, // 24 right hip
  { x: 0.09, y: 0.60, visibility: 0.95 }, // 25 left knee
  { x: 0.00, y: 0.60, visibility: 0.95 }, // 26 right knee
  { x: 0.10, y: 0.80, visibility: 0.92 }, // 27 left ankle
  { x: 0.00, y: 0.80, visibility: 0.92 }, // 28 right ankle
  { x: 0.09, y: 0.85, visibility: 0.88 }, // 29 left heel
  { x: 0.00, y: 0.85, visibility: 0.88 }, // 30 right heel
  { x: 0.11, y: 0.90, visibility: 0.85 }, // 31 left foot index
  { x: 0.00, y: 0.90, visibility: 0.85 }, // 32 right foot index
];

/** Athlete crammed into the bottom-right corner of the crop (high x, high y). */
const EDGE_LANDMARKS_BOTTOM_RIGHT: RawLandmark[] = [
  { x: 0.98, y: 0.10, visibility: 0.99 }, // 0  nose
  { x: 0.99, y: 0.09, visibility: 0.98 }, // 1  left eye inner
  { x: 1.00, y: 0.09, visibility: 0.97 }, // 2  left eye
  { x: 1.00, y: 0.09, visibility: 0.96 }, // 3  left eye outer
  { x: 0.97, y: 0.09, visibility: 0.98 }, // 4  right eye inner
  { x: 0.96, y: 0.09, visibility: 0.97 }, // 5  right eye
  { x: 0.95, y: 0.09, visibility: 0.96 }, // 6  right eye outer
  { x: 1.00, y: 0.11, visibility: 0.95 }, // 7  left ear
  { x: 0.95, y: 0.11, visibility: 0.95 }, // 8  right ear
  { x: 0.99, y: 0.12, visibility: 0.93 }, // 9  mouth left
  { x: 0.97, y: 0.12, visibility: 0.93 }, // 10 mouth right
  { x: 1.00, y: 0.28, visibility: 0.97 }, // 11 left shoulder
  { x: 0.90, y: 0.28, visibility: 0.97 }, // 12 right shoulder
  { x: 1.00, y: 0.48, visibility: 0.94 }, // 13 left elbow
  { x: 0.86, y: 0.48, visibility: 0.94 }, // 14 right elbow
  { x: 1.00, y: 0.65, visibility: 0.90 }, // 15 left wrist
  { x: 0.84, y: 0.65, visibility: 0.90 }, // 16 right wrist
  { x: 1.00, y: 0.67, visibility: 0.75 }, // 17 left pinky
  { x: 0.82, y: 0.67, visibility: 0.75 }, // 18 right pinky
  { x: 1.00, y: 0.68, visibility: 0.76 }, // 19 left index
  { x: 0.83, y: 0.68, visibility: 0.76 }, // 20 right index
  { x: 1.00, y: 0.66, visibility: 0.72 }, // 21 left thumb
  { x: 0.85, y: 0.66, visibility: 0.72 }, // 22 right thumb
  { x: 0.97, y: 0.65, visibility: 0.96 }, // 23 left hip
  { x: 0.88, y: 0.65, visibility: 0.96 }, // 24 right hip
  { x: 0.98, y: 0.82, visibility: 0.95 }, // 25 left knee
  { x: 0.89, y: 0.82, visibility: 0.95 }, // 26 right knee
  { x: 0.99, y: 0.95, visibility: 0.92 }, // 27 left ankle
  { x: 0.90, y: 0.95, visibility: 0.92 }, // 28 right ankle
  { x: 0.98, y: 0.98, visibility: 0.88 }, // 29 left heel
  { x: 0.89, y: 0.98, visibility: 0.88 }, // 30 right heel
  { x: 1.00, y: 1.00, visibility: 0.85 }, // 31 left foot index
  { x: 0.91, y: 1.00, visibility: 0.85 }, // 32 right foot index
];

/** Athlete crammed into the top-right corner of the crop (high x, low y). */
const EDGE_LANDMARKS_TOP_RIGHT: RawLandmark[] = [
  { x: 0.98, y: 0.01, visibility: 0.99 }, // 0  nose
  { x: 0.99, y: 0.01, visibility: 0.98 }, // 1  left eye inner
  { x: 1.00, y: 0.01, visibility: 0.97 }, // 2  left eye
  { x: 1.00, y: 0.01, visibility: 0.96 }, // 3  left eye outer
  { x: 0.97, y: 0.01, visibility: 0.98 }, // 4  right eye inner
  { x: 0.96, y: 0.01, visibility: 0.97 }, // 5  right eye
  { x: 0.95, y: 0.01, visibility: 0.96 }, // 6  right eye outer
  { x: 1.00, y: 0.02, visibility: 0.95 }, // 7  left ear
  { x: 0.95, y: 0.02, visibility: 0.95 }, // 8  right ear
  { x: 0.99, y: 0.02, visibility: 0.93 }, // 9  mouth left
  { x: 0.97, y: 0.02, visibility: 0.93 }, // 10 mouth right
  { x: 1.00, y: 0.12, visibility: 0.97 }, // 11 left shoulder
  { x: 0.90, y: 0.12, visibility: 0.97 }, // 12 right shoulder
  { x: 1.00, y: 0.28, visibility: 0.94 }, // 13 left elbow
  { x: 0.86, y: 0.28, visibility: 0.94 }, // 14 right elbow
  { x: 1.00, y: 0.44, visibility: 0.90 }, // 15 left wrist
  { x: 0.84, y: 0.44, visibility: 0.90 }, // 16 right wrist
  { x: 1.00, y: 0.46, visibility: 0.75 }, // 17 left pinky
  { x: 0.82, y: 0.46, visibility: 0.75 }, // 18 right pinky
  { x: 1.00, y: 0.47, visibility: 0.76 }, // 19 left index
  { x: 0.83, y: 0.47, visibility: 0.76 }, // 20 right index
  { x: 1.00, y: 0.45, visibility: 0.72 }, // 21 left thumb
  { x: 0.85, y: 0.45, visibility: 0.72 }, // 22 right thumb
  { x: 0.97, y: 0.47, visibility: 0.96 }, // 23 left hip
  { x: 0.88, y: 0.47, visibility: 0.96 }, // 24 right hip
  { x: 0.98, y: 0.64, visibility: 0.95 }, // 25 left knee
  { x: 0.89, y: 0.64, visibility: 0.95 }, // 26 right knee
  { x: 0.99, y: 0.80, visibility: 0.92 }, // 27 left ankle
  { x: 0.90, y: 0.80, visibility: 0.92 }, // 28 right ankle
  { x: 0.98, y: 0.85, visibility: 0.88 }, // 29 left heel
  { x: 0.89, y: 0.85, visibility: 0.88 }, // 30 right heel
  { x: 1.00, y: 0.90, visibility: 0.85 }, // 31 left foot index
  { x: 0.91, y: 0.90, visibility: 0.85 }, // 32 right foot index
];

/** Athlete crammed into the bottom-left corner of the crop (low x, high y). */
const EDGE_LANDMARKS_BOTTOM_LEFT: RawLandmark[] = [
  { x: 0.02, y: 0.10, visibility: 0.99 }, // 0  nose
  { x: 0.03, y: 0.09, visibility: 0.98 }, // 1  left eye inner
  { x: 0.04, y: 0.09, visibility: 0.97 }, // 2  left eye
  { x: 0.05, y: 0.09, visibility: 0.96 }, // 3  left eye outer
  { x: 0.01, y: 0.09, visibility: 0.98 }, // 4  right eye inner
  { x: 0.00, y: 0.09, visibility: 0.97 }, // 5  right eye
  { x: 0.00, y: 0.09, visibility: 0.96 }, // 6  right eye outer
  { x: 0.05, y: 0.11, visibility: 0.95 }, // 7  left ear
  { x: 0.00, y: 0.11, visibility: 0.95 }, // 8  right ear
  { x: 0.03, y: 0.12, visibility: 0.93 }, // 9  mouth left
  { x: 0.01, y: 0.12, visibility: 0.93 }, // 10 mouth right
  { x: 0.10, y: 0.30, visibility: 0.97 }, // 11 left shoulder
  { x: 0.00, y: 0.30, visibility: 0.97 }, // 12 right shoulder
  { x: 0.14, y: 0.50, visibility: 0.94 }, // 13 left elbow
  { x: 0.00, y: 0.50, visibility: 0.94 }, // 14 right elbow
  { x: 0.16, y: 0.65, visibility: 0.90 }, // 15 left wrist
  { x: 0.00, y: 0.65, visibility: 0.90 }, // 16 right wrist
  { x: 0.18, y: 0.67, visibility: 0.75 }, // 17 left pinky
  { x: 0.00, y: 0.67, visibility: 0.75 }, // 18 right pinky
  { x: 0.17, y: 0.68, visibility: 0.76 }, // 19 left index
  { x: 0.00, y: 0.68, visibility: 0.76 }, // 20 right index
  { x: 0.15, y: 0.66, visibility: 0.72 }, // 21 left thumb
  { x: 0.00, y: 0.66, visibility: 0.72 }, // 22 right thumb
  { x: 0.07, y: 0.68, visibility: 0.96 }, // 23 left hip
  { x: 0.00, y: 0.68, visibility: 0.96 }, // 24 right hip
  { x: 0.09, y: 0.82, visibility: 0.95 }, // 25 left knee
  { x: 0.00, y: 0.82, visibility: 0.95 }, // 26 right knee
  { x: 0.10, y: 0.95, visibility: 0.92 }, // 27 left ankle
  { x: 0.00, y: 0.95, visibility: 0.92 }, // 28 right ankle
  { x: 0.09, y: 0.98, visibility: 0.88 }, // 29 left heel
  { x: 0.00, y: 0.98, visibility: 0.88 }, // 30 right heel
  { x: 0.11, y: 1.00, visibility: 0.85 }, // 31 left foot index
  { x: 0.00, y: 1.00, visibility: 0.85 }, // 32 right foot index
];

// ─── 16:9 video — athlete at crop edges ──────────────────────────────────────
//
// The centred-crop configuration is used for all four corner-athlete positions
// so that the 15% padding has room on all sides; this isolates the landmark
// extremity as the only variable.

describe("skeleton pipeline — 16:9 video, athlete at top-left of crop", () => {
  const CENTRED_CROP: Crop = { cropX0: 300, cropY0: 80, cropW: 680, cropH: 560 };

  it("all landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      EDGE_LANDMARKS_TOP_LEFT,
      CENTRED_CROP,
      VIDEO_16_9,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("remapped coords are in [0, 1] for all landmarks", () => {
    const remapped = lmRemapped(EDGE_LANDMARKS_TOP_LEFT, CENTRED_CROP, VIDEO_16_9);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("skeleton pipeline — 16:9 video, athlete at bottom-right of crop", () => {
  const CENTRED_CROP: Crop = { cropX0: 300, cropY0: 80, cropW: 680, cropH: 560 };

  it("all landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      EDGE_LANDMARKS_BOTTOM_RIGHT,
      CENTRED_CROP,
      VIDEO_16_9,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("remapped coords are in [0, 1] for all landmarks", () => {
    const remapped = lmRemapped(EDGE_LANDMARKS_BOTTOM_RIGHT, CENTRED_CROP, VIDEO_16_9);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("skeleton pipeline — 16:9 video, athlete at top-right of crop", () => {
  const CENTRED_CROP: Crop = { cropX0: 300, cropY0: 80, cropW: 680, cropH: 560 };

  it("all landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      EDGE_LANDMARKS_TOP_RIGHT,
      CENTRED_CROP,
      VIDEO_16_9,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("remapped coords are in [0, 1] for all landmarks", () => {
    const remapped = lmRemapped(EDGE_LANDMARKS_TOP_RIGHT, CENTRED_CROP, VIDEO_16_9);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("skeleton pipeline — 16:9 video, athlete at bottom-left of crop", () => {
  const CENTRED_CROP: Crop = { cropX0: 300, cropY0: 80, cropW: 680, cropH: 560 };

  it("all landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      EDGE_LANDMARKS_BOTTOM_LEFT,
      CENTRED_CROP,
      VIDEO_16_9,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("remapped coords are in [0, 1] for all landmarks", () => {
    const remapped = lmRemapped(EDGE_LANDMARKS_BOTTOM_LEFT, CENTRED_CROP, VIDEO_16_9);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });
});

// ─── 9:16 portrait video — athlete at crop edges ─────────────────────────────
//
// Portrait footage is the most common source of skeleton drift. Running the
// same four extreme-position landmark sets through the 9:16 pipeline ensures
// both axis directions are verified at the boundary.

describe("skeleton pipeline — 9:16 portrait video, athlete at top-left of crop", () => {
  const CENTRED_CROP: Crop = { cropX0: 80, cropY0: 200, cropW: 560, cropH: 880 };

  it("all landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      EDGE_LANDMARKS_TOP_LEFT,
      CENTRED_CROP,
      VIDEO_9_16,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("remapped coords are in [0, 1] for all landmarks", () => {
    const remapped = lmRemapped(EDGE_LANDMARKS_TOP_LEFT, CENTRED_CROP, VIDEO_9_16);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("skeleton pipeline — 9:16 portrait video, athlete at bottom-right of crop", () => {
  const CENTRED_CROP: Crop = { cropX0: 80, cropY0: 200, cropW: 560, cropH: 880 };

  it("all landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      EDGE_LANDMARKS_BOTTOM_RIGHT,
      CENTRED_CROP,
      VIDEO_9_16,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("remapped coords are in [0, 1] for all landmarks", () => {
    const remapped = lmRemapped(EDGE_LANDMARKS_BOTTOM_RIGHT, CENTRED_CROP, VIDEO_9_16);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("skeleton pipeline — 9:16 portrait video, athlete at top-right of crop", () => {
  const CENTRED_CROP: Crop = { cropX0: 80, cropY0: 200, cropW: 560, cropH: 880 };

  it("all landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      EDGE_LANDMARKS_TOP_RIGHT,
      CENTRED_CROP,
      VIDEO_9_16,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("remapped coords are in [0, 1] for all landmarks", () => {
    const remapped = lmRemapped(EDGE_LANDMARKS_TOP_RIGHT, CENTRED_CROP, VIDEO_9_16);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("skeleton pipeline — 9:16 portrait video, athlete at bottom-left of crop", () => {
  const CENTRED_CROP: Crop = { cropX0: 80, cropY0: 200, cropW: 560, cropH: 880 };

  it("all landmarks project inside the display rect", () => {
    assertAllLandmarksOnScreen(
      EDGE_LANDMARKS_BOTTOM_LEFT,
      CENTRED_CROP,
      VIDEO_9_16,
      DISPLAY_W,
      DISPLAY_H,
    );
  });

  it("remapped coords are in [0, 1] for all landmarks", () => {
    const remapped = lmRemapped(EDGE_LANDMARKS_BOTTOM_LEFT, CENTRED_CROP, VIDEO_9_16);
    for (const lm of remapped) {
      expect(lm.x).toBeGreaterThanOrEqual(0);
      expect(lm.x).toBeLessThanOrEqual(1);
      expect(lm.y).toBeGreaterThanOrEqual(0);
      expect(lm.y).toBeLessThanOrEqual(1);
    }
  });
});

// ─── Aspect-ratio stress test ──────────────────────────────────────────────────
//
// Verifies that the containRect+projectLandmark pair handles cases where the
// padded crop is wider than the display (letterbox with horizontal bars) and
// taller than the display (letterbox with vertical bars) — the most common
// source of skeleton drift on unusual crop shapes.

describe("skeleton pipeline — aspect ratio edge cases", () => {
  const CENTRED_CROP: Crop = { cropX0: 300, cropY0: 80, cropW: 680, cropH: 560 };

  it("landscape display (wider than tall) — landmarks stay on screen", () => {
    // e.g. tablet landscape 1024×600
    assertAllLandmarksOnScreen(
      REALISTIC_LANDMARKS_33,
      CENTRED_CROP,
      VIDEO_16_9,
      1024,
      600,
    );
  });

  it("square display — landmarks stay on screen", () => {
    assertAllLandmarksOnScreen(
      REALISTIC_LANDMARKS_33,
      CENTRED_CROP,
      VIDEO_16_9,
      400,
      400,
    );
  });

  it("very tall narrow display — landmarks stay on screen", () => {
    // e.g. slim phone 320×700
    assertAllLandmarksOnScreen(
      REALISTIC_LANDMARKS_33,
      CENTRED_CROP,
      VIDEO_16_9,
      320,
      700,
    );
  });
});
