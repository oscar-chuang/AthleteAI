/**
 * Shared utility for computing whether the profile-settings form has unsaved
 * changes relative to the last-saved snapshot.
 *
 * HOW TO ADD A NEW FIELD:
 *   1. Add it to ProfileSnapshot below.
 *   2. Include it in buildSnapshot() so it is serialised automatically.
 *   3. That's it — computeIsDirty is derived from the snapshot string, so you
 *      cannot accidentally omit the new field from the comparison.
 *
 * Fields that auto-save on tap (weeklyGoal, trainingDays, checkInHour,
 * avatarUrl) are intentionally excluded: they never have "pending" edits.
 */

export type ProfileSnapshot = {
  name: string;
  sport: string;
  level: string;
  goals: string[];
  injuries: string[];
};

/** Serialise a snapshot to a stable JSON string for equality comparison. */
export function buildSnapshot(s: ProfileSnapshot): string {
  return JSON.stringify(s);
}

/**
 * Returns true when `current` differs from `saved`.
 * Both arguments must be snapshot strings produced by `buildSnapshot`.
 */
export function computeIsDirty(current: string, saved: string): boolean {
  return current !== saved;
}
