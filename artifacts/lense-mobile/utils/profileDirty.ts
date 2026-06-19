/**
 * Shared utility for computing whether the profile-settings form has unsaved
 * changes relative to the last-saved snapshot.
 *
 * HOW TO ADD A NEW FIELD:
 *   1. Add it to ProfileSnapshot below.
 *   2. Include it in buildSnapshot() — TypeScript will enforce this for you.
 *      If you forget, the buildSnapshot call site(s) become a compile error.
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

/**
 * A mapped type that strips optionality from every key of T.
 * Used as the parameter type for buildSnapshot so that even optional fields
 * added to ProfileSnapshot in the future must be explicitly supplied at every
 * call site — omitting or misspelling any key is a compile error.
 */
type AllKeysRequired<T> = { [K in keyof T]-?: T[K] };

/** Serialise a snapshot to a stable JSON string for equality comparison. */
export function buildSnapshot(s: AllKeysRequired<ProfileSnapshot>): string {
  return JSON.stringify(s);
}

/**
 * Returns true when `current` differs from `saved`.
 * Both arguments must be snapshot strings produced by `buildSnapshot`.
 */
export function computeIsDirty(current: string, saved: string): boolean {
  return current !== saved;
}
