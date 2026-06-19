import { describe, it, expect } from "vitest";

// ─── Math replicated from the WebView HTML in skeleton/[id].tsx ──────────────
//
// These functions mirror `paddedBounds()` and `lmRemapped()` that run inside
// the hidden MediaPipe WebView. The test must replicate the math — not import
// it — because the originals live inside a template-literal HTML string and
// cannot be imported directly into Node.
//
// Source of truth: artifacts/lense-mobile/app/analysis/skeleton/[id].tsx
//   paddedBounds  ~ line 220
//   lmRemapped    ~ line 243

interface RawLandmark {
  x: number;
  y: number;
  visibility?: number;
}

interface RemappedLandmark {
  x: number;
  y: number;
  v: number;
}

interface Crop {
  cropX0: number;
  cropY0: number;
  cropW: number;
  cropH: number;
}

interface VideoDims {
  W: number;
  H: number;
}

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

// ─── paddedBounds ─────────────────────────────────────────────────────────────

describe("paddedBounds", () => {
  it("adds 15 % padding on all sides when the crop is well inside the video", () => {
    // crop: x=200, y=100, w=400, h=300  inside a 1280×720 video
    // px=60, py=45
    // sx=140, sy=55, ex=660, ey=445  → sw=520, sh=390
    const bounds = paddedBounds(
      { cropX0: 200, cropY0: 100, cropW: 400, cropH: 300 },
      { W: 1280, H: 720 },
    );
    expect(bounds).toEqual({ sx: 140, sy: 55, sw: 520, sh: 390 });
  });

  it("clamps sx and sy to 0 when the crop touches the left/top edge", () => {
    // crop: x=10, y=10, w=200, h=150  — padding would go negative
    // px=30, py=22.5  → sx=max(0, -20)=0, sy=max(0, -12.5)=0
    // ex=240, ey=182.5  → sw=240, sh=182.5
    const bounds = paddedBounds(
      { cropX0: 10, cropY0: 10, cropW: 200, cropH: 150 },
      { W: 1280, H: 720 },
    );
    expect(bounds.sx).toBe(0);
    expect(bounds.sy).toBe(0);
    expect(bounds.sw).toBe(240);
    expect(bounds.sh).toBeCloseTo(182.5, 5);
  });

  it("clamps ex and ey to video dimensions when the crop touches the right/bottom edge", () => {
    // crop: x=1100, y=600, w=180, h=120  inside 1280×720
    // px=27, py=18  → sx=1073, sy=582
    // ex=min(1280, 1307)=1280, ey=min(720, 738)=720
    // sw=1280-1073=207, sh=720-582=138
    const bounds = paddedBounds(
      { cropX0: 1100, cropY0: 600, cropW: 180, cropH: 120 },
      { W: 1280, H: 720 },
    );
    expect(bounds.sx).toBe(1073);
    expect(bounds.sy).toBe(582);
    expect(bounds.sw).toBe(207);
    expect(bounds.sh).toBe(138);
  });

  it("produces sw=W and sh=H for a full-frame crop (no padding room on any side)", () => {
    // cropX0=0, cropY0=0, cropW=640, cropH=360 — padding clamps on both sides
    // sx=0, ex=min(640, 736)=640 → sw=640; sy=0, ey=min(360, 414)=360 → sh=360
    const bounds = paddedBounds(
      { cropX0: 0, cropY0: 0, cropW: 640, cropH: 360 },
      { W: 640, H: 360 },
    );
    expect(bounds).toEqual({ sx: 0, sy: 0, sw: 640, sh: 360 });
  });
});

// ─── lmRemapped ──────────────────────────────────────────────────────────────

describe("lmRemapped", () => {
  it("maps a centred landmark to ~0.5/0.5 when crop is well padded and symmetric", () => {
    // crop: x=200, y=100, w=400, h=300 inside 1280×720
    // paddedBounds: sx=140, sy=55, sw=520, sh=390
    // landmark at crop-local (0.5, 0.5):
    //   abs_x = 0.5*400+200 = 400  → (400-140)/520 = 0.5
    //   abs_y = 0.5*300+100 = 250  → (250-55)/390  = 0.5
    const [pt] = lmRemapped(
      [{ x: 0.5, y: 0.5, visibility: 0.9 }],
      { cropX0: 200, cropY0: 100, cropW: 400, cropH: 300 },
      { W: 1280, H: 720 },
    );
    expect(pt.x).toBe(0.5);
    expect(pt.y).toBe(0.5);
    expect(pt.v).toBe(0.9);
  });

  it("maps crop top-left corner (0,0) to the padded-local offset, not 0,0", () => {
    // paddedBounds: sx=140, sy=55, sw=520, sh=390
    // landmark at crop-local (0, 0):
    //   abs_x=200  → (200-140)/520 = 60/520 ≈ 0.1154
    //   abs_y=100  → (100-55)/390  = 45/390 ≈ 0.1154
    const [pt] = lmRemapped(
      [{ x: 0, y: 0 }],
      { cropX0: 200, cropY0: 100, cropW: 400, cropH: 300 },
      { W: 1280, H: 720 },
    );
    expect(pt.x).toBeCloseTo(60 / 520, 4);
    expect(pt.y).toBeCloseTo(45 / 390, 4);
  });

  it("maps crop bottom-right corner (1,1) to the padded-local offset, not 1,1", () => {
    // paddedBounds: sx=140, sy=55, sw=520, sh=390
    // landmark at crop-local (1, 1):
    //   abs_x=600  → (600-140)/520 = 460/520 ≈ 0.8846
    //   abs_y=400  → (400-55)/390  = 345/390 ≈ 0.8846
    const [pt] = lmRemapped(
      [{ x: 1, y: 1 }],
      { cropX0: 200, cropY0: 100, cropW: 400, cropH: 300 },
      { W: 1280, H: 720 },
    );
    expect(pt.x).toBeCloseTo(460 / 520, 4);
    expect(pt.y).toBeCloseTo(345 / 390, 4);
  });

  it("landmark coords are in [0,1] when crop touches the left/top edge", () => {
    // crop: x=10, y=10, w=200, h=150 inside 1280×720
    // paddedBounds: sx=0, sy=0, sw=240, sh=182.5
    // landmark at crop-local (0.5, 0.5):
    //   abs_x=0.5*200+10=110  → 110/240 ≈ 0.4583
    //   abs_y=0.5*150+10=85   → 85/182.5 ≈ 0.4658
    const [pt] = lmRemapped(
      [{ x: 0.5, y: 0.5, visibility: 1 }],
      { cropX0: 10, cropY0: 10, cropW: 200, cropH: 150 },
      { W: 1280, H: 720 },
    );
    expect(pt.x).toBeCloseTo(110 / 240, 4);
    expect(pt.y).toBeCloseTo(85 / 182.5, 4);
    expect(pt.x).toBeGreaterThan(0);
    expect(pt.x).toBeLessThan(1);
    expect(pt.y).toBeGreaterThan(0);
    expect(pt.y).toBeLessThan(1);
  });

  it("landmark coords are in [0,1] when crop touches the right/bottom edge", () => {
    // crop: x=1100, y=600, w=180, h=120 inside 1280×720
    // paddedBounds: sx=1073, sy=582, sw=207, sh=138
    // landmark at crop-local (0.5, 0.5):
    //   abs_x=0.5*180+1100=1190  → (1190-1073)/207 = 117/207 ≈ 0.5652
    //   abs_y=0.5*120+600=660    → (660-582)/138   = 78/138  ≈ 0.5652
    const [pt] = lmRemapped(
      [{ x: 0.5, y: 0.5, visibility: 0.75 }],
      { cropX0: 1100, cropY0: 600, cropW: 180, cropH: 120 },
      { W: 1280, H: 720 },
    );
    expect(pt.x).toBeCloseTo(117 / 207, 4);
    expect(pt.y).toBeCloseTo(78 / 138, 4);
    expect(pt.x).toBeGreaterThan(0);
    expect(pt.x).toBeLessThan(1);
    expect(pt.y).toBeGreaterThan(0);
    expect(pt.y).toBeLessThan(1);
  });

  it("is the identity transform for a full-frame crop (landmark maps to the same normalised position)", () => {
    // crop occupies the entire video — padding clamps on all sides, so sw=W, sh=H
    // abs_x = p.x * W + 0 → (abs_x - 0) / W = p.x  (and same for y)
    const pts = lmRemapped(
      [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 1 },
      ],
      { cropX0: 0, cropY0: 0, cropW: 640, cropH: 360 },
      { W: 640, H: 360 },
    );
    expect(pts[0]).toMatchObject({ x: 0, y: 0 });
    expect(pts[1]).toMatchObject({ x: 0.5, y: 0.5 });
    expect(pts[2]).toMatchObject({ x: 1, y: 1 });
  });

  it("preserves visibility rounded to 3 decimal places", () => {
    const [pt] = lmRemapped(
      [{ x: 0.5, y: 0.5, visibility: 0.98765 }],
      { cropX0: 0, cropY0: 0, cropW: 640, cropH: 360 },
      { W: 640, H: 360 },
    );
    expect(pt.v).toBe(0.988);
  });

  it("defaults visibility to 0 when the property is absent", () => {
    const [pt] = lmRemapped(
      [{ x: 0.5, y: 0.5 }],
      { cropX0: 0, cropY0: 0, cropW: 640, cropH: 360 },
      { W: 640, H: 360 },
    );
    expect(pt.v).toBe(0);
  });

  it("remaps multiple landmarks independently in a single call", () => {
    const crop = { cropX0: 200, cropY0: 100, cropW: 400, cropH: 300 };
    const video = { W: 1280, H: 720 };
    const pts = lmRemapped(
      [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 1 },
      ],
      crop,
      video,
    );
    expect(pts).toHaveLength(3);
    // centre landmark should be the symmetric midpoint (0.5, 0.5)
    expect(pts[1].x).toBe(0.5);
    expect(pts[1].y).toBe(0.5);
    // top-left and bottom-right should be symmetric around 0.5
    expect(pts[0].x + pts[2].x).toBeCloseTo(1, 4);
    expect(pts[0].y + pts[2].y).toBeCloseTo(1, 4);
  });
});
