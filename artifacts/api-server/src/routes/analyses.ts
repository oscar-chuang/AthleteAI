import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  analysesTable,
  coachingTipsTable,
  injuryRisksTable,
  progressEntriesTable,
  athleteProfilesTable,
  subscriptionsTable,
} from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";
import { generateAnalysis } from "../lib/claude.js";

const router = Router();

const createAnalysisSchema = z.object({
  title: z.string().min(1),
  sport: z.string().min(1),
  videoUrl: z.string().optional(),
  duration: z.number().positive().optional(),
  jointAngles: z.record(z.number()).optional(),
});

const FREE_TIER_LIMIT = 3;

// GET /api/analyses
router.get("/analyses", authenticate, async (req: AuthRequest, res) => {
  const rows = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.userId, req.userId!))
    .orderBy(desc(analysesTable.uploadedAt));

  res.json({ analyses: rows });
});

// POST /api/analyses
router.post("/analyses", authenticate, async (req: AuthRequest, res) => {
  const parsed = createAnalysisSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, req.userId!))
    .limit(1);

  if (subscription?.tier === "free") {
    const [{ total }] = await db
      .select({ total: count() })
      .from(analysesTable)
      .where(eq(analysesTable.userId, req.userId!));

    if (Number(total) >= FREE_TIER_LIMIT) {
      res.status(403).json({
        error: "Free plan limit reached",
        code: "UPGRADE_REQUIRED",
        message: `Free plan allows ${FREE_TIER_LIMIT} analyses. Upgrade to Pro for unlimited analyses.`,
      });
      return;
    }
  }

  const [profile] = await db
    .select()
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.userId, req.userId!))
    .limit(1);

  const [analysis] = await db
    .insert(analysesTable)
    .values({
      userId: req.userId!,
      title: parsed.data.title,
      sport: parsed.data.sport,
      videoUrl: parsed.data.videoUrl,
      duration: parsed.data.duration,
      status: "processing",
    })
    .returning();

  // Run AI analysis async - don't block the response
  runAnalysis(analysis.id, parsed.data, profile).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Analysis ${analysis.id} failed:`, msg);
    db.update(analysesTable)
      .set({ status: "failed" })
      .where(eq(analysesTable.id, analysis.id))
      .execute()
      .catch((dbErr: unknown) => console.error("Failed to mark analysis as failed:", dbErr));
  });

  res.status(202).json({ analysis });
});

// GET /api/analyses/:id
router.get("/analyses/:id", authenticate, async (req: AuthRequest, res) => {
  const [analysis] = await db
    .select()
    .from(analysesTable)
    .where(
      and(
        eq(analysesTable.id, Number(req.params.id)),
        eq(analysesTable.userId, req.userId!)
      )
    )
    .limit(1);

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const [tips, risks] = await Promise.all([
    db
      .select()
      .from(coachingTipsTable)
      .where(eq(coachingTipsTable.analysisId, analysis.id)),
    db
      .select()
      .from(injuryRisksTable)
      .where(eq(injuryRisksTable.analysisId, analysis.id)),
  ]);

  res.json({ analysis, tips, injuryRisks: risks });
});

// DELETE /api/analyses/:id
router.delete("/analyses/:id", authenticate, async (req: AuthRequest, res) => {
  const [deleted] = await db
    .delete(analysesTable)
    .where(
      and(
        eq(analysesTable.id, Number(req.params.id)),
        eq(analysesTable.userId, req.userId!)
      )
    )
    .returning({ id: analysesTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.json({ success: true });
});

async function runAnalysis(
  analysisId: number,
  input: {
    title: string;
    sport: string;
    duration?: number;
    jointAngles?: Record<string, number>;
  },
  profile: { level: string; goals: string[]; injuryConcerns: string[] } | undefined
) {
  const result = await generateAnalysis({
    sport: input.sport,
    title: input.title,
    level: profile?.level ?? "intermediate",
    duration: input.duration ?? 30,
    jointAngles: input.jointAngles,
    goals: profile?.goals,
    injuryConcerns: profile?.injuryConcerns,
  });

  await db
    .update(analysesTable)
    .set({
      status: "complete",
      overallScore: result.scores.overall,
      techniqueScore: result.scores.technique,
      powerScore: result.scores.power,
      balanceScore: result.scores.balance,
      consistencyScore: result.scores.consistency,
      mobilityScore: result.scores.mobility,
      speedScore: result.scores.speed,
      strengths: result.strengths,
      improvements: result.improvements,
    })
    .where(eq(analysesTable.id, analysisId));

  if (result.tips.length > 0) {
    await db.insert(coachingTipsTable).values(
      result.tips.map((t) => ({
        analysisId,
        category: t.category as any,
        severity: t.severity as any,
        title: t.title,
        description: t.description,
        drill: t.drill,
      }))
    );
  }

  if (result.injuryRisks.length > 0) {
    await db.insert(injuryRisksTable).values(
      result.injuryRisks.map((r) => ({
        analysisId,
        joint: r.joint,
        riskPercent: r.riskPercent,
        description: r.description,
        prevention: r.prevention,
      }))
    );
  }

  // Record progress entry
  await db.insert(progressEntriesTable).values({
    userId: (
      await db
        .select({ userId: analysesTable.userId })
        .from(analysesTable)
        .where(eq(analysesTable.id, analysisId))
        .limit(1)
    )[0]!.userId,
    date: new Date().toISOString().split("T")[0]!,
    overallScore: result.scores.overall,
    techniqueScore: result.scores.technique,
    powerScore: result.scores.power,
    balanceScore: result.scores.balance,
    consistencyScore: result.scores.consistency,
    mobilityScore: result.scores.mobility,
    speedScore: result.scores.speed,
  });
}

export default router;
