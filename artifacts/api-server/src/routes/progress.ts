import { Router, type IRouter, type Request, type Response } from "express";
import { db, analysesTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { requireAuth } from "./auth";
import { generateProgressSummary } from "../lib/anthropic";

const router: IRouter = Router();

// Simple in-memory cache: key = `${userId}:${sport}:${movementType}`, value = { summary, expiresAt }
const summaryCache = new Map<string, { summary: string; expiresAt: number }>();
const SUMMARY_TTL_MS = 60 * 60 * 1000; // 1 hour

router.get("/progress/sports", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;

  const rows = await db
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

  const sportMap = new Map<string, { count: number; movementTypes: Set<string> }>();
  for (const row of rows) {
    const sp = row.sport.toLowerCase();
    if (!sportMap.has(sp)) sportMap.set(sp, { count: 0, movementTypes: new Set() });
    const entry = sportMap.get(sp)!;
    entry.count++;
    if (row.movementType) entry.movementTypes.add(row.movementType);
  }

  const sports = Array.from(sportMap.entries())
    .map(([sport, { count, movementTypes }]) => ({
      sport,
      count,
      movementTypes: Array.from(movementTypes).sort(),
    }))
    .sort((a, b) => b.count - a.count);

  res.json({ sports });
});

router.get("/progress/personal-records", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const sport = typeof req.query["sport"] === "string" ? req.query["sport"].toLowerCase() : null;

  const conditions = [
    eq(analysesTable.userId, userId),
    eq(analysesTable.status, "complete"),
    ...(sport ? [eq(analysesTable.sport, sport)] : []),
  ];

  const rows = await db
    .select()
    .from(analysesTable)
    .where(and(...conditions as any))
    .orderBy(asc(analysesTable.uploadedAt));

  const scored = rows.filter((r) => r.overallScore != null);

  type RecordEntry = { value: number; date: string; movementType: string | null };
  const records: Record<string, RecordEntry> = {};

  const metrics: Array<{ key: string; col: keyof typeof rows[0] }> = [
    { key: "overall",     col: "overallScore"     },
    { key: "technique",   col: "techniqueScore"   },
    { key: "power",       col: "powerScore"       },
    { key: "balance",     col: "balanceScore"     },
    { key: "consistency", col: "consistencyScore" },
    { key: "mobility",    col: "mobilityScore"    },
    { key: "speed",       col: "speedScore"       },
  ];

  for (const { key, col } of metrics) {
    let best: RecordEntry | null = null;
    for (const row of scored) {
      const val = row[col] as number | null;
      if (val == null) continue;
      if (!best || val > best.value) {
        best = { value: val, date: row.uploadedAt.toISOString(), movementType: row.movementType ?? null };
      }
    }
    if (best) records[key] = best;
  }

  res.json({ records });
});

router.get("/progress/summary", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const sport = typeof req.query["sport"] === "string" ? req.query["sport"].toLowerCase() : null;
  const movementType = typeof req.query["movementType"] === "string" ? req.query["movementType"] : null;

  if (!sport) {
    res.status(400).json({ error: "sport query parameter is required" });
    return;
  }

  const cacheKey = `${userId}:${sport}:${movementType ?? ""}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json({ summary: cached.summary, cached: true });
    return;
  }

  const conditions = [
    eq(analysesTable.userId, userId),
    eq(analysesTable.status, "complete"),
    eq(analysesTable.sport, sport),
  ];

  const rows = await db
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
    .where(and(...conditions as any))
    .orderBy(asc(analysesTable.uploadedAt));

  let sessions = rows.filter((r) => r.overallScore != null);
  if (movementType) {
    sessions = sessions.filter((r) => r.movementType === movementType);
  }

  const sessionData = sessions.map((r) => ({
    date: r.uploadedAt.toISOString(),
    overallScore: r.overallScore!,
    techniqueScore: r.techniqueScore ?? null,
  }));

  // Compute joint improvements from grounded sessions
  const jointHistory: Record<string, Array<{ angle: number; risk: number }>> = {};
  for (const row of sessions.filter((r) => r.biomechanicsApplied && r.jointAngles)) {
    const angles = row.jointAngles as Record<string, number>;
    const risks = (row.jointRisks ?? {}) as Record<string, number>;
    for (const [joint, angle] of Object.entries(angles)) {
      if (!jointHistory[joint]) jointHistory[joint] = [];
      jointHistory[joint]!.push({ angle, risk: risks[joint] ?? 0 });
    }
  }

  const jointImprovements = Object.entries(jointHistory)
    .filter(([, h]) => h.length >= 2)
    .map(([joint, h]) => {
      const first = h[0]!;
      const last = h[h.length - 1]!;
      const deltaDeg = Math.round(last.angle - first.angle);
      const improved = first.risk > last.risk || (first.risk === last.risk && Math.abs(deltaDeg) >= 5 && last.risk < 2);
      return { joint, deltaDeg, improved };
    });

  const personalBest = sessions.length
    ? Math.max(...sessions.map((r) => r.overallScore ?? 0))
    : 0;

  let summary: string;
  try {
    summary = await generateProgressSummary(sport, movementType, sessionData, jointImprovements, personalBest);
  } catch (err) {
    console.error("Progress summary generation failed:", err);
    summary = `You have ${sessions.length} ${sport} session${sessions.length === 1 ? "" : "s"} recorded. Keep training to see your progress trend here.`;
  }

  summaryCache.set(cacheKey, { summary, expiresAt: Date.now() + SUMMARY_TTL_MS });
  res.json({ summary, cached: false });
});

router.get("/progress", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const sport = typeof req.query["sport"] === "string" ? req.query["sport"].toLowerCase() : null;
  const movementType = typeof req.query["movementType"] === "string" ? req.query["movementType"] : null;

  const conditions = [
    eq(analysesTable.userId, userId),
    ...(sport ? [eq(analysesTable.sport, sport)] : []),
  ];

  const rows = await db
    .select()
    .from(analysesTable)
    .where(and(...conditions as any))
    .orderBy(asc(analysesTable.uploadedAt));

  let scored = rows.filter((r) => r.overallScore != null);
  if (movementType) {
    scored = scored.filter((r) => r.movementType === movementType);
  }

  const entries = scored.map((r) => ({
    id: String(r.id),
    title: r.title,
    sport: r.sport,
    movementType: r.movementType ?? null,
    date: r.uploadedAt.toISOString(),
    overallScore: r.overallScore!,
    techniqueScore: r.techniqueScore ?? undefined,
    powerScore: r.powerScore ?? undefined,
    balanceScore: r.balanceScore ?? undefined,
    consistencyScore: r.consistencyScore ?? undefined,
    mobilityScore: r.mobilityScore ?? undefined,
    speedScore: r.speedScore ?? undefined,
  }));

  res.json({ entries });
});

export default router;
