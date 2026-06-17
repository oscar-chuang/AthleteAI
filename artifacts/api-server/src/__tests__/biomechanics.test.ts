/**
 * Integration tests for the biomechanics write-guard logic.
 *
 * These tests execute the actual SQL WHERE conditions used in routes/analyses.ts
 * against the dev database so we get real Postgres semantics — not mocked ones.
 *
 * Key invariants under test:
 *   1. The create-time conditional write (WHERE biomechanicsApplied = false) is a
 *      NO-OP when biomechanicsApplied is already true — the guard prevents a slower
 *      create-time AI response from overwriting grounded biomechanics results.
 *   2. The biomechanics unconditional write (no guard on biomechanicsApplied) always
 *      succeeds, even if biomechanicsApplied is already true.
 *   3. The create-time conditional write proceeds normally when biomechanicsApplied
 *      is still false.
 *   4. The create-time failure handler (status="failed" with the same conditional
 *      guard) cannot demote a grounded analysis to "failed".
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { db, pool, analysesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────

let testUserId: number;
let testAnalysisId: number;

beforeAll(async () => {
  // Reuse an existing user so we don't need to manage the users table.
  const rows = await db.execute(sql`SELECT id FROM users ORDER BY id LIMIT 1`);
  const first = (rows as any).rows?.[0] ?? (rows as any)[0];
  testUserId = Number(first?.id);
  if (!testUserId) {
    throw new Error(
      "No users found in the dev database. Log in at least once to create a user before running these tests.",
    );
  }
});

afterAll(async () => {
  await pool.end();
});

async function createTestAnalysis(): Promise<number> {
  const [row] = await db
    .insert(analysesTable)
    .values({
      userId: testUserId,
      title: "__vitest_biomechanics_guard__",
      sport: "running",
      status: "processing",
      videoUrl: null,
      duration: null,
    })
    .returning({ id: analysesTable.id });
  return row.id;
}

async function getAnalysis(id: number) {
  const [row] = await db.select().from(analysesTable).where(eq(analysesTable.id, id));
  return row;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("biomechanics write-guard (SQL WHERE semantics)", () => {
  beforeEach(async () => {
    testAnalysisId = await createTestAnalysis();
  });

  afterEach(async () => {
    await db.delete(analysesTable).where(eq(analysesTable.id, testAnalysisId));
  });

  // ── Test 1 ─────────────────────────────────────────────────────────────────

  it("create-time conditional WHERE is a no-op when biomechanicsApplied=true", async () => {
    // Simulate: biomechanics PATCH lands first, marks the analysis as grounded.
    await db
      .update(analysesTable)
      .set({ biomechanicsApplied: true, status: "complete" })
      .where(eq(analysesTable.id, testAnalysisId));

    // Simulate: create-time AI response arrives late and tries to overwrite.
    // The WHERE clause in runAIAnalysis (isBiomechanics=false) guards this.
    await db
      .update(analysesTable)
      .set({ status: "processing" }) // would reset it if the guard were absent
      .where(
        and(
          eq(analysesTable.id, testAnalysisId),
          eq(analysesTable.biomechanicsApplied, false), // the guard
        ),
      );

    const row = await getAnalysis(testAnalysisId);
    expect(row.status).toBe("complete"); // guard prevented the overwrite
    expect(row.biomechanicsApplied).toBe(true);
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────

  it("create-time conditional WHERE proceeds when biomechanicsApplied=false", async () => {
    // Analysis has NOT been grounded yet — create-time write should succeed.
    await db
      .update(analysesTable)
      .set({ status: "complete" })
      .where(
        and(
          eq(analysesTable.id, testAnalysisId),
          eq(analysesTable.biomechanicsApplied, false),
        ),
      );

    const row = await getAnalysis(testAnalysisId);
    expect(row.status).toBe("complete");
    expect(row.biomechanicsApplied).toBe(false); // a create-time write never sets this flag
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────

  it("biomechanics unconditional WHERE always updates even if flag is already true", async () => {
    // Pre-ground the row with biomechanicsApplied=true (previous scan).
    await db
      .update(analysesTable)
      .set({ biomechanicsApplied: true, status: "complete" })
      .where(eq(analysesTable.id, testAnalysisId));

    // A re-scan runs the biomechanics write again — it should succeed unconditionally.
    await db
      .update(analysesTable)
      .set({ biomechanicsApplied: true, status: "complete" }) // re-grounds
      .where(eq(analysesTable.id, testAnalysisId));           // no biomechanicsApplied guard

    const row = await getAnalysis(testAnalysisId);
    expect(row.status).toBe("complete");
    expect(row.biomechanicsApplied).toBe(true);
  });

  // ── Test 4 ─────────────────────────────────────────────────────────────────

  it("create-time failure handler cannot demote a grounded analysis to failed", async () => {
    // Biomechanics finishes first.
    await db
      .update(analysesTable)
      .set({ biomechanicsApplied: true, status: "complete" })
      .where(eq(analysesTable.id, testAnalysisId));

    // Create-time AI call throws → the catch block tries status="failed" with the
    // same conditional guard.  This mirrors the catch in routes/analyses.ts (POST).
    await db
      .update(analysesTable)
      .set({ status: "failed" })
      .where(
        and(
          eq(analysesTable.id, testAnalysisId),
          eq(analysesTable.biomechanicsApplied, false), // guard prevents demotion
        ),
      );

    const row = await getAnalysis(testAnalysisId);
    expect(row.status).toBe("complete"); // grounded result is preserved
    expect(row.biomechanicsApplied).toBe(true);
  });
});
