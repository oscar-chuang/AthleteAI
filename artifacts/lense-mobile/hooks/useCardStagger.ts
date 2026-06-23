import { useState, useEffect } from "react";

const STAGGER_MS = 100;

/**
 * Stagger-animates a list of boolean flags from false → true.
 *
 * When `cardsVisible` flips to true the hook sets all card flags to true in
 * one synchronous state update. The visual stagger is produced by each
 * ScoreCard's own `delay` prop (passed at the call site), keeping the hook
 * simple and fully testable without timer mocking.
 *
 * Pass `instant = true` to skip even the delay-based visual stagger — used
 * when the animation has already played once for this analysis.
 *
 * @param cardsVisible - set true when the card grid becomes visible
 * @param count        - number of cards (length of the returned array)
 * @param instant      - when true, skip the stagger and start all entries true
 * @returns boolean[] — one entry per card, true once that card should appear
 */
export function useCardStagger(
  cardsVisible: boolean,
  count: number,
  instant = false,
): boolean[] {
  const [cardAnimated, setCardAnimated] = useState<boolean[]>(() =>
    Array(count).fill(instant),
  );

  useEffect(() => {
    if (instant) {
      setCardAnimated(Array(count).fill(true));
      return;
    }
    if (!cardsVisible || count === 0) return;
    // Flip all flags in one synchronous batch.  Visual stagger comes from
    // the `delay` prop passed to each ScoreCard at the render site.
    setCardAnimated(Array(count).fill(true));
  }, [cardsVisible, count, instant]);

  return cardAnimated;
}

export { STAGGER_MS };
