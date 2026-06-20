import { type JointImprovement } from "./api";

/**
 * Returns the single most-improved joint from a list of joint improvement
 * records, or null when no positive improvement exists.
 *
 * "Most improved" is defined as the entry where `improved === true` AND
 * `deltaDeg > 0`, with the highest `deltaDeg` winning ties.
 */
export function computeMostImproved(
  improvements: JointImprovement[] | null | undefined
): JointImprovement | null {
  if (!improvements?.length) return null;
  const positives = improvements.filter((i) => i.improved && i.deltaDeg > 0);
  if (!positives.length) return null;
  return positives.reduce((best, cur) => (cur.deltaDeg > best.deltaDeg ? cur : best));
}
