import { Router, type IRouter, type Request, type Response } from "express";
import { db, analysesTable, profilesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "./auth";
import { analyzeAthletePerformance, detectSportFromFrame, type AIAnalysisResult } from "../lib/anthropic";

const router: IRouter = Router();

// The six joints the on-device pose skeleton measures.
const JOINT_KEYS = ["leftKnee", "rightKnee", "leftHip", "rightHip", "leftElbow", "rightElbow"] as const;
// A 640x360 JPEG data URL is ~30-60KB; cap well above that to reject abuse.
const MAX_FRAME_CHARS = 3_000_000;

function sanitizeJointAngles(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const k of JOINT_KEYS) {
    const v = src[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = Math.max(0, Math.min(200, v));
    }
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeJointRisks(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const k of JOINT_KEYS) {
    const v = src[k];
    if (typeof v === "number" && (v === 0 || v === 1 || v === 2)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

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
    biomechanicsApplied: a.biomechanicsApplied,
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
    // Only mark failed if a grounded biomechanics run has NOT already landed —
    // otherwise a slow create-time failure would clobber complete grounded results.
    db.update(analysesTable)
      .set({ status: "failed" })
      .where(and(eq(analysesTable.id, row!.id), eq(analysesTable.biomechanicsApplied, false)))
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
  jointRisks?: Record<string, number> | null,
  frameBase64?: string | null,
  isBiomechanics = false
) {
  const [profileRow] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  const athleteProfile = profileRow
    ? { name: profileRow.name, level: profileRow.level, goals: profileRow.goals ?? [], injuryConcerns: profileRow.injuryConcerns ?? [] }
    : null;

  const result: AIAnalysisResult = await analyzeAthletePerformance(sport, title, videoUrl, athleteProfile, jointAngles as any, jointRisks as any, frameBase64);

  const values = {
    status: "complete" as const,
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
  };

  if (isBiomechanics) {
    // Grounded run from the on-device pose scan — always wins. Mark the row so a
    // slower create-time run can never overwrite these results afterwards.
    await db.update(analysesTable)
      .set({ ...values, biomechanicsApplied: true })
      .where(eq(analysesTable.id, id));
  } else {
    // Create-time run with no measured data — only write if a biomechanics run
    // has not already landed (or is not in flight and finishing first).
    await db.update(analysesTable)
      .set(values)
      .where(and(eq(analysesTable.id, id), eq(analysesTable.biomechanicsApplied, false)));
  }

  console.log(`AI analysis complete for id=${id} (${sport}: ${title})${isBiomechanics ? " [biomechanics]" : ""}`);
}

router.post("/analyses/detect-sport", requireAuth, async (req: Request, res: Response) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) { res.status(400).json({ error: "imageBase64 required" }); return; }
  try {
    const sport = await detectSportFromFrame(imageBase64);
    res.json({ sport });
  } catch (err) {
    console.error("Sport detection failed:", err);
    res.json({ sport: "unknown" });
  }
});

router.get("/analyses/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }

  const [row] = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)));

  if (!row) { res.status(404).json({ error: "Analysis not found" }); return; }

  const storedTips = (row.tips ?? []) as Array<{
    tipType?: string; category: string; severity: string; title: string;
    videoObservation?: string; description: string; drill?: string; source?: string;
    joints?: string[];
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
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }

  const [row] = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)));

  if (!row) { res.status(404).json({ error: "Analysis not found" }); return; }

  const body = req.body as {
    jointAngles?: Record<string, unknown>;
    jointRisks?: Record<string, unknown>;
    frameBase64?: unknown;
  };

  // Validate the measured payload before trusting it. Only the six tracked joints
  // are accepted; angles are clamped to a sane range and risks to {0,1,2}.
  const jointAngles = sanitizeJointAngles(body.jointAngles);
  const jointRisks = sanitizeJointRisks(body.jointRisks);
  const frameBase64 =
    typeof body.frameBase64 === "string" && body.frameBase64.length <= MAX_FRAME_CHARS
      ? body.frameBase64
      : undefined;

  res.json({ success: true });

  // Mark as processing so the detail screen's poll resumes and picks up the
  // grounded results once the re-analysis finishes.
  await db.update(analysesTable)
    .set({ status: "processing" })
    .where(eq(analysesTable.id, row.id))
    .catch(() => {});

  // Re-run AI with actual measured joint angles + video frame — this grounded run
  // overrides the initial estimate and is protected from create-time overwrites.
  runAIAnalysis(row.id, userId, row.sport, row.title, row.videoUrl ?? undefined, jointAngles, jointRisks, frameBase64, true)
    .catch((err) => {
      console.error(`AI re-analysis failed for id=${id}:`, err);
      db.update(analysesTable)
        .set({ status: "complete" })
        .where(eq(analysesTable.id, row.id))
        .catch(() => {});
    });
});

router.delete("/analyses/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }

  await db
    .delete(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)));

  res.json({ success: true });
});

export default router;
