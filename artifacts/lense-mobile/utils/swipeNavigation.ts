export const SWIPE_THRESHOLD = 60;
export const SWIPE_VELOCITY_THRESHOLD = 0.4;

/**
 * Given an ordered list of session IDs and the current session's ID, returns
 * the adjacent IDs for prev/next navigation.  Mirrors the inline index math
 * in app/analysis/[id].tsx.
 */
export function resolveAdjacentIds(
  siblingIds: string[],
  id: string | null | undefined,
): { currIndex: number; prevId: string | null; nextId: string | null } {
  const currIndex = siblingIds.indexOf(id ?? "");
  const prevId = currIndex > 0 ? siblingIds[currIndex - 1] : null;
  const nextId =
    currIndex >= 0 && currIndex < siblingIds.length - 1
      ? siblingIds[currIndex + 1]
      : null;
  return { currIndex, prevId, nextId };
}

/**
 * Returns true when horizontal movement clearly dominates vertical — the
 * condition used in PanResponder.onMoveShouldSetPanResponder to decide whether
 * to claim the gesture for swipe navigation.
 *
 * Mirrors: Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 12
 */
export function shouldActivateSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 12;
}

/**
 * Decides which direction to navigate (if any) when the user lifts their
 * finger.  Returns "next", "prev", or "none".
 *
 * Mirrors the goNext / goPrev logic in PanResponder.onPanResponderRelease.
 */
export function resolveSwipeDirection(
  dx: number,
  vx: number,
  prevId: string | null,
  nextId: string | null,
): "next" | "prev" | "none" {
  const goNext =
    (dx < -SWIPE_THRESHOLD || vx < -SWIPE_VELOCITY_THRESHOLD) && !!nextId;
  const goPrev =
    (dx > SWIPE_THRESHOLD || vx > SWIPE_VELOCITY_THRESHOLD) && !!prevId;
  if (goNext) return "next";
  if (goPrev) return "prev";
  return "none";
}

/**
 * Returns the animated translation value to apply during a pan move.
 * Applies rubber-band resistance (× 0.18) when the user swipes toward a
 * boundary that has no adjacent session.
 *
 * Mirrors the onPanResponderMove logic in app/analysis/[id].tsx.
 */
export function resolveSwipeTranslation(
  dx: number,
  prevId: string | null,
  nextId: string | null,
): number {
  if ((dx > 0 && !prevId) || (dx < 0 && !nextId)) {
    return dx * 0.18;
  }
  return dx;
}
