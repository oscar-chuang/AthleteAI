/**
 * Confirms the scan-progress bar uses smooth animation instead of instant jumps.
 *
 * Behaviour under test (from utils/scanProgressAnim.ts, used by the skeleton
 * screen's scanProgress useEffect):
 *
 *   - progress > 0  →  Animated.timing is called with the new value (smooth tween)
 *   - progress === 0 →  Animated.Value.setValue is called directly (instant reset,
 *                       no tween — avoids an awkward reverse animation on re-scan)
 *   - Any in-flight animation is stopped before a new one starts so simultaneous
 *     tweens cannot fight each other and produce a visible jump.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyScanProgressAnim, type AnimValue, type TimingFn } from "../utils/scanProgressAnim";

// ── Minimal fakes ─────────────────────────────────────────────────────────────

function makeAnimValue(): {
  mock: AnimValue;
  setValue: ReturnType<typeof vi.fn>;
  stopAnimation: ReturnType<typeof vi.fn>;
} {
  const setValue = vi.fn();
  const stopAnimation = vi.fn();
  const mock: AnimValue = { setValue, stopAnimation };
  return { mock, setValue, stopAnimation };
}

function makeTiming(): { timing: TimingFn; start: ReturnType<typeof vi.fn> } {
  const start = vi.fn();
  const timing: TimingFn = vi.fn(() => ({ start }));
  return { timing, start };
}

const noopEasing = (t: number) => t;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("scan progress bar — smooth animation instead of instant jumps", () => {
  let anim: AnimValue;
  let setValue: ReturnType<typeof vi.fn>;
  let stopAnimation: ReturnType<typeof vi.fn>;
  let timing: TimingFn;
  let start: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ({ mock: anim, setValue, stopAnimation } = makeAnimValue());
    ({ timing, start } = makeTiming());
  });

  it("calls Animated.timing (not setValue) when progress advances to a non-zero value", () => {
    applyScanProgressAnim(anim, 0.4, timing, noopEasing);

    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing).toHaveBeenCalledWith(anim, expect.objectContaining({ toValue: 0.4 }));
    expect(start).toHaveBeenCalledTimes(1);
    expect(setValue).not.toHaveBeenCalled();
  });

  it("passes the correct duration (400 ms) and useNativeDriver: false to Animated.timing", () => {
    applyScanProgressAnim(anim, 0.75, timing, noopEasing);

    expect(timing).toHaveBeenCalledWith(
      anim,
      expect.objectContaining({ duration: 400, useNativeDriver: false }),
    );
  });

  it("passes the supplied easing function through to Animated.timing", () => {
    const customEasing = vi.fn((t: number) => t * t);
    applyScanProgressAnim(anim, 0.5, timing, customEasing);

    expect(timing).toHaveBeenCalledWith(
      anim,
      expect.objectContaining({ easing: customEasing }),
    );
  });

  it("calls setValue(0) (not Animated.timing) when progress resets to 0", () => {
    applyScanProgressAnim(anim, 0, timing, noopEasing);

    expect(setValue).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledWith(0);
    expect(timing).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it("stops any in-flight animation before starting a new one on advance", () => {
    applyScanProgressAnim(anim, 0.4, timing, noopEasing);

    expect(stopAnimation).toHaveBeenCalledTimes(1);
    // stopAnimation must be called before timing so the old tween is cancelled first
    const stopOrder  = stopAnimation.mock.invocationCallOrder[0]!;
    const timingOrder = (timing as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!;
    expect(stopOrder).toBeLessThan(timingOrder);
  });

  it("stops any in-flight animation before resetting to 0", () => {
    applyScanProgressAnim(anim, 0, timing, noopEasing);

    expect(stopAnimation).toHaveBeenCalledTimes(1);
    const stopOrder   = stopAnimation.mock.invocationCallOrder[0]!;
    const setValueOrder = setValue.mock.invocationCallOrder[0]!;
    expect(stopOrder).toBeLessThan(setValueOrder);
  });

  it("animates each distinct non-zero progress value independently", () => {
    applyScanProgressAnim(anim, 0.25, timing, noopEasing);
    applyScanProgressAnim(anim, 0.5, timing, noopEasing);
    applyScanProgressAnim(anim, 1.0, timing, noopEasing);

    expect(timing).toHaveBeenCalledTimes(3);
    expect((timing as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toMatchObject({ toValue: 0.25 });
    expect((timing as ReturnType<typeof vi.fn>).mock.calls[1]![1]).toMatchObject({ toValue: 0.5 });
    expect((timing as ReturnType<typeof vi.fn>).mock.calls[2]![1]).toMatchObject({ toValue: 1.0 });
    expect(setValue).not.toHaveBeenCalled();
  });

  it("resets instantly then animates when progress goes 0 → value → 0 → value", () => {
    applyScanProgressAnim(anim, 0.3, timing, noopEasing); // advance
    applyScanProgressAnim(anim, 0,   timing, noopEasing); // reset
    applyScanProgressAnim(anim, 0.6, timing, noopEasing); // advance again

    expect(timing).toHaveBeenCalledTimes(2);
    expect(setValue).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledWith(0);
  });

  it("works correctly when stopAnimation is not provided (optional method)", () => {
    const minimalAnim: AnimValue = { setValue: vi.fn() }; // no stopAnimation
    expect(() => applyScanProgressAnim(minimalAnim, 0.5, timing, noopEasing)).not.toThrow();
    expect(timing).toHaveBeenCalledTimes(1);
  });
});
