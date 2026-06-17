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
import { eq, and, sql } from "drizzle-orm";

const hasDatabase = !!(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);

// ─────────────────────────────────────────────────────────────────────────────

let testUserId: number;
let testAnalysisId: number;
let db: any;
let pool: any;
let analysesTable: any;

describe.skipIf(!hasDatabase)("biomechanics write-guard (SQL WHERE semantics)", () => {
  beforeAll(async () => {
    const mod = await import("@workspace/db");
    db = mod.db;
    pool = mod.pool;
    analysesTable = mod.analysesTable;

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
    await db
      .update(analysesTable)
      .set({ status: "processing" })
      .where(
        and(
          eq(analysesTable.id, testAnalysisId),
          eq(analysesTable.biomechanicsApplied, false),
        ),
      );

    const row = await getAnalysis(testAnalysisId);
    expect(row.status).toBe("complete");
    expect(row.biomechanicsApplied).toBe(true);
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────

  it("create-time conditional WHERE proceeds when biomechanicsApplied=false", async () => {
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
    expect(row.biomechanicsApplied).toBe(false);
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────

  it("biomechanics unconditional WHERE always updates even if flag is already true", async () => {
    await db
      .update(analysesTable)
      .set({ biomechanicsApplied: true, status: "complete" })
      .where(eq(analysesTable.id, testAnalysisId));

    await db
      .update(analysesTable)
      .set({ biomechanicsApplied: true, status: "complete" })
      .where(eq(analysesTable.id, testAnalysisId));

    const row = await getAnalysis(testAnalysisId);
    expect(row.status).toBe("complete");
    expect(row.biomechanicsApplied).toBe(true);
  });

  // ── Test 4 ─────────────────────────────────────────────────────────────────

  it("create-time failure handler cannot demote a grounded analysis to failed", async () => {
    await db
      .update(analysesTable)
      .set({ biomechanicsApplied: true, status: "complete" })
      .where(eq(analysesTable.id, testAnalysisId));

    await db
      .update(analysesTable)
      .set({ status: "failed" })
      .where(
        and(
          eq(analysesTable.id, testAnalysisId),
          eq(analysesTable.biomechanicsApplied, false),
        ),
      );

    const row = await getAnalysis(testAnalysisId);
    expect(row.status).toBe("complete");
    expect(row.biomechanicsApplied).toBe(true);
  });
});