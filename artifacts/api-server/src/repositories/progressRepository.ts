import { db, analysesTable } from "@workspace/db";
import { eq, and, asc, type SQL } from "drizzle-orm";

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

export async function findProgressEntriesForSport(userId: number, sport?: string | null) {
  const conditions: SQL<unknown>[] = [
    eq(analysesTable.userId, userId),
    ...(sport ? [eq(analysesTable.sport, sport)] : []),
  ];
  return db
    .select()
    .from(analysesTable)
    .where(and(...conditions))
    .orderBy(asc(analysesTable.uploadedAt));
}

export async function findProgressSummarySessions(userId: number, sport: string) {
  return db
    .select({
      uploadedAt: analysesTable.uploadedAt,
      overallScore: analysesTable.overallScore,
      techniqueScore: analysesTable.techniqueScore,
      movementType: analysesTable.movementType,
      jointAngles: analysesTable.jointAngles,
      jointRisks: analysesTable.jointRisks,
      biomechanicsApplied: analysesTable.biomechanicsApplied,
    })
    .from(analysesTable)
    .where(
      and(
        eq(analysesTable.userId, userId),
        eq(analysesTable.status, "complete"),
        eq(analysesTable.sport, sport),
      )
    )
    .orderBy(asc(analysesTable.uploadedAt));
}

export async function findPersonalRecordSessions(userId: number, sport?: string | null) {
  const conditions: SQL<unknown>[] = [
    eq(analysesTable.userId, userId),
    eq(analysesTable.status, "complete"),
    ...(sport ? [eq(analysesTable.sport, sport)] : []),
  ];
  return db
    .select()
    .from(analysesTable)
    .where(and(...conditions))
    .orderBy(asc(analysesTable.uploadedAt));
}
