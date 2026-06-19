/**
 * Confetti gate utility — extracted from the Home screen `loadData` function.
 *
 * Determines whether a confetti burst should fire on the current load, based on
 * three AsyncStorage keys that track:
 *   - `confetti_celebrated_<weekKey>` — set to "true" once confetti has fired
 *     this week, preventing a double-fire.
 *   - `confetti_pending_<weekKey>`   — written by the Analyze screen the moment
 *     an upload pushes the session count to the goal (so the gate fires even if
 *     the Home screen has not yet polled for the new count).
 *   - `confetti_prev_count_<weekKey>` — the count snapshot from the previous
 *     load, used to detect when the threshold was just crossed.
 *
 * Returns `true` exactly once per week (when the goal is first crossed) and
 * `false` on every subsequent call.  The caller is responsible for triggering
 * the visual effect when this function returns `true`.
 *
 * @param weeklyGoal   The user's configured weekly session target (> 0).
 * @param currentCount The number of sessions completed this week (from the API).
 * @param weekKey      A stable string representing the current ISO week, e.g.
 *                     the Sunday-start date "2025-06-15".
 * @param storage      An AsyncStorage-compatible interface (injectable for tests).
 */

export interface AsyncStorageLike {
  getItem:    (key: string) => Promise<string | null>;
  setItem:    (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export async function checkConfettiGate(
  weeklyGoal:   number,
  currentCount: number,
  weekKey:      string,
  storage:      AsyncStorageLike,
): Promise<boolean> {
  if (weeklyGoal <= 0) return false;

  const celebratedKey = `confetti_celebrated_${weekKey}`;
  const pendingKey    = `confetti_pending_${weekKey}`;
  const prevCountKey  = `confetti_prev_count_${weekKey}`;

  const [celebrated, pending, prevCountStr] = await Promise.all([
    storage.getItem(celebratedKey),
    storage.getItem(pendingKey),
    storage.getItem(prevCountKey),
  ]);

  const prevCount = prevCountStr !== null ? parseInt(prevCountStr, 10) : null;

  // justCrossed: either an explicit pending flag from the Analyze screen, OR
  // the prevCount snapshot shows the count was below the goal last time.
  const justCrossed =
    pending !== null ||
    (prevCount !== null && prevCount < weeklyGoal);

  let fired = false;
  if (!celebrated && currentCount >= weeklyGoal && justCrossed) {
    await Promise.all([
      storage.setItem(celebratedKey, "true"),
      storage.removeItem(pendingKey),
    ]);
    fired = true;
  }

  // Always update the snapshot so the next load can detect a threshold crossing.
  await storage.setItem(prevCountKey, String(currentCount));

  return fired;
}
