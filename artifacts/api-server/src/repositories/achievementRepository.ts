import { db, analysesTable, completedDrillsTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";

export async function findCompletedAnalyses(userId: number) {
  return db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.userId, userId), eq(analysesTable.status, "complete")))
    .orderBy(desc(analysesTable.uploadedAt));
}

export async function countCompletedDrills(userId: number): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(completedDrillsTable)
    .where(eq(completedDrillsTable.userId, userId));
  return result?.count ?? 0;
}
