import { db, chatMessagesTable, analysesTable, completedDrillsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

export type ChatMessageRow = typeof chatMessagesTable.$inferSelect;

export async function findMessages(userId: number, limit: number): Promise<ChatMessageRow[]> {
  return db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, userId))
    .orderBy(chatMessagesTable.createdAt)
    .limit(limit);
}

export async function createMessage(data: {
  userId: number;
  role: string;
  content: string;
  referencedAnalysisId?: number | null;
}): Promise<ChatMessageRow> {
  const [row] = await db
    .insert(chatMessagesTable)
    .values(data)
    .returning();
  return row!;
}

export async function deleteMessages(userId: number): Promise<void> {
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.userId, userId));
}

export async function findAnalysisOwnership(
  analysisId: number,
  userId: number,
): Promise<{ id: number } | undefined> {
  const [row] = await db
    .select({ id: analysesTable.id })
    .from(analysesTable)
    .where(and(eq(analysesTable.id, analysisId), eq(analysesTable.userId, userId)))
    .limit(1);
  return row;
}

export async function findRecentAnalyses(userId: number, limit: number) {
  return db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.userId, userId), eq(analysesTable.status, "complete")))
    .orderBy(desc(analysesTable.uploadedAt))
    .limit(limit);
}

export async function findLatestCompletedAnalysis(userId: number) {
  const [row] = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.userId, userId), eq(analysesTable.status, "complete")))
    .orderBy(desc(analysesTable.uploadedAt))
    .limit(1);
  return row;
}

export async function findAllCompletedDrills(userId: number) {
  return db
    .select()
    .from(completedDrillsTable)
    .where(eq(completedDrillsTable.userId, userId))
    .orderBy(desc(completedDrillsTable.completedAt));
}
