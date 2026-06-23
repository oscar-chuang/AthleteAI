import {
  findAnalysesByUserId, findAnalysisById, findAnalysisOwnership,
  createAnalysis, updateAnalysis, updateAnalysisIfNotGrounded, deleteAnalysis,
  findJointTrendSessions, findMovementSummaryHistory, findPrevBiomechanicsScan,
  findCompletedDrills, findCompletedDrill, createCompletedDrill, deleteCompletedDrill,
  deleteCompletedDrillsByAnalysis, type AnalysisRow,
} from "../repositories/analysisRepository";
import { findProfileByUserId } from "../repositories/userRepository";
import {
  analyzeAthletePerformance, detectSportFromFrame, generateCoachingMoments,
  generateMovementSummary, type AIAnalysisResult, type JointAngles, type JointRisks,
  type FlaggedMoment, type JointKey,
} from "../lib/anthropic";
import { resizeThumbnail } from "../lib/resize-thumbnail";

export const MAX_TITLE_LENGTH = 120;
export const MAX_SPORT_LENGTH = 60;
export const MAX_VIDEO_URL_BYTES = 4_096;
const JOINT_KEYS = ["leftKnee", "rightKnee", "leftHip", "rightHip", "leftElbow", "rightElbow"] as const;
export const MAX_FRAME_CHARS = 3_000_000;

export function validateVideoUrl(value: string): string | null {
  if (value.startsWith("data:")) return "videoUrl must be a URL, not an inline data URI";
  if (Buffer.byteLength(value, "utf8") > MAX_VIDEO_URL_BYTES) {
    return `videoUrl must be ${MAX_VIDEO_URL_BYTES} bytes or fewer`;
  }
  return null;
}

export function sanitizeJointAngles(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const k of JOINT_KEYS) {
    const v = src[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.max(0, Math.min(200, v));
  }
  return Object.keys(out).length ? out : null;
}

export function sanitizeJointRisks(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const k of JOINT_KEYS) {
    const v = src[k];
    if (typeof v === "number" && (v === 0 || v === 1 || v === 2)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export function formatAnalysis(a: AnalysisRow) {
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

async function runAIAnalysis(
  id: number, userId: number, sport: string, title: string,
  videoUrl?: string, jointAngles?: Record<string, number> | null,
  jointRisks?: Record<string, number> | null, frameBase64?: string | null,
  isBiomechanics = false
) {
  const profileRow = await findProfileByUserId(userId);
  const athleteProfile = profileRow
    ? { name: profileRow.name, level: profileRow.level, goals: profileRow.goals ?? [], injuryConcerns: profileRow.injuryConcerns ?? [] }
    : null;

  const result: AIAnalysisResult = await analyzeAthletePerformance(
    sport, title, videoUrl, athleteProfile,
    jointAngles as JointAngles | null,
    jointRisks as JointRisks | null,
    frameBase64
  );

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
    await updateAnalysis(id, { ...values, biomechanicsApplied: true });
  } else {
    await updateAnalysisIfNotGrounded(id, values);
  }

  console.log(`AI analysis complete for id=${id} (${sport}: ${title})${isBiomechanics ? " [biomechanics]" : ""}`);
}

export async function listAnalyses(userId: number) {
  const rows = await findAnalysesByUserId(userId);
  return { analyses: rows.map(formatAnalysis) };
}

export type CreateAnalysisBody = {
  title?: string; sport?: string; videoUrl?: string; duration?: number; movementType?: string;
};

export async function createAnalysisEntry(userId: number, body: CreateAnalysisBody) {
  const { title, sport, videoUrl, duration, movementType } = body;

  if (!title || !sport) return { error: "title and sport are required", status: 400 };
  if (title.length > MAX_TITLE_LENGTH) return { error: `title must be ${MAX_TITLE_LENGTH} characters or fewer`, status: 400 };
  if (sport.length > MAX_SPORT_LENGTH) return { error: `sport must be ${MAX_SPORT_LENGTH} characters or fewer`, status: 400 };
  if (videoUrl !== undefined && videoUrl !== null) {
    const urlError = validateVideoUrl(videoUrl);
    if (urlError) return { error: urlError, status: 400 };
  }

  const sanitizedMovementType =
    typeof movementType === "string" && movementType.trim().length > 0 && movementType.trim().length <= 80
      ? movementType.trim()
      : null;

  const row = await createAnalysis({
    userId,
    title,
    sport: sport.toLowerCase(),
    status: "processing",
    videoUrl: videoUrl ?? null,
    duration: duration ?? null,
    movementType: sanitizedMovementType,
  });

  runAIAnalysis(row.id, userId, sport, title, videoUrl).catch((err) => {
    console.error(`AI analysis failed for id=${row.id}:`, err);
    updateAnalysisIfNotGrounded(row.id, { status: "failed" }).catch(() => {});
  });

  return { analysis: formatAnalysis(row), status: 201 };
}

export async function detectSport(imageBase64: string) {
  return detectSportFromFrame(imageBase64);
}

export async function getJointTrends(userId: number) {
  const rows = await findJointTrendSessions(userId);
  const sessions = rows.filter((r) => r.jointAngles && Object.keys(r.jointAngles).length > 0);

  const jointHistory: Record<string, Array<{
    analysisId: string; date: string; sport: string; angle: number; risk: number;
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

  const improvements: Array<{ joint: string; deltaDeg: number; sessions: number; improved: boolean }> = [];
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

  return { joints: jointHistory, improvements };
}

export async function getMovementSummaryHistory(userId: number, sport?: string) {
  type SummaryShape = {
    flowScore?: number; efficiencyScore?: number; bodyControlScore?: number;
    consistencyScore?: number; rhythmScore?: number; overallScore?: number;
  };

  const rows = await findMovementSummaryHistory(userId);

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

  return { history };
}

export async function getAnalysis(id: number, userId: number) {
  const row = await findAnalysisById(id, userId);
  if (!row) return null;

  const storedTips = (row.tips ?? []) as Array<{
    tipType?: string; category: string; severity: string; title: string;
    videoObservation?: string; description: string; whyItMatters?: string;
    drill?: { name: string; sets: string; reps: string; cue: string; drillFeelCue?: string };
    source?: string; joints?: string[];
  }>;
  const storedRisks = (row.injuryRisks ?? []) as Array<{
    joint: string; riskPercent: number; description: string; prevention: string;
  }>;

  const tips = storedTips.map((t, i) => ({ id: String(i + 1), ...t }));
  const injuryRisks = storedRisks.map((r, i) => ({ id: String(i + 1), ...r }));

  return { analysis: formatAnalysis(row), tips, injuryRisks };
}

export type PatchAnalysisBody = {
  jointAngles?: Record<string, unknown>;
  jointRisks?: Record<string, unknown>;
  frameBase64?: unknown;
  title?: unknown;
  sport?: unknown;
  movementType?: unknown;
  videoUrl?: unknown;
};

export async function patchAnalysis(id: number, userId: number, body: PatchAnalysisBody) {
  const row = await findAnalysisById(id, userId);
  if (!row) return { error: "Analysis not found", status: 404 };

  if (typeof body.title === "string" && body.title.length > MAX_TITLE_LENGTH) {
    return { error: `title must be ${MAX_TITLE_LENGTH} characters or fewer`, status: 400 };
  }
  if (typeof body.sport === "string" && body.sport.trim().length > MAX_SPORT_LENGTH) {
    return { error: `sport must be ${MAX_SPORT_LENGTH} characters or fewer`, status: 400 };
  }
  if (typeof body.videoUrl === "string") {
    const urlError = validateVideoUrl(body.videoUrl);
    if (urlError) return { error: urlError, status: 400 };
  }

  const jointAngles = sanitizeJointAngles(body.jointAngles);
  const jointRisks = sanitizeJointRisks(body.jointRisks);
  const frameBase64 =
    typeof body.frameBase64 === "string" && body.frameBase64.length <= MAX_FRAME_CHARS
      ? body.frameBase64
      : undefined;
  const newSport =
    typeof body.sport === "string" && body.sport.trim().length > 0
      ? body.sport.trim().toLowerCase()
      : null;
  const newMovementType =
    typeof body.movementType === "string" && body.movementType.trim().length > 0 && body.movementType.trim().length <= 80
      ? body.movementType.trim()
      : null;

  const hasMeasuredData = !!jointAngles || !!jointRisks || !!frameBase64;

  const improvements: Array<{ joint: string; oldRisk: number; newRisk: number }> = [];
  if (jointRisks) {
    const prevScan = await findPrevBiomechanicsScan(userId, id);
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

  if ((newSport || newMovementType) && !hasMeasuredData) {
    try {
      await updateAnalysis(row.id, {
        ...(newSport ? { sport: newSport } : {}),
        ...(newMovementType ? { movementType: newMovementType } : {}),
      });
    } catch (err) {
      console.error(`Sport/movement correction failed for id=${id}:`, err);
      return { error: "Failed to update sport", status: 500 };
    }
    return { success: true, improvements, status: 200 };
  }

  if (!hasMeasuredData) {
    return { error: "No measured data or sport correction provided", status: 400 };
  }

  await deleteCompletedDrillsByAnalysis(row.id).catch((err) => {
    console.error(`Failed to clear completed drills for id=${id}:`, err);
  });

  const thumbnailUrl = frameBase64 ? await resizeThumbnail(frameBase64) : undefined;
  await updateAnalysis(row.id, {
    status: "processing",
    ...(newSport ? { sport: newSport } : {}),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(jointAngles ? { jointAngles } : {}),
    ...(jointRisks ? { jointRisks } : {}),
  }).catch(() => {});

  const effectiveSport = newSport ?? row.sport;
  runAIAnalysis(row.id, userId, effectiveSport, row.title, row.videoUrl ?? undefined, jointAngles, jointRisks, frameBase64, true)
    .catch((err) => {
      console.error(`AI re-analysis failed for id=${id}:`, err);
      updateAnalysis(row.id, { status: "complete" }).catch(() => {});
    });

  return { success: true, improvements, status: 200 };
}

export async function generateCoachingMomentsForAnalysis(
  id: number, userId: number, rawFlaggedMoments: FlaggedMoment[]
) {
  const row = await findAnalysisById(id, userId);
  if (!row) return { error: "Analysis not found", status: 404 };

  if (row.coachingMoments && Array.isArray(row.coachingMoments) && row.coachingMoments.length > 0) {
    return { moments: row.coachingMoments, status: 200 };
  }

  const flaggedMoments: FlaggedMoment[] = (rawFlaggedMoments ?? []).slice(0, 30);

  if (flaggedMoments.length === 0 && row.jointRisks) {
    const risks = row.jointRisks as Record<string, number>;
    const angles = (row.jointAngles ?? {}) as Record<string, number>;
    const hasRisk = Object.values(risks).some((v) => (v as number) >= 1);
    if (hasRisk) {
      const syntheticAngles: Partial<Record<JointKey, number>> = {};
      const syntheticRisks: Partial<Record<JointKey, number>> = {};
      for (const [j, lvl] of Object.entries(risks)) {
        if ((lvl as number) >= 1 && angles[j] != null) {
          syntheticAngles[j as JointKey] = angles[j]!;
          syntheticRisks[j as JointKey] = lvl as number;
        }
      }
      flaggedMoments.push({
        t: 0,
        joints: Object.keys(syntheticRisks) as JointKey[],
        angles: syntheticAngles,
        risks: syntheticRisks,
      });
    }
  }

  const existingTips = Array.isArray(row.tips) ? row.tips as object[] : [];
  const moments = await generateCoachingMoments(row.sport, row.title, flaggedMoments, existingTips);
  await updateAnalysis(id, { coachingMoments: moments });
  return { moments, status: 200 };
}

export async function generateMovementSummaryForAnalysis(
  id: number, userId: number,
  tickStats?: { joints?: Record<string, { avgAngle: number; maxRisk: number; timesFlag: number }> } | null
) {
  const row = await findAnalysisById(id, userId);
  if (!row) return { error: "Analysis not found", status: 404 };

  if (row.movementSummary && typeof row.movementSummary === "object" &&
      (row.movementSummary as { overallScore?: number }).overallScore != null) {
    return { summary: row.movementSummary, status: 200 };
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

  const jointAngles = (row.jointAngles ?? {}) as Record<string, number>;
  const jointRisks = (row.jointRisks ?? {}) as Record<string, number>;

  let jointStats: Array<{ joint: string; avgAngle: number; maxRisk: number; timesFlag: number }> = [];
  if (tickStats?.joints) {
    jointStats = Object.entries(tickStats.joints).map(([j, s]) => ({
      joint: j, avgAngle: s.avgAngle, maxRisk: s.maxRisk, timesFlag: s.timesFlag,
    }));
  } else {
    jointStats = Object.entries(jointAngles).map(([j, angle]) => ({
      joint: j, avgAngle: angle, maxRisk: jointRisks[j] ?? 0, timesFlag: (jointRisks[j] ?? 0) >= 1 ? 1 : 0,
    }));
  }

  const summary = await generateMovementSummary(
    row.sport, row.title, scores, jointStats, row.strengths ?? [], row.improvements ?? []
  );
  await updateAnalysis(id, { movementSummary: summary, movementSummaryAt: new Date() });
  return { summary, status: 200 };
}

export async function getCompletedDrills(id: number, userId: number) {
  const owned = await findAnalysisOwnership(id, userId);
  if (!owned) return { error: "Analysis not found", status: 404 };
  const rows = await findCompletedDrills(userId, id);
  return { completedTipIds: rows.map((r) => r.tipId), status: 200 };
}

export async function completeDrill(id: number, userId: number, tipId: string, drillName: string | null) {
  const owned = await findAnalysisOwnership(id, userId);
  if (!owned) return { error: "Analysis not found", status: 404 };
  const existing = await findCompletedDrill(userId, id, tipId);
  if (!existing) {
    await createCompletedDrill({ userId, analysisId: id, tipId, drillName });
  }
  return { success: true, status: 200 };
}

export async function uncompleteDrill(id: number, userId: number, tipId: string) {
  await deleteCompletedDrill(userId, id, tipId);
  return { success: true, status: 200 };
}

export async function deleteAnalysisEntry(id: number, userId: number) {
  const deleted = await deleteAnalysis(id, userId);
  if (!deleted.length) return { error: "Analysis not found", status: 404 };
  return { success: true, status: 200 };
}
