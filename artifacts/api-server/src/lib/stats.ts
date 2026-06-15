import { db, analysesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

/**
 * Computes real-time streak and weekly progress for a user from their
 * completed analyses.  Used by both GET /profile and GET /auth/me so that
 * weeklyProgress and streakDays are never hard-coded to 0.
 */
export async function computeProfileStats(
  userId: number
): Promise<{ streak: number; weeklyProgress: number }> {
  const rows = await db
    .select({ uploadedAt: analysesTable.uploadedAt })
    .from(analysesTable)
    .where(and(eq(analysesTable.userId, userId), eq(analysesTable.status, "complete")))
    .orderBy(desc(analysesTable.uploadedAt));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayKeys = new Set(
    rows.map((r) => {
      const d = new Date(r.uploadedAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const check = new Date(today.getTime() - i * 86_400_000);
    if (dayKeys.has(check.getTime())) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weeklyProgress = rows.filter((r) => new Date(r.uploadedAt) >= weekStart).length;

  return { streak, weeklyProgress };
}
