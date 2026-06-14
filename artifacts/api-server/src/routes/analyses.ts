import { Router, type IRouter, type Request, type Response } from "express";
import { db, analysesTable, profilesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "./auth";
import { analyzeAthletePerformance, type AIAnalysisResult } from "../lib/anthropic";

const router: IRouter = Router();

function formatAnalysis(a: typeof analysesTable.$inferSelect) {
  return {
    id: String(a.id),
    userId: String(a.userId),
    title: a.title,
    sport: a.sport,
    status: a.status,
    videoUrl: a.videoUrl ?? undefined,
    thumbnailUrl: a.thumbnailUrl ?? undefined,
    duration: a.duration ?? undefined,
    overallScore: a.overallScore ?? undefined,
    techniqueScore: a.techniqueScore ?? undefined,
    powerScore: a.powerScore ?? undefined,
    balanceScore: a.balanceScore ?? undefined,
    consistencyScore: a.consistencyScore ?? undefined,
    mobilityScore: a.mobilityScore ?? undefined,
    speedScore: a.speedScore ?? undefined,
    strengths: a.strengths ?? [],
    improvements: a.improvements ?? [],
    uploadedAt: a.uploadedAt.toISOString(),
  };
}

router.get("/analyses", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const rows = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.userId, userId))
    .orderBy(desc(analysesTable.uploadedAt));
  res.json({ analyses: rows.map(formatAnalysis) });
});

router.post("/analyses", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const { title, sport, videoUrl, duration } = req.body as {
    title?: string; sport?: string; videoUrl?: string; duration?: number;
  };

  if (!title || !sport) {
    res.status(400).json({ error: "title and sport are required" });
    return;
  }

  const [row] = await db.insert(analysesTable).values({
    userId,
    title,
    sport: sport.toLowerCase(),
    status: "processing",
    videoUrl: videoUrl ?? null,
    duration: duration ?? null,
  }).returning();

  res.status(201).json({ analysis: formatAnalysis(row!) });

  runAIAnalysis(row!.id, userId, sport, title, videoUrl).catch((err) => {
    console.error(`AI analysis failed for id=${row!.id}:`, err);
    db.update(analysesTable)
      .set({ status: "failed" })
      .where(eq(analysesTable.id, row!.id))
      .catch(() => {});
  });
});

async function runAIAnalysis(
  id: number,
  userId: number,
  sport: string,
  title: string,
  videoUrl?: string,
  jointAngles?: Record<string, number> | null,
  jointRisks?: Record<string, number> | null
) {
  const [profileRow] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  const athleteProfile = profileRow
    ? { name: profileRow.name, level: profileRow.level, goals: profileRow.goals ?? [], injuryConcerns: profileRow.injuryConcerns ?? [] }
    : null;

  const result: AIAnalysisResult = await analyzeAthletePerformance(sport, title, videoUrl, athleteProfile, jointAngles as any, jointRisks as any);

  await db.update(analysesTable)
    .set({
      status: "complete",
      overallScore: result.overallScore,
      techniqueScore: result.techniqueScore,
      powerScore: result.powerScore,
      balanceScore: result.balanceScore,
      consistencyScore: result.consistencyScore,
      mobilityScore: result.mobilityScore,
      speedScore: result.speedScore,
      strengths: result.strengths,
      improvements: result.improvements,
      tips: result.tips as unknown as object[],
      injuryRisks: result.injuryRisks as unknown as object[],
    })
    .where(eq(analysesTable.id, id));

  console.log(`AI analysis complete for id=${id} (${sport}: ${title})`);
}

router.get("/analyses/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }

  const [row] = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)));

  if (!row) { res.status(404).json({ error: "Analysis not found" }); return; }

  const storedTips = (row.tips ?? []) as Array<{
    category: string; severity: string; title: string; description: string; drill?: string;
  }>;
  const storedRisks = (row.injuryRisks ?? []) as Array<{
    joint: string; riskPercent: number; description: string; prevention: string;
  }>;

  const tips = storedTips.map((t, i) => ({ id: String(i + 1), ...t }));
  const injuryRisks = storedRisks.map((r, i) => ({ id: String(i + 1), ...r }));

  res.json({ analysis: formatAnalysis(row), tips, injuryRisks });
});

router.patch("/analyses/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }

  const [row] = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)));

  if (!row) { res.status(404).json({ error: "Analysis not found" }); return; }

  const { jointAngles, jointRisks } = req.body as {
    jointAngles?: Record<string, number>;
    jointRisks?: Record<string, number>;
  };

  res.json({ success: true });

  // Re-run AI with actual measured joint angles — overrides the initial estimate
  runAIAnalysis(row.id, userId, row.sport, row.title, row.videoUrl ?? undefined, jointAngles, jointRisks)
    .catch((err) => {
      console.error(`AI re-analysis failed for id=${id}:`, err);
    });
});

router.delete("/analyses/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }

  await db
    .delete(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)));

  res.json({ success: true });
});

export default router;
