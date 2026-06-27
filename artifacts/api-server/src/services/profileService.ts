import { db, analysesTable, completedDrillsTable, profilesTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { findProfileByUserId, upsertProfile, type ProfileRow } from "../repositories/userRepository";
import { computeProfileStats } from "../lib/stats";
import { cache } from "../lib/redis";

const VALID_LEVELS = ["beginner", "intermediate", "advanced", "elite"] as const;

/** Avatar compression requires the sharp native binary which is not available
 *  in this environment — return the URL unchanged. */
export async function compressAvatarIfNeeded(avatarUrl: string): Promise<string> {
  return avatarUrl;
}

export function formatProfile(
  p: ProfileRow,
  streakDays = 0,
  weeklyProgress = 0,
) {
  return {
    id: String(p.id),
    userId: String(p.userId),
    name: p.name,
    sport: p.sport,
    level: p.level as "beginner" | "intermediate" | "advanced" | "elite",
    goals: p.goals ?? [],
    injuryConcerns: p.injuryConcerns ?? [],
    weeklyGoal: p.weeklyGoal,
    trainingDays: p.trainingDays ?? [0, 1, 2, 3, 4, 5, 6],
    checkInHour: p.checkInHour ?? 9,
    weeklyProgress,
    streakDays,
    avatarUrl: p.avatarUrl ?? null,
    weeklyGoalCelebratedAt: p.weeklyGoalCelebratedAt ?? null,
  };
}

export async function getProfile(userId: number) {
  const row = await findProfileByUserId(userId);
  if (!row) return { profile: null };
  const { streak, weeklyProgress } = await computeProfileStats(userId, row.trainingDays ?? undefined);
  return { profile: formatProfile(row, streak, weeklyProgress) };
}

export type PatchProfileBody = {
  name?: string; sport?: string; level?: string; goals?: string[];
  injuryConcerns?: string[]; weeklyGoal?: number; trainingDays?: number[];
  checkInHour?: number; avatarUrl?: string | null; weeklyGoalCelebratedAt?: string | null;
};

export async function patchProfile(userId: number, body: PatchProfileBody) {
  const { name, sport, level, goals, injuryConcerns, weeklyGoal, trainingDays, checkInHour, avatarUrl, weeklyGoalCelebratedAt } = body;

  if (level !== undefined && !VALID_LEVELS.includes(level as typeof VALID_LEVELS[number])) {
    return { error: `level must be one of: ${VALID_LEVELS.join(", ")}`, status: 400 };
  }
  if (trainingDays !== undefined) {
    if (!Array.isArray(trainingDays) || trainingDays.length === 0 ||
        trainingDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
        new Set(trainingDays).size !== trainingDays.length) {
      return { error: "trainingDays must be a non-empty array of unique integers 0–6", status: 400 };
    }
  }
  if (checkInHour !== undefined && (!Number.isInteger(checkInHour) || checkInHour < 6 || checkInHour > 22)) {
    return { error: "checkInHour must be an integer between 6 and 22", status: 400 };
  }

  const deduplicatedInjuryConcerns = injuryConcerns !== undefined ? [...new Set(injuryConcerns)] : undefined;
  let processedAvatarUrl = avatarUrl;
  if (typeof avatarUrl === "string") processedAvatarUrl = await compressAvatarIfNeeded(avatarUrl);

  const existing = await findProfileByUserId(userId);
  const result = await upsertProfile(userId, existing, {
    ...(name !== undefined && { name }),
    ...(sport !== undefined && { sport }),
    ...(level !== undefined && { level }),
    ...(goals !== undefined && { goals }),
    ...(deduplicatedInjuryConcerns !== undefined && { injuryConcerns: deduplicatedInjuryConcerns }),
    ...(weeklyGoal !== undefined && { weeklyGoal }),
    ...(trainingDays !== undefined && { trainingDays }),
    ...(checkInHour !== undefined && { checkInHour }),
    ...(processedAvatarUrl !== undefined && { avatarUrl: processedAvatarUrl }),
    ...(weeklyGoalCelebratedAt !== undefined && { weeklyGoalCelebratedAt }),
  });

  const { streak, weeklyProgress } = await computeProfileStats(userId, result.trainingDays ?? undefined);
  await cache.invalidate(`stats:${userId}`);
  return { profile: formatProfile(result, streak, weeklyProgress), status: 200 };
}

export async function getProfileStats(userId: number) {
  const { value } = await cache.getOrSet(
    `stats:${userId}`,
    60,
    async () => {
      const [profileRows, rows, drillsMasteredResult] = await Promise.all([
        db.select({ trainingDays: profilesTable.trainingDays })
          .from(profilesTable)
          .where(eq(profilesTable.userId, userId))
          .limit(1),
        db.select()
          .from(analysesTable)
          .where(and(eq(analysesTable.userId, userId), eq(analysesTable.status, "complete")))
          .orderBy(desc(analysesTable.uploadedAt)),
        db.select({ cnt: count() })
          .from(completedDrillsTable)
          .where(eq(completedDrillsTable.userId, userId)),
      ]);

      const profileRow = profileRows[0] ?? null;
      const drillsMastered = drillsMasteredResult[0]?.cnt ?? 0;
      const trainingDaySet =
        profileRow?.trainingDays && profileRow.trainingDays.length > 0
          ? new Set(profileRow.trainingDays)
          : null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dayKeys = new Set(rows.map((r) => {
        const d = new Date(r.uploadedAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      }));

      let streak = 0;
      for (let i = 0; i < 365; i++) {
        const check = new Date(today.getTime() - i * 86_400_000);
        if (dayKeys.has(check.getTime())) { streak++; }
        else if (i > 0) { break; }
      }

      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const lastWeekStart = new Date(weekStart.getTime() - 7 * 86_400_000);

      const thisWeekCount = rows.filter((r) => {
        const d = new Date(r.uploadedAt);
        if (d < weekStart) return false;
        if (trainingDaySet !== null && !trainingDaySet.has(d.getDay())) return false;
        return true;
      }).length;

      const lastWeekCount = rows.filter((r) => {
        const d = new Date(r.uploadedAt);
        if (d < lastWeekStart || d >= weekStart) return false;
        if (trainingDaySet !== null && !trainingDaySet.has(d.getDay())) return false;
        return true;
      }).length;

      const pbNum = (key: "overallScore" | "techniqueScore" | "powerScore" | "balanceScore" | "consistencyScore" | "mobilityScore" | "speedScore") =>
        rows.length ? Math.max(0, ...rows.map((r) => (r[key] as number | null) ?? 0)) : 0;

      const personalBests = {
        overall: pbNum("overallScore"),
        technique: pbNum("techniqueScore"),
        power: pbNum("powerScore"),
        balance: pbNum("balanceScore"),
        consistency: pbNum("consistencyScore"),
        mobility: pbNum("mobilityScore"),
        speed: pbNum("speedScore"),
      };

      const latestScore = rows[0]?.overallScore ?? null;
      const prevScore = rows[1]?.overallScore ?? null;
      const scoreDelta = latestScore != null && prevScore != null
        ? Math.round(latestScore - prevScore) : null;

      return {
        streak, totalAnalyses: rows.length, thisWeekCount, lastWeekCount,
        personalBests, latestScore, scoreDelta, drillsMastered,
      };
    }
  );
  return value;
}
