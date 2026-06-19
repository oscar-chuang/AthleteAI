import { useState, useEffect } from "react";

/**
 * Stagger-animates a list of boolean flags from false → true.
 *
 * When `cardsVisible` flips to true the hook schedules a setTimeout for each
 * index i, firing at i * 100 ms, setting cardAnimated[i] = true in sequence.
 * This is used by the analysis detail screen to stagger sub-score ring
 * animations as the score grid scrolls into view.
 *
 * Pass `instant = true` to skip the stagger entirely and return all entries
 * as true immediately — used when the animation has already played once for
 * this analysis (return-visit guard).
 *
 * @param cardsVisible - set true when the card grid becomes visible
 * @param count        - number of cards (length of the returned array)
 * @param instant      - when true, skip the stagger and start all entries true
 * @returns boolean[] — one entry per card, true once that card's animation fires
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
      // Return-visit: show all rings immediately without staggering.
      setCardAnimated(Array(count).fill(true));
      return;
    }
    if (!cardsVisible) return;
    for (let i = 0; i < count; i++) {
      const idx = i; // capture for closure
      setTimeout(() => {
        setCardAnimated((prev) => {
          const next = [...prev];
          next[idx] = true;
          return next;
        });
      }, idx * 100);
    }
  }, [cardsVisible, count, instant]);

  return cardAnimated;
}
