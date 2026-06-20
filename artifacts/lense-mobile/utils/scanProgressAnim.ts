/**
 * Drives the scan-progress bar animation.
 *
 * - progress === 0  →  instant reset via setValue (no tween)
 * - progress  >  0  →  smooth 400 ms linear Animated.timing
 *
 * Duration matches the ~400 ms interval between `progress` WebView messages so
 * the animation is still running when the next update arrives, making the fill
 * appear continuous.  Any in-flight animation is stopped before starting a new
 * one to prevent simultaneous tweens fighting each other (which caused the
 * visible "jump" at each step).
 *
 * Extracted into a standalone function so the behaviour can be unit-tested
 * without mounting the full skeleton screen component.
 */

export interface AnimValue {
  setValue(v: number): void;
  stopAnimation?(): void;
}

export interface TimingConfig {
  toValue: number;
  duration: number;
  easing: (t: number) => number;
  useNativeDriver: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TimingFn = (anim: any, config: TimingConfig) => { start(): void };

export function applyScanProgressAnim(
  anim: AnimValue,
  progress: number,
  timing: TimingFn,
  easing: (t: number) => number,
): void {
  if (progress === 0) {
    anim.stopAnimation?.();
    anim.setValue(0);
  } else {
    anim.stopAnimation?.();
    timing(anim, {
      toValue: progress,
      duration: 400,
      easing,
      useNativeDriver: false,
    }).start();
  }
}
