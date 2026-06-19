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
 * Server-side durability:
 *   - When confetti fires, `persistCelebrationToServer` writes a local
 *     `confetti_server_sync_<weekKey>` marker BEFORE attempting the PATCH.
 *     On success the marker is cleared; on failure it is left so that
 *     `retryCelebrationSync` can re-attempt it on the next `loadData()` call.
 *   - `checkConfettiGate` accepts an optional `serverCelebratedWeekKey` (the
 *     `weeklyGoalCelebratedAt` value from the user's profile). When it matches
 *     `weekKey`, the gate treats the week as already celebrated, writes the
 *     local celebrated flag, and returns false — so confetti never re-fires
 *     after an app reinstall that wipes AsyncStorage.
 *
 * Returns `true` exactly once per week (when the goal is first crossed) and
 * `false` on every subsequent call.  The caller is responsible for triggering
 * the visual effect when this function returns `true`.
 *
 * @param weeklyGoal             The user's configured weekly session target (> 0).
 * @param currentCount           The number of sessions completed this week (from the API).
 * @param weekKey                A stable string representing the current ISO week, e.g.
 *                               the Sunday-start date "2025-06-15".
 * @param storage                An AsyncStorage-compatible interface (injectable for tests).
 * @param serverCelebratedWeekKey The `weeklyGoalCelebratedAt` value stored server-side on
 *                               the user's profile. When it matches `weekKey`, the gate
 *                               treats this week as already celebrated — even if local
 *                               AsyncStorage was wiped by an app reinstall.
 */

export interface AsyncStorageLike {
  getItem:    (key: string) => Promise<string | null>;
  setItem:    (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export async function checkConfettiGate(
  weeklyGoal:               number,
  currentCount:             number,
  weekKey:                  string,
  storage:                  AsyncStorageLike,
  serverCelebratedWeekKey?: string | null,
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

  // Server-side fallback: if the server recorded a celebration for this exact
  // week (survives app reinstall), sync the local flag and skip confetti.
  const alreadyCelebratedOnServer = serverCelebratedWeekKey === weekKey;
  if (!celebrated && alreadyCelebratedOnServer) {
    await storage.setItem(celebratedKey, "true");
    await storage.setItem(prevCountKey, String(currentCount));
    return false;
  }

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

/**
 * Durably persists the weekly-goal celebration flag to the server.
 *
 * Writes a local `confetti_server_sync_<weekKey>` marker BEFORE calling
 * `persistFn`. On success the marker is cleared; on failure it is left in
 * storage so `retryCelebrationSync` can re-attempt on the next load.
 *
 * @param weekKey   ISO week key, e.g. "2026-06-15".
 * @param storage   AsyncStorage-compatible interface.
 * @param persistFn Async function that sends the week key to the server.
 *                  Should also update any in-memory profile state.
 */
export async function persistCelebrationToServer(
  weekKey:    string,
  storage:    AsyncStorageLike,
  persistFn:  (weekKey: string) => Promise<void>,
): Promise<void> {
  const syncKey = `confetti_server_sync_${weekKey}`;
  // Write the marker first so it survives if the process is killed mid-write.
  await storage.setItem(syncKey, "true");
  try {
    await persistFn(weekKey);
    await storage.removeItem(syncKey);
  } catch {
    // Marker remains; retryCelebrationSync will pick it up on next loadData.
  }
}

/**
 * Retries a previously failed server-side celebration persistence, if any.
 *
 * Called at the start of each `loadData()`. If a `confetti_server_sync_<weekKey>`
 * marker exists, it means a prior `persistCelebrationToServer` call failed.
 * This function re-attempts `persistFn` and clears the marker on success.
 *
 * @param weekKey   ISO week key for the CURRENT week.
 * @param storage   AsyncStorage-compatible interface.
 * @param persistFn Async function that sends the week key to the server.
 */
export async function retryCelebrationSync(
  weekKey:    string,
  storage:    AsyncStorageLike,
  persistFn:  (weekKey: string) => Promise<void>,
): Promise<void> {
  const syncKey = `confetti_server_sync_${weekKey}`;
  const pending = await storage.getItem(syncKey);
  if (!pending) return;
  try {
    await persistFn(weekKey);
    await storage.removeItem(syncKey);
  } catch {
    // Leave marker; will retry on next loadData.
  }
}
