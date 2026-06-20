/**
 * Drives the scan-progress bar animation.
 *
 * - progress === 0  →  instant reset via setValue (no tween)
 * - progress  >  0  →  smooth 300 ms linear Animated.timing
 *
 * Extracted into a standalone function so the behaviour can be unit-tested
 * without mounting the full skeleton screen component.
 */

export interface AnimValue {
  setValue(v: number): void;
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
    anim.setValue(0);
  } else {
    timing(anim, {
      toValue: progress,
      duration: 300,
      easing,
      useNativeDriver: false,
    }).start();
  }
}
