import { db, analysesTable } from "@workspace/db";
import { eq, and, desc, max } from "drizzle-orm";

/**
 * Computes real-time streak and weekly progress for a user from their
 * completed analyses.  Used by both GET /profile and GET /auth/me so that
 * weeklyProgress and streakDays are never hard-coded to 0.
 *
 * Only uploadedAt is fetched (not all columns) to keep the query lightweight
 * even for users with hundreds of sessions.
 *
 * @param trainingDays - Array of day-of-week integers (0=Sun…6=Sat) that the
 *   user has designated as training days.  When provided, weeklyProgress only
 *   counts sessions that fall on one of those days.  When omitted (or empty),
 *   all sessions this week are counted (legacy behaviour).
 */
export async function computeProfileStats(
  userId: number,
  trainingDays?: number[]
): Promise<{ streak: number; weeklyProgress: number; lastWeekCount: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 86_400_000);

  const trainingDaySet =
    trainingDays && trainingDays.length > 0 ? new Set(trainingDays) : null;

  // Fetch only uploadedAt — not all columns — to minimise data transfer.
  const rows = await db
    .select({ uploadedAt: analysesTable.uploadedAt })
    .from(analysesTable)
    .where(and(eq(analysesTable.userId, userId), eq(analysesTable.status, "complete")))
    .orderBy(desc(analysesTable.uploadedAt));

  const dayKeys = new Set(
    rows.map((r) => {
      const d = new Date(r.uploadedAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  // Streak: consecutive calendar days ending today (or yesterday if today has no session).
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const check = new Date(today.getTime() - i * 86_400_000);
    if (dayKeys.has(check.getTime())) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  const weeklyProgress = rows.filter((r) => {
    const d = new Date(r.uploadedAt);
    if (d < weekStart) return false;
    if (trainingDaySet !== null && !trainingDaySet.has(d.getDay())) return false;
    return true;
  }).length;

  const lastWeekCount = rows.filter((r) => {
    const d = new Date(r.uploadedAt);
    if (d < lastWeekStart || d >= weekStart) return false;
    if (trainingDaySet !== null && !trainingDaySet.has(d.getDay())) return false;
    return true;
  }).length;

  return { streak, weeklyProgress, lastWeekCount };
}

/**
 * Returns the per-dimension personal-best scores for a user using SQL MAX
 * aggregates so the full analyses table is never loaded into JS memory.
 */
export async function computePersonalBests(userId: number): Promise<{
  overall: number; technique: number; power: number;
  balance: number; consistency: number; mobility: number; speed: number;
}> {
  const [row] = await db
    .select({
      overall:     max(analysesTable.overallScore),
      technique:   max(analysesTable.techniqueScore),
      power:       max(analysesTable.powerScore),
      balance:     max(analysesTable.balanceScore),
      consistency: max(analysesTable.consistencyScore),
      mobility:    max(analysesTable.mobilityScore),
      speed:       max(analysesTable.speedScore),
    })
    .from(analysesTable)
    .where(and(eq(analysesTable.userId, userId), eq(analysesTable.status, "complete")));

  return {
    overall:     row?.overall     ?? 0,
    technique:   row?.technique   ?? 0,
    power:       row?.power       ?? 0,
    balance:     row?.balance     ?? 0,
    consistency: row?.consistency ?? 0,
    mobility:    row?.mobility    ?? 0,
    speed:       row?.speed       ?? 0,
  };
}
