import { Router, type IRouter, type Request, type Response } from "express";
import { db, analysesTable, profilesTable, completedDrillsTable } from "@workspace/db";
import { eq, and, desc, ne } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "./auth";
import { analyzeAthletePerformance, detectSportFromFrame, generateCoachingMoments, generateMovementSummary, type AIAnalysisResult, type FlaggedMoment, type JointAngles, type JointRisks } from "../lib/anthropic";
import { resizeThumbnail } from "../lib/resize-thumbnail";
import { cache } from "../lib/redis";
import { enqueueBiomechanicsJob } from "../lib/queue";
import { aiRateLimit } from "../middleware/rateLimit";

const router: IRouter = Router();

// The six joints the on-device pose skeleton measures.
const JOINT_KEYS = ["leftKnee", "rightKnee", "leftHip", "rightHip", "leftElbow", "rightElbow"] as const;
// A 640x360 JPEG data URL is ~30-60KB; cap well above that to reject abuse.
const MAX_FRAME_CHARS = 3_000_000;
export const MAX_TITLE_LENGTH = 120;
export const MAX_SPORT_LENGTH = 60;
// videoUrl must be a real URL, never inline base64. 4096 bytes is well above
// any plausible URL length and well below any base64-encoded video payload.
export const MAX_VIDEO_URL_BYTES = 4_096;

/**
 * Return an error string if `value` looks like an inline base64 payload rather
 * than a real URL, or if it exceeds the URL length cap. Returns null when valid.
 */
export function validateVideoUrl(value: string): string | null {
  if (value.startsWith("data:")) {
    return "videoUrl must be a URL, not an inline data URI";
  }
  if (Buffer.byteLength(value, "utf8") > MAX_VIDEO_URL_BYTES) {
    return `videoUrl must be ${MAX_VIDEO_URL_BYTES} bytes or fewer`;
  }
  return null;
}

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
    movementType: a.movementType ?? undefined,
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
    jointAngles: a.jointAngles ?? undefined,
    jointRisks: a.jointRisks ?? undefined,
    biomechanicsApplied: a.biomechanicsApplied,
    coachingMoments: (a.coachingMoments as object[] | null) ?? undefined,
    movementSummary: (a.movementSummary as object | null) ?? undefined,
    movementSummaryAt: a.movementSummaryAt?.toISOString() ?? undefined,
    uploadedAt: a.uploadedAt.toISOString(),
  };
}

router.get("/analyses", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.userId, userId))
    .orderBy(desc(analysesTable.uploadedAt));
  res.json({ analyses: rows.map(formatAnalysis) });
});

router.post("/analyses", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { title, sport, videoUrl, duration, movementType } = req.body as {
    title?: string; sport?: string; videoUrl?: string; duration?: number; movementType?: string;
  };

  if (!title || !sport) {
    res.status(400).json({ error: "title and sport are required" });
    return;
  }
  if (title.length > MAX_TITLE_LENGTH) {
    res.status(400).json({ error: `title must be ${MAX_TITLE_LENGTH} characters or fewer` });
    return;
  }
  if (sport.length > MAX_SPORT_LENGTH) {
    res.status(400).json({ error: `sport must be ${MAX_SPORT_LENGTH} characters or fewer` });
    return;
  }
  if (videoUrl !== undefined && videoUrl !== null) {
    const videoUrlError = validateVideoUrl(videoUrl);
    if (videoUrlError) {
      res.status(400).json({ error: videoUrlError });
      return;
    }
  }

  const sanitizedMovementType =
    typeof movementType === "string" && movementType.trim().length > 0 && movementType.trim().length <= 80
      ? movementType.trim()
      : null;

  const [row] = await db.insert(analysesTable).values({
    userId,
    title,
    sport: sport.toLowerCase(),
    status: "processing",
    videoUrl: videoUrl ?? null,
    duration: duration ?? null,
    movementType: sanitizedMovementType,
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

  const result: AIAnalysisResult = await analyzeAthletePerformance(sport, title, videoUrl, athleteProfile, jointAngles as JointAngles | null, jointRisks as JointRisks | null, frameBase64);

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

router.post("/analyses/detect-sport", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) { res.status(400).json({ error: "imageBase64 required" }); return; }
  try {
    const result = await detectSportFromFrame(imageBase64);
    res.json({ sport: result.sport, movementType: result.movementType });
  } catch (err) {
    console.error("Sport detection failed:", err);
    res.json({ sport: "unknown", movementType: "General" });
  }
});

// Returns per-joint angle history across all biomechanics-grounded analyses for
// the user. Only sessions that actually have a skeleton scan (jointAngles populated)
// are included. The response also includes an "improvements" array flagging joints
// where the measured angle moved meaningfully in the right direction.
// IMPORTANT: this route must be declared before GET /analyses/:id so Express does
// not swallow "joint-trends" as an :id value.
router.get("/analyses/joint-trends", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;

  const rows = await db
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

  // Keep only sessions that have measured joint angles.
  const sessions = rows.filter((r) => r.jointAngles && Object.keys(r.jointAngles).length > 0);

  // Build per-joint history arrays.
  const jointHistory: Record<string, Array<{
    analysisId: string;
    date: string;
    sport: string;
    angle: number;
    risk: number;
  }>> = {};

  for (const session of sessions) {
    const angles = session.jointAngles as Record<string, number>;
    const risks = (session.jointRisks ?? {}) as Record<string, number>;
    for (const [joint, angle] of Object.entries(angles)) {
      if (!jointHistory[joint]) jointHistory[joint] = [];
      jointHistory[joint]!.push({
        analysisId: String(session.id),
        date: session.uploadedAt.toISOString(),
        sport: session.sport,
        angle,
        risk: risks[joint] ?? 0,
      });
    }
  }

  // Detect meaningful improvements per joint.
  // "Improved" = the most recent entry has a lower risk level than the earliest,
  // or the risk level is the same but angle shifted >= 5° with stable/lower risk.
  const improvements: Array<{
    joint: string;
    deltaDeg: number;
    sessions: number;
    improved: boolean;
  }> = [];

  for (const [joint, history] of Object.entries(jointHistory)) {
    if (history.length < 2) continue;
    const first = history[0]!;
    const last = history[history.length - 1]!;
    const deltaDeg = Math.round(last.angle - first.angle);
    const riskDelta = first.risk - last.risk;
    const improved = riskDelta > 0 || (riskDelta === 0 && Math.abs(deltaDeg) >= 5 && last.risk < 2);
    if (improved || Math.abs(deltaDeg) >= 3) {
      improvements.push({ joint, deltaDeg, sessions: history.length, improved });
    }
  }

  res.json({ joints: jointHistory, improvements });
});

// ─── Movement summary score history ───────────────────────────────────────────
// Returns per-session movement summary dimension scores for the requesting user.
// Only sessions that already have a completed movementSummary (overallScore set)
// are included. Optionally filter by ?sport=<sport>.
// IMPORTANT: must be declared before GET /analyses/:id for the same reason as
// joint-trends — to prevent Express from treating the path as an :id value.
router.get("/analyses/movement-summary-history", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const sport = typeof req.query.sport === "string" ? req.query.sport.toLowerCase() : undefined;

  type SummaryShape = {
    flowScore?: number;
    efficiencyScore?: number;
    bodyControlScore?: number;
    consistencyScore?: number;
    rhythmScore?: number;
    overallScore?: number;
  };

  const rows = await db
    .select({
      id: analysesTable.id,
      sport: analysesTable.sport,
      uploadedAt: analysesTable.uploadedAt,
      movementSummary: analysesTable.movementSummary,
    })
    .from(analysesTable)
    .where(eq(analysesTable.userId, userId))
    .orderBy(analysesTable.uploadedAt);

  const history = rows
    .filter((r) => {
      if (!r.movementSummary || typeof r.movementSummary !== "object") return false;
      const ms = r.movementSummary as SummaryShape;
      return ms.overallScore != null;
    })
    .filter((r) => !sport || r.sport.toLowerCase() === sport)
    .map((r) => {
      const ms = r.movementSummary as SummaryShape;
      return {
        analysisId: String(r.id),
        date: r.uploadedAt.toISOString(),
        sport: r.sport,
        flowScore: ms.flowScore ?? 0,
        efficiencyScore: ms.efficiencyScore ?? 0,
        bodyControlScore: ms.bodyControlScore ?? 0,
        consistencyScore: ms.consistencyScore ?? 0,
        rhythmScore: ms.rhythmScore ?? 0,
        overallScore: ms.overallScore ?? 0,
      };
    });

  res.json({ history });
});

router.get("/analyses/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }

  const [row] = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)));

  if (!row) { res.status(404).json({ error: "Analysis not found" }); return; }

  const storedTips = (row.tips ?? []) as Array<{
    tipType?: string; category: string; severity: string; title: string;
    videoObservation?: string; description: string; whyItMatters?: string;
    drill?: { name: string; sets: string; reps: string; cue: string; drillFeelCue?: string };
    source?: string;
    joints?: string[];
  }>;
  const storedRisks = (row.injuryRisks ?? []) as Array<{
    joint: string; riskPercent: number; description: string; prevention: string;
  }>;

  const tips = storedTips.map((t, i) => ({ id: String(i + 1), ...t }));
  const injuryRisks = storedRisks.map((r, i) => ({ id: String(i + 1), ...r }));

  res.json({ analysis: formatAnalysis(row), tips, injuryRisks });
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
  const id = parseInt(String(req.params.id ?? ""), 10);
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
  // movement type without re-running. The authoritative grounded run happens when the
  // skeleton scan later PATCHes joint angles, and it will use this corrected sport.
  // Re-running here as a second biomechanics run would race the skeleton run (neither
  // is guarded against the other), so we deliberately defer it. Surface a real DB
  // failure so the client doesn't clear its mismatch warning on a write that never landed.
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
  // Reject rather than kick off a "biomechanics" run with no joints/frame (which
  // would wrongly set biomechanicsApplied=true).
  if (!hasMeasuredData) {
    res.status(400).json({ error: "No measured data or sport correction provided" });
    return;
  }

  // Acquire a distributed lock so two simultaneous PATCH calls cannot both trigger
  // a biomechanics run on the same analysis. If the lock is already held (another
  // request is already queued or in-flight) return 409 immediately.
  const lockKey = `lock:analysis:${id}`;
  const lockAcquired = await cache.acquireLock(lockKey, 30_000);
  if (!lockAcquired) {
    res.status(409).json({ error: "Analysis is already being processed" });
    return;
  }

  // Stale completed-drill records (tipIds from the previous scan) are now orphaned
  // because the re-scan will regenerate tips with new IDs. Delete them before
  // responding so the client can rely on PATCH success meaning drills are cleared.
  await db.delete(completedDrillsTable)
    .where(eq(completedDrillsTable.analysisId, row.id))
    .catch((err) => { console.error(`Failed to clear completed drills for id=${id}:`, err); });

  // Snapshot the worst-frame JPEG as the thumbnail immediately so the list shows
  // it without waiting for the AI run. Down-sample to ≤160 px wide to keep DB lean.
  // Persist measured joint angles/risks so the trends endpoint has per-joint history.
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

  // Return 202 immediately — the mobile polling loop will pick up status: 'complete'
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
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }

  const [row] = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)));

  if (!row) { res.status(404).json({ error: "Analysis not found" }); return; }

  if (row.coachingMoments && Array.isArray(row.coachingMoments) && row.coachingMoments.length > 0) {
    res.json({ moments: row.coachingMoments });
    return;
  }

  const flaggedMoments: FlaggedMoment[] = Array.isArray(req.body?.flaggedMoments)
    ? (req.body.flaggedMoments as FlaggedMoment[]).slice(0, 30)
    : [];

  if (flaggedMoments.length === 0 && row.jointRisks) {
    const risks = row.jointRisks as Record<string, number>;
    const angles = (row.jointAngles ?? {}) as Record<string, number>;
    const hasRisk = Object.values(risks).some((v) => (v as number) >= 1);
    if (hasRisk) {
      const syntheticAngles: Partial<Record<import("../lib/anthropic").JointKey, number>> = {};
      const syntheticRisks: Partial<Record<import("../lib/anthropic").JointKey, number>> = {};
      for (const [j, lvl] of Object.entries(risks)) {
        if ((lvl as number) >= 1 && angles[j] != null) {
          syntheticAngles[j as import("../lib/anthropic").JointKey] = angles[j]!;
          syntheticRisks[j as import("../lib/anthropic").JointKey] = lvl as number;
        }
      }
      flaggedMoments.push({ t: 0, joints: Object.keys(syntheticRisks) as import("../lib/anthropic").JointKey[], angles: syntheticAngles, risks: syntheticRisks });
    }
  }

  const existingTips = Array.isArray(row.tips) ? row.tips as object[] : [];

  try {
    const moments = await generateCoachingMoments(row.sport, row.title, flaggedMoments, existingTips);
    await db.update(analysesTable)
      .set({ coachingMoments: moments })
      .where(eq(analysesTable.id, id));
    res.json({ moments });
  } catch (err) {
    console.error("generateCoachingMoments failed:", err);
    res.status(500).json({ error: "Failed to generate coaching moments" });
  }
});

router.post("/analyses/:id/movement-summary", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }

  const [row] = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)));

  if (!row) { res.status(404).json({ error: "Analysis not found" }); return; }

  if (row.movementSummary && typeof row.movementSummary === "object" && (row.movementSummary as { overallScore?: number }).overallScore != null) {
    res.json({ summary: row.movementSummary });
    return;
  }

  const scores = {
    technique: row.techniqueScore ?? undefined,
    power: row.powerScore ?? undefined,
    balance: row.balanceScore ?? undefined,
    consistency: row.consistencyScore ?? undefined,
    mobility: row.mobilityScore ?? undefined,
    speed: row.speedScore ?? undefined,
    overall: row.overallScore ?? undefined,
  };

  const incomingStats = req.body?.tickStats as { joints?: Record<string, { avgAngle: number; maxRisk: number; timesFlag: number }> } | null;
  const jointAngles = (row.jointAngles ?? {}) as Record<string, number>;
  const jointRisks = (row.jointRisks ?? {}) as Record<string, number>;

  let jointStats: Array<{ joint: string; avgAngle: number; maxRisk: number; timesFlag: number }> = [];
  if (incomingStats?.joints) {
    jointStats = Object.entries(incomingStats.joints).map(([j, s]) => ({
      joint: j,
      avgAngle: s.avgAngle,
      maxRisk: s.maxRisk,
      timesFlag: s.timesFlag,
    }));
  } else {
    jointStats = Object.entries(jointAngles).map(([j, angle]) => ({
      joint: j,
      avgAngle: angle,
      maxRisk: jointRisks[j] ?? 0,
      timesFlag: (jointRisks[j] ?? 0) >= 1 ? 1 : 0,
    }));
  }

  try {
    const summary = await generateMovementSummary(
      row.sport, row.title, scores, jointStats, row.strengths ?? [], row.improvements ?? []
    );
    await db.update(analysesTable)
      .set({ movementSummary: summary, movementSummaryAt: new Date() })
      .where(eq(analysesTable.id, id));
    res.json({ summary });
  } catch (err) {
    console.error("generateMovementSummary failed:", err);
    res.status(500).json({ error: "Failed to generate movement summary" });
  }
});

// ─── Completed drills ─────────────────────────────────────────────────────────

router.get("/analyses/:id/drills/completed", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }

  const [owned] = await db
    .select({ id: analysesTable.id })
    .from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)))
    .limit(1);
  if (!owned) { res.status(404).json({ error: "Analysis not found" }); return; }

  const rows = await db
    .select()
    .from(completedDrillsTable)
    .where(and(eq(completedDrillsTable.userId, userId), eq(completedDrillsTable.analysisId, id)));

  res.json({ completedTipIds: rows.map((r) => r.tipId) });
});

router.post("/analyses/:id/drills/:tipId/complete", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params.id ?? ""), 10);
  const tipId = String(req.params.tipId ?? "").trim();
  if (isNaN(id) || !tipId) { res.status(400).json({ error: "Invalid request" }); return; }

  const [owned] = await db
    .select({ id: analysesTable.id })
    .from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)))
    .limit(1);
  if (!owned) { res.status(404).json({ error: "Analysis not found" }); return; }

  const drillName = typeof req.body?.drillName === "string" ? req.body.drillName.slice(0, 200) : null;

  const existing = await db
    .select({ id: completedDrillsTable.id })
    .from(completedDrillsTable)
    .where(and(
      eq(completedDrillsTable.userId, userId),
      eq(completedDrillsTable.analysisId, id),
      eq(completedDrillsTable.tipId, tipId),
    ))
    .limit(1);

  if (!existing.length) {
    await db.insert(completedDrillsTable).values({ userId, analysisId: id, tipId, drillName });
  }

  res.json({ success: true });
});

router.delete("/analyses/:id/drills/:tipId/complete", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params.id ?? ""), 10);
  const tipId = String(req.params.tipId ?? "").trim();
  if (isNaN(id) || !tipId) { res.status(400).json({ error: "Invalid request" }); return; }

  await db
    .delete(completedDrillsTable)
    .where(and(
      eq(completedDrillsTable.userId, userId),
      eq(completedDrillsTable.analysisId, id),
      eq(completedDrillsTable.tipId, tipId),
    ));

  res.json({ success: true });
});

router.delete("/analyses/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }

  const deleted = await db
    .delete(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)))
    .returning({ id: analysesTable.id });

  if (!deleted.length) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.json({ success: true });
});

export default router;
