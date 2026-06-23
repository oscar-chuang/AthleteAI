import {
  findSportDistribution,
  findProgressEntriesForSport,
  findProgressSummarySessions,
  findPersonalRecordSessions,
} from "../repositories/progressRepository";
import { generateProgressSummary } from "../lib/ai";
import { cache } from "../lib/redis";

const summaryCache = new Map<string, { summary: string; expiresAt: number }>();
const SUMMARY_TTL_MS = 60 * 60 * 1000;

export async function getSportDistribution(userId: number) {
  const rows = await findSportDistribution(userId);
  const sportMap = new Map<string, { count: number; movementTypes: Set<string> }>();
  for (const row of rows) {
    const sp = row.sport.toLowerCase();
    if (!sportMap.has(sp)) sportMap.set(sp, { count: 0, movementTypes: new Set() });
    const entry = sportMap.get(sp)!;
    entry.count++;
    if (row.movementType) entry.movementTypes.add(row.movementType);
  }
  const sports = Array.from(sportMap.entries())
    .map(([sport, { count, movementTypes }]) => ({ sport, count, movementTypes: Array.from(movementTypes).sort() }))
    .sort((a, b) => b.count - a.count);
  return { sports };
}

export async function getPersonalRecords(userId: number, sport?: string | null) {
  const rows = await findPersonalRecordSessions(userId, sport);
  const scored = rows.filter((r) => r.overallScore != null);

  type RecordEntry = { value: number; date: string; movementType: string | null };
  const records: Record<string, RecordEntry> = {};
  const metrics: Array<{ key: string; col: keyof typeof rows[0] }> = [
    { key: "overall", col: "overallScore" },
    { key: "technique", col: "techniqueScore" },
    { key: "power", col: "powerScore" },
    { key: "balance", col: "balanceScore" },
    { key: "consistency", col: "consistencyScore" },
    { key: "mobility", col: "mobilityScore" },
    { key: "speed", col: "speedScore" },
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
  return { records };
}

export async function getProgressSummary(userId: number, sport: string, movementType?: string | null) {
  const cacheKey = `${userId}:${sport}:${movementType ?? ""}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { summary: cached.summary, cached: true };
  }

  const rows = await findProgressSummarySessions(userId, sport);
  let sessions = rows.filter((r) => r.overallScore != null);
  if (movementType) sessions = sessions.filter((r) => r.movementType === movementType);

  const sessionData = sessions.map((r) => ({
    date: r.uploadedAt.toISOString(),
    overallScore: r.overallScore!,
    techniqueScore: r.techniqueScore ?? null,
  }));

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

  const personalBest = sessions.length ? Math.max(...sessions.map((r) => r.overallScore ?? 0)) : 0;

  let summary: string;
  try {
    summary = await generateProgressSummary(sport, movementType ?? null, sessionData, jointImprovements, personalBest);
  } catch (err) {
    console.error("Progress summary generation failed:", err);
    summary = `You have ${sessions.length} ${sport} session${sessions.length === 1 ? "" : "s"} recorded. Keep training to see your progress trend here.`;
  }

  summaryCache.set(cacheKey, { summary, expiresAt: Date.now() + SUMMARY_TTL_MS });
  return { summary, cached: false };
}

export async function getProgressEntries(userId: number, sport?: string | null, movementType?: string | null) {
  const cacheKey = `progress:${userId}:${sport ?? ""}:${movementType ?? ""}`;
  const { value } = await cache.getOrSet(cacheKey, 30, async () => {
    const rows = await findProgressEntriesForSport(userId, sport);
    let scored = rows.filter((r) => r.overallScore != null);
    if (movementType) scored = scored.filter((r) => r.movementType === movementType);
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
    return { entries };
  });
  return value;
}
