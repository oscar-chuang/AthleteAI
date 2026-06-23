import { Router, type IRouter, type Request, type Response } from "express";
import { db, analysesTable, completedDrillsTable } from "@workspace/db";
import { eq, and, desc, ne } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "./auth";
import { cache } from "../lib/redis";
import { enqueueBiomechanicsJob } from "../lib/queue";
import { aiRateLimit } from "../middleware/rateLimit";
import { resizeThumbnail } from "../lib/resize-thumbnail";
import {
  listAnalyses,
  createAnalysisEntry,
  detectSport,
  getJointTrends,
  getMovementSummaryHistory,
  getAnalysis,
  generateCoachingMomentsForAnalysis,
  generateMovementSummaryForAnalysis,
  getCompletedDrills,
  completeDrill,
  uncompleteDrill,
  deleteAnalysisEntry,
  validateVideoUrl,
  sanitizeJointAngles,
  sanitizeJointRisks,
  MAX_FRAME_CHARS,
  MAX_TITLE_LENGTH,
  MAX_SPORT_LENGTH,
  type CreateAnalysisBody,
} from "../services/analysisService";
import type { FlaggedMoment } from "../lib/anthropic";

// Re-export constants and helpers consumed by tests that import from this module.
export {
  validateVideoUrl,
  MAX_TITLE_LENGTH,
  MAX_SPORT_LENGTH,
  MAX_VIDEO_URL_BYTES,
} from "../services/analysisService";

const router: IRouter = Router();

router.get("/analyses", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const result = await listAnalyses(userId);
  res.json(result);
});

router.post("/analyses", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const body = req.body as CreateAnalysisBody;
  const result = await createAnalysisEntry(userId, body);
  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(result.status).json({ analysis: result.analysis });
});

router.post("/analyses/detect-sport", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) { res.status(400).json({ error: "imageBase64 required" }); return; }
  try {
    const result = await detectSport(imageBase64);
    res.json({ sport: result.sport, movementType: result.movementType });
  } catch (err) {
    console.error("Sport detection failed:", err);
    res.json({ sport: "unknown", movementType: "General" });
  }
});

// Must be declared before GET /analyses/:id so Express does not match "joint-trends" as :id.
router.get("/analyses/joint-trends", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const result = await getJointTrends(userId);
  res.json(result);
});

// Must be declared before GET /analyses/:id for the same reason.
router.get("/analyses/movement-summary-history", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const sport = typeof req.query["sport"] === "string" ? req.query["sport"].toLowerCase() : undefined;
  const result = await getMovementSummaryHistory(userId, sport);
  res.json(result);
});

router.get("/analyses/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }
  const result = await getAnalysis(id, userId);
  if (!result) { res.status(404).json({ error: "Analysis not found" }); return; }
  res.json(result);
});

// Zod schema for PATCH /analyses/:id — enforces types and length bounds before
// the existing sanitizers run. Unknown extra fields are stripped silently.
const patchAnalysisBodySchema = z.object({
  jointAngles:   z.record(z.string(), z.unknown()).optional(),
  jointRisks:    z.record(z.string(), z.unknown()).optional(),
  frameBase64:   z.string().max(MAX_FRAME_CHARS).optional(),
  title:         z.string().max(MAX_TITLE_LENGTH).optional(),
  sport:         z.string().max(MAX_SPORT_LENGTH).optional(),
  movementType:  z.string().max(80).optional(),
  videoUrl:      z.string().optional(),
});

router.patch("/analyses/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }

  const parseResult = patchAnalysisBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body", details: parseResult.error.flatten() });
    return;
  }
  const body = parseResult.data;

  const [row] = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)));

  if (!row) { res.status(404).json({ error: "Analysis not found" }); return; }

  // Validate the measured payload before trusting it. Only the six tracked joints
  // are accepted; angles are clamped to a sane range and risks to {0,1,2}.
  const jointAngles = sanitizeJointAngles(body.jointAngles);
  const jointRisks = sanitizeJointRisks(body.jointRisks);
  const frameBase64 = body.frameBase64 ?? undefined;
  const newSport = body.sport?.trim() ? body.sport.trim().toLowerCase() : null;
  const newMovementType = body.movementType?.trim() ? body.movementType.trim() : null;

  if (body.videoUrl) {
    const videoUrlError = validateVideoUrl(body.videoUrl);
    if (videoUrlError) {
      res.status(400).json({ error: videoUrlError });
      return;
    }
  }

  const hasMeasuredData = !!jointAngles || !!jointRisks || !!frameBase64;

  // Detect joint risk improvements vs the most recent prior biomechanics scan.
  // Must run before res.json() so the PATCH response carries the improvement list
  // for the mobile client to schedule a local notification.
  const improvements: Array<{ joint: string; oldRisk: number; newRisk: number }> = [];
  if (jointRisks) {
    const [prevScan] = await db
      .select({ jointRisks: analysesTable.jointRisks })
      .from(analysesTable)
      .where(
        and(
          eq(analysesTable.userId, userId),
          eq(analysesTable.biomechanicsApplied, true),
          ne(analysesTable.id, id),
        )
      )
      .orderBy(desc(analysesTable.uploadedAt))
      .limit(1);

    if (prevScan?.jointRisks) {
      const prevRisks = prevScan.jointRisks as Record<string, number>;
      for (const [joint, newRisk] of Object.entries(jointRisks)) {
        const oldRisk = prevRisks[joint];
        if (typeof oldRisk === "number" && newRisk < oldRisk) {
          improvements.push({ joint, oldRisk, newRisk });
        }
      }
    }
  }

  // Sport-only correction (no measured data): persist the corrected sport and/or
  // movement type without re-running AI. The authoritative grounded run happens when
  // the skeleton scan later PATCHes joint angles, and it will use this corrected sport.
  if ((newSport || newMovementType) && !hasMeasuredData) {
    try {
      await db.update(analysesTable)
        .set({
          ...(newSport ? { sport: newSport } : {}),
          ...(newMovementType ? { movementType: newMovementType } : {}),
        })
        .where(eq(analysesTable.id, row.id));
    } catch (err) {
      console.error(`Sport/movement correction failed for id=${id}:`, err);
      res.status(500).json({ error: "Failed to update sport" });
      return;
    }
    res.json({ success: true });
    return;
  }

  // Nothing actionable: no measured scan data and no sport/movement correction.
  if (!hasMeasuredData) {
    res.status(400).json({ error: "No measured data or sport correction provided" });
    return;
  }

  // Acquire a distributed lock so two simultaneous PATCH calls cannot both trigger
  // a biomechanics run on the same analysis. If the lock is already held return 409.
  const lockKey = `lock:analysis:${id}`;
  const lockAcquired = await cache.acquireLock(lockKey, 30_000);
  if (!lockAcquired) {
    res.status(409).json({ error: "Analysis is already being processed" });
    return;
  }

  // Stale completed-drill records are orphaned by the re-scan. Delete them so the
  // client can rely on PATCH success meaning drills are cleared.
  await db.delete(completedDrillsTable)
    .where(eq(completedDrillsTable.analysisId, row.id))
    .catch((err) => { console.error(`Failed to clear completed drills for id=${id}:`, err); });

  // Snapshot the worst-frame JPEG as the thumbnail and persist measured joint data.
  const thumbnailUrl = frameBase64 ? await resizeThumbnail(frameBase64) : undefined;
  await db.update(analysesTable)
    .set({
      status: "processing",
      ...(newSport ? { sport: newSport } : {}),
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      ...(jointAngles ? { jointAngles } : {}),
      ...(jointRisks ? { jointRisks } : {}),
    })
    .where(eq(analysesTable.id, row.id))
    .catch(() => {});

  // Return 202 immediately — the mobile polling loop picks up status: 'complete'
  // once the worker finishes. Include improvements so the client can schedule
  // local notifications without waiting for the full result.
  res.status(202).json({ status: "processing", improvements });

  // Enqueue the grounded biomechanics AI run. The worker holds the lock and
  // releases it after writing biomechanicsApplied=true.
  await enqueueBiomechanicsJob({
    analysisId: row.id,
    userId,
    frameBase64: frameBase64 ?? null,
  }).catch((err) => {
    console.error(`Failed to enqueue biomechanics job for id=${id}:`, err);
    cache.releaseLock(lockKey).catch(() => {});
    db.update(analysesTable)
      .set({ status: "failed" })
      .where(and(eq(analysesTable.id, row.id), eq(analysesTable.biomechanicsApplied, false)))
      .catch(() => {});
  });
});

router.post("/analyses/:id/coaching-moments", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }
  const rawFlaggedMoments: FlaggedMoment[] = Array.isArray(req.body?.flaggedMoments)
    ? (req.body.flaggedMoments as FlaggedMoment[])
    : [];
  try {
    const result = await generateCoachingMomentsForAnalysis(id, userId, rawFlaggedMoments);
    if ("error" in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ moments: result.moments });
  } catch (err) {
    console.error("generateCoachingMoments failed:", err);
    res.status(500).json({ error: "Failed to generate coaching moments" });
  }
});

router.post("/analyses/:id/movement-summary", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }
  const tickStats = req.body?.tickStats as { joints?: Record<string, { avgAngle: number; maxRisk: number; timesFlag: number }> } | null;
  try {
    const result = await generateMovementSummaryForAnalysis(id, userId, tickStats);
    if ("error" in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ summary: result.summary });
  } catch (err) {
    console.error("generateMovementSummary failed:", err);
    res.status(500).json({ error: "Failed to generate movement summary" });
  }
});

router.get("/analyses/:id/drills/completed", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }
  const result = await getCompletedDrills(id, userId);
  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ completedTipIds: result.completedTipIds });
});

router.post("/analyses/:id/drills/:tipId/complete", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  const tipId = String(req.params["tipId"] ?? "").trim();
  if (isNaN(id) || !tipId) { res.status(400).json({ error: "Invalid request" }); return; }
  const drillName = typeof req.body?.drillName === "string" ? req.body.drillName.slice(0, 200) : null;
  const result = await completeDrill(id, userId, tipId, drillName);
  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ success: true });
});

router.delete("/analyses/:id/drills/:tipId/complete", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  const tipId = String(req.params["tipId"] ?? "").trim();
  if (isNaN(id) || !tipId) { res.status(400).json({ error: "Invalid request" }); return; }
  const result = await uncompleteDrill(id, userId, tipId);
  res.json({ success: result.success });
});

router.delete("/analyses/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }
  const result = await deleteAnalysisEntry(id, userId);
  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ success: true });
});

export default router;
