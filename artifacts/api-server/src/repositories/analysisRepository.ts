import { db, analysesTable, completedDrillsTable } from "@workspace/db";
import { eq, and, desc, ne, asc } from "drizzle-orm";

export type AnalysisRow = typeof analysesTable.$inferSelect;
export type NewAnalysis = typeof analysesTable.$inferInsert;

export async function findAnalysesByUserId(userId: number): Promise<AnalysisRow[]> {
  return db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.userId, userId))
    .orderBy(desc(analysesTable.uploadedAt));
}

export async function findAnalysisById(id: number, userId: number): Promise<AnalysisRow | undefined> {
  const [row] = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)));
  return row;
}

export async function findAnalysisOwnership(id: number, userId: number): Promise<{ id: number } | undefined> {
  const [row] = await db
    .select({ id: analysesTable.id })
    .from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)))
    .limit(1);
  return row;
}

export async function createAnalysis(data: NewAnalysis): Promise<AnalysisRow> {
  const [row] = await db.insert(analysesTable).values(data).returning();
  return row!;
}

export async function updateAnalysis(id: number, data: Partial<AnalysisRow>): Promise<void> {
  await db.update(analysesTable).set(data).where(eq(analysesTable.id, id));
}

export async function updateAnalysisIfNotGrounded(id: number, data: Partial<AnalysisRow>): Promise<void> {
  await db
    .update(analysesTable)
    .set(data)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.biomechanicsApplied, false)));
}

export async function deleteAnalysis(id: number, userId: number): Promise<{ id: number }[]> {
  return db
    .delete(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)))
    .returning({ id: analysesTable.id });
}

export async function findJointTrendSessions(userId: number) {
  return db
    .select({
      id: analysesTable.id,
      sport: analysesTable.sport,
      uploadedAt: analysesTable.uploadedAt,
      jointAngles: analysesTable.jointAngles,
      jointRisks: analysesTable.jointRisks,
    })
    .from(analysesTable)
    .where(
      and(
        eq(analysesTable.userId, userId),
        eq(analysesTable.biomechanicsApplied, true),
      )
    )
    .orderBy(analysesTable.uploadedAt);
}

export async function findMovementSummaryHistory(userId: number) {
  return db
    .select({
      id: analysesTable.id,
      sport: analysesTable.sport,
      uploadedAt: analysesTable.uploadedAt,
      movementSummary: analysesTable.movementSummary,
    })
    .from(analysesTable)
    .where(eq(analysesTable.userId, userId))
    .orderBy(analysesTable.uploadedAt);
}

export async function findPrevBiomechanicsScan(
  userId: number,
  excludeId: number,
): Promise<{ jointRisks: unknown } | undefined> {
  const [row] = await db
    .select({ jointRisks: analysesTable.jointRisks })
    .from(analysesTable)
    .where(
      and(
        eq(analysesTable.userId, userId),
        eq(analysesTable.biomechanicsApplied, true),
        ne(analysesTable.id, excludeId),
      )
    )
    .orderBy(desc(analysesTable.uploadedAt))
    .limit(1);
  return row;
}

export async function findCompletedDrills(userId: number, analysisId: number) {
  return db
    .select()
    .from(completedDrillsTable)
    .where(and(eq(completedDrillsTable.userId, userId), eq(completedDrillsTable.analysisId, analysisId)));
}

export async function findCompletedDrill(userId: number, analysisId: number, tipId: string) {
  const [row] = await db
    .select({ id: completedDrillsTable.id })
    .from(completedDrillsTable)
    .where(and(
      eq(completedDrillsTable.userId, userId),
      eq(completedDrillsTable.analysisId, analysisId),
      eq(completedDrillsTable.tipId, tipId),
    ))
    .limit(1);
  return row;
}

export async function createCompletedDrill(data: {
  userId: number;
  analysisId: number;
  tipId: string;
  drillName: string | null;
}): Promise<void> {
  await db.insert(completedDrillsTable).values(data);
}

export async function deleteCompletedDrill(userId: number, analysisId: number, tipId: string): Promise<void> {
  await db
    .delete(completedDrillsTable)
    .where(and(
      eq(completedDrillsTable.userId, userId),
      eq(completedDrillsTable.analysisId, analysisId),
      eq(completedDrillsTable.tipId, tipId),
    ));
}

export async function deleteCompletedDrillsByAnalysis(analysisId: number): Promise<void> {
  await db.delete(completedDrillsTable).where(eq(completedDrillsTable.analysisId, analysisId));
}

export async function findCompletedAnalyses(userId: number): Promise<AnalysisRow[]> {
  return db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.userId, userId), eq(analysesTable.status, "complete")))
    .orderBy(desc(analysesTable.uploadedAt));
}

export async function findProgressEntries(userId: number, sport?: string | null) {
  const conditions = [
    eq(analysesTable.userId, userId),
    ...(sport ? [eq(analysesTable.sport, sport)] : []),
  ];
  return db
    .select()
    .from(analysesTable)
    .where(and(...conditions))
    .orderBy(asc(analysesTable.uploadedAt));
}

export async function findSportDistribution(userId: number) {
  return db
    .select({
      sport: analysesTable.sport,
      movementType: analysesTable.movementType,
    })
    .from(analysesTable)
    .where(
      and(
        eq(analysesTable.userId, userId),
        eq(analysesTable.status, "complete"),
      )
    );
}
