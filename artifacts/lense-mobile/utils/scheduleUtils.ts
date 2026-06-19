/**
 * Utilities for computing the weekly training schedule summary label
 * shown on the Home screen "This Week" card.
 *
 * Abbreviated day labels, indexed by JavaScript's getDay() value (0 = Sun).
 */
export const SCHEDULE_DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/**
 * Build the compact schedule summary string (e.g. "M · W · F") from an
 * array of training-day indices (0 = Sun … 6 = Sat).
 *
 * Returns `null` when all 7 days are active — the label is intentionally
 * hidden in that case because "every day" needs no annotation.
 *
 * Duplicate indices are deduplicated automatically.
 */
export function computeScheduleSummary(trainingDays: number[]): string | null {
  const trainingDaysSet = new Set<number>(trainingDays);
  if (trainingDaysSet.size === 7) return null;
  return Array.from(trainingDaysSet)
    .sort((a, b) => a - b)
    .map((d) => SCHEDULE_DAY_LABELS[d])
    .join(" · ");
}
