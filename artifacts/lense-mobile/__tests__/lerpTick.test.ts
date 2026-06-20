import { describe, it, expect, vi } from "vitest";
import { bsearchLower, lerpTick, aspectFromNaturalSize, handleVideoReadyForDisplay } from "../utils/lerpTick";
import type { FrameTick } from "../lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTick(t: number, x = 0, y = 0, kneeAngle = 90): FrameTick {
  return {
    t,
    lm: [{ x, y, v: 1 }],
    angles: { leftKnee: kneeAngle },
    jr: { leftKnee: { deg: kneeAngle, lvl: 0 } },
  };
}

// ── bsearchLower ─────────────────────────────────────────────────────────────

describe("bsearchLower", () => {
  const ticks = [0, 1, 2, 3, 4].map((t) => makeTick(t * 1000));

  it("returns 0 when t is before the first tick", () => {
    expect(bsearchLower(ticks, -100)).toBe(0);
  });

  it("returns the index of the exact match", () => {
    expect(bsearchLower(ticks, 2000)).toBe(2);
  });

  it("returns the next-higher index for a value between two ticks", () => {
    expect(bsearchLower(ticks, 2500)).toBe(3);
  });

  it("returns the last index when t is beyond all ticks", () => {
    expect(bsearchLower(ticks, 99999)).toBe(4);
  });
});

// ── lerpTick ─────────────────────────────────────────────────────────────────

describe("lerpTick — edge cases", () => {
  it("returns null for an empty array", () => {
    expect(lerpTick([], 500)).toBeNull();
  });

  it("returns the only tick regardless of t when the array has one element", () => {
    const tick = makeTick(1000, 0.2, 0.3, 45);
    expect(lerpTick([tick], 0)).toBe(tick);
    expect(lerpTick([tick], 5000)).toBe(tick);
  });

  it("clamps to the first tick when t is before all ticks", () => {
    const ticks = [makeTick(1000), makeTick(2000)];
    const result = lerpTick(ticks, 0);
    expect(result).toBe(ticks[0]);
  });

  it("clamps to the last tick when t is after all ticks", () => {
    const ticks = [makeTick(1000), makeTick(2000)];
    const result = lerpTick(ticks, 9999);
    expect(result).toBe(ticks[1]);
  });

  it("returns the tick directly when t matches a tick timestamp exactly", () => {
    const ticks = [makeTick(0), makeTick(1000), makeTick(2000)];
    const result = lerpTick(ticks, 1000);
    expect(result?.t).toBe(1000);
  });
});

describe("lerpTick — interpolation", () => {
  it("blends landmarks at the midpoint (alpha = 0.5)", () => {
    const a = makeTick(0, 0.0, 0.0);
    const b = makeTick(1000, 1.0, 1.0);
    const result = lerpTick([a, b], 500);

    expect(result).not.toBeNull();
    expect(result!.lm[0]!.x).toBeCloseTo(0.5);
    expect(result!.lm[0]!.y).toBeCloseTo(0.5);
  });

  it("blends joint angles proportionally", () => {
    const a = makeTick(0, 0, 0, 60);
    const b = makeTick(1000, 0, 0, 120);
    const result = lerpTick([a, b], 250);

    expect(result).not.toBeNull();
    expect(result!.angles.leftKnee).toBeCloseTo(75);
  });

  it("uses alpha = 0.75 correctly (three-quarter blend)", () => {
    const a = makeTick(0, 0.0, 0.0);
    const b = makeTick(1000, 1.0, 1.0);
    const result = lerpTick([a, b], 750);

    expect(result!.lm[0]!.x).toBeCloseTo(0.75);
  });

  it("sets the interpolated t on the returned tick", () => {
    const a = makeTick(0);
    const b = makeTick(1000);
    const result = lerpTick([a, b], 400);

    expect(result!.t).toBe(400);
  });

  it("preserves jr from the lower tick (no jr interpolation)", () => {
    const a = makeTick(0, 0, 0, 60);
    const b = makeTick(1000, 0, 0, 120);
    const result = lerpTick([a, b], 500);

    expect(result!.jr).toBe(a.jr);
  });

  it("handles a missing landmark in b gracefully (falls back to landmark from a)", () => {
    const a: FrameTick = {
      t: 0,
      lm: [{ x: 0.1, y: 0.2, v: 1 }, { x: 0.3, y: 0.4, v: 1 }],
      angles: {},
      jr: {},
    };
    const b: FrameTick = {
      t: 1000,
      lm: [{ x: 0.9, y: 0.8, v: 1 }],
      angles: {},
      jr: {},
    };
    const result = lerpTick([a, b], 500);

    expect(result!.lm[0]!.x).toBeCloseTo(0.5);
    expect(result!.lm[1]).toEqual(a.lm[1]);
  });
});

// ── aspectFromNaturalSize ─────────────────────────────────────────────────────

describe("aspectFromNaturalSize — onReadyForDisplay logic", () => {
  it("computes width / height for a valid 16:9 size", () => {
    expect(aspectFromNaturalSize(1920, 1080)).toBeCloseTo(16 / 9);
  });

  it("computes a portrait aspect ratio correctly", () => {
    expect(aspectFromNaturalSize(1080, 1920)).toBeCloseTo(9 / 16);
  });

  it("returns null when width is zero (invalid event)", () => {
    expect(aspectFromNaturalSize(0, 1080)).toBeNull();
  });

  it("returns null when height is zero (invalid event)", () => {
    expect(aspectFromNaturalSize(1920, 0)).toBeNull();
  });

  it("returns null when both dimensions are zero", () => {
    expect(aspectFromNaturalSize(0, 0)).toBeNull();
  });

  it("returns null for negative dimensions", () => {
    expect(aspectFromNaturalSize(-1920, 1080)).toBeNull();
    expect(aspectFromNaturalSize(1920, -1080)).toBeNull();
  });

  it("takes priority over the AsyncStorage fallback: non-null means caller should override", () => {
    const storageFallback = 16 / 9;
    const eventAspect = aspectFromNaturalSize(1080, 1920);
    const applied = eventAspect ?? storageFallback;

    expect(applied).toBeCloseTo(9 / 16);
    expect(applied).not.toBeCloseTo(16 / 9);
  });

  it("preserves the AsyncStorage fallback when the event carries invalid dimensions", () => {
    const storageFallback = 4 / 3;
    const eventAspect = aspectFromNaturalSize(0, 0);
    const applied = eventAspect ?? storageFallback;

    expect(applied).toBeCloseTo(4 / 3);
  });
});

// ── handleVideoReadyForDisplay — event wiring ─────────────────────────────────
// These tests simulate exactly what the Video component does:
// it calls handleVideoReadyForDisplay(event, setVideoAspect) on the
// onReadyForDisplay callback. The mock `setAspect` stands in for setVideoAspect.

describe("handleVideoReadyForDisplay — onReadyForDisplay event wiring", () => {
  it("calls setAspect with width/height when both dimensions are valid (16:9)", () => {
    const setAspect = vi.fn();
    handleVideoReadyForDisplay({ naturalSize: { width: 1920, height: 1080 } }, setAspect);

    expect(setAspect).toHaveBeenCalledOnce();
    expect(setAspect).toHaveBeenCalledWith(expect.closeTo(16 / 9, 5));
  });

  it("overrides the AsyncStorage fallback: setAspect is called with the event value, not the default", () => {
    let currentAspect = 16 / 9; // simulates the AsyncStorage fallback already applied
    const setAspect = vi.fn((a: number) => { currentAspect = a; });

    handleVideoReadyForDisplay({ naturalSize: { width: 1080, height: 1920 } }, setAspect);

    expect(setAspect).toHaveBeenCalledOnce();
    expect(currentAspect).toBeCloseTo(9 / 16);
    expect(currentAspect).not.toBeCloseTo(16 / 9);
  });

  it("does NOT call setAspect when width is zero — preserves existing state", () => {
    const setAspect = vi.fn();
    handleVideoReadyForDisplay({ naturalSize: { width: 0, height: 1080 } }, setAspect);

    expect(setAspect).not.toHaveBeenCalled();
  });

  it("does NOT call setAspect when height is zero — preserves existing state", () => {
    const setAspect = vi.fn();
    handleVideoReadyForDisplay({ naturalSize: { width: 1920, height: 0 } }, setAspect);

    expect(setAspect).not.toHaveBeenCalled();
  });

  it("does NOT call setAspect when both dimensions are zero", () => {
    const setAspect = vi.fn();
    handleVideoReadyForDisplay({ naturalSize: { width: 0, height: 0 } }, setAspect);

    expect(setAspect).not.toHaveBeenCalled();
  });

  it("handles a portrait video event correctly and updates aspect ratio", () => {
    const setAspect = vi.fn();
    handleVideoReadyForDisplay({ naturalSize: { width: 1080, height: 1920 } }, setAspect);

    expect(setAspect).toHaveBeenCalledWith(expect.closeTo(1080 / 1920, 5));
  });
});
