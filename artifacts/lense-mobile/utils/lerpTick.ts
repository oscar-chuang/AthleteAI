import type { FrameTick } from "@/lib/api";

/** Binary search: returns the index of the first tick whose `.t >= t`.
 *  When all ticks are less than `t`, returns the last index. */
export function bsearchLower(ticks: FrameTick[], t: number): number {
  let lo = 0;
  let hi = ticks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((ticks[mid]?.t ?? 0) < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Linear interpolation between the two ticks bracketing `t`.
 *  Falls back to the nearest tick when only one tick exists or `t` is out of range. */
export function lerpTick(ticks: FrameTick[], t: number): FrameTick | null {
  if (!ticks.length) return null;
  if (ticks.length === 1) return ticks[0] ?? null;

  const bIdx = bsearchLower(ticks, t);
  const aIdx = bIdx > 0 ? bIdx - 1 : 0;
  const a = ticks[aIdx]!;
  const b = ticks[bIdx] ?? a;

  if (a === b || b.t <= a.t) return a;

  const alpha = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
  if (alpha <= 0) return a;
  if (alpha >= 1) return b;

  const lm = a.lm.map((pa, i) => {
    const pb = b.lm[i];
    if (!pb) return pa;
    return {
      x: pa.x + (pb.x - pa.x) * alpha,
      y: pa.y + (pb.y - pa.y) * alpha,
      v: pa.v + (pb.v - pa.v) * alpha,
    };
  });

  const angles = { ...a.angles } as FrameTick["angles"];
  for (const k of Object.keys(a.angles) as (keyof FrameTick["angles"])[]) {
    const av = a.angles[k];
    const bv = b.angles[k];
    if (typeof av === "number" && typeof bv === "number") {
      (angles as Record<string, number>)[k] = av + (bv - av) * alpha;
    }
  }

  return { t, lm, angles, jr: a.jr };
}

/** Compute the video aspect ratio from a naturalSize event payload.
 *  Returns `null` when either dimension is non-positive (invalid event),
 *  so the caller can keep the existing fallback value unchanged. */
export function aspectFromNaturalSize(width: number, height: number): number | null {
  if (width > 0 && height > 0) return width / height;
  return null;
}

/** Handler for the Video `onReadyForDisplay` event.
 *  Calls `setAspect` with the computed ratio only when both dimensions are valid,
 *  so a bad event never overwrites the AsyncStorage fallback. */
export function handleVideoReadyForDisplay(
  event: { naturalSize: { width: number; height: number } },
  setAspect: (aspect: number) => void,
): void {
  const { width, height } = event.naturalSize;
  const aspect = aspectFromNaturalSize(width, height);
  if (aspect !== null) setAspect(aspect);
}
