import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db, profilesTable, analysesTable, completedDrillsTable } from "@workspace/db";
import { requireAuth } from "./auth";
import { computeProfileStats, computePersonalBests } from "../lib/stats";
import { formatProfile } from "../lib/formatters";
import { compressAvatarIfNeeded } from "../lib/media";
import { cache } from "../lib/redis";

const router: IRouter = Router();

const VALID_LEVELS = ["beginner", "intermediate", "advanced", "elite"] as const;

router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;

  const [row] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  if (!row) {
    res.json({ profile: null, subscription: { id: "free", userId: String(userId), tier: "free", status: "active" } });
    return;
  }

  const { streak, weeklyProgress } = await computeProfileStats(
    userId,
    row.trainingDays ?? undefined
  );
  res.json({
    profile: formatProfile(row, streak, weeklyProgress),
    subscription: { id: "free", userId: String(userId), tier: "free", status: "active" },
  });
});

router.patch("/profile", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { name, sport, level, goals, injuryConcerns, weeklyGoal, trainingDays, checkInHour, avatarUrl, weeklyGoalCelebratedAt } = req.body as {
    name?: string;
    sport?: string;
    level?: string;
    goals?: string[];
    injuryConcerns?: string[];
    weeklyGoal?: number;
    trainingDays?: number[];
    checkInHour?: number;
    avatarUrl?: string | null;
    weeklyGoalCelebratedAt?: string | null;
  };

  if (level !== undefined && !VALID_LEVELS.includes(level as typeof VALID_LEVELS[number])) {
    res.status(400).json({ error: `level must be one of: ${VALID_LEVELS.join(", ")}` });
    return;
  }

  if (trainingDays !== undefined) {
    if (
      !Array.isArray(trainingDays) ||
      trainingDays.length === 0 ||
      trainingDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
      new Set(trainingDays).size !== trainingDays.length
    ) {
      res.status(400).json({ error: "trainingDays must be a non-empty array of unique integers 0–6" });
      return;
    }
  }

  if (checkInHour !== undefined) {
    if (!Number.isInteger(checkInHour) || checkInHour < 6 || checkInHour > 22) {
      res.status(400).json({ error: "checkInHour must be an integer between 6 and 22" });
      return;
    }
  }

  const deduplicatedInjuryConcerns =
    injuryConcerns !== undefined
      ? [...new Set(injuryConcerns)]
      : undefined;

  let processedAvatarUrl = avatarUrl;
  if (typeof avatarUrl === "string") {
    processedAvatarUrl = await compressAvatarIfNeeded(avatarUrl);
  }

  const [existing] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  let result: typeof profilesTable.$inferSelect;

  if (existing) {
    const [updated] = await db
      .update(profilesTable)
      .set({
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
        updatedAt: new Date(),
      })
      .where(eq(profilesTable.userId, userId))
      .returning();
    result = updated!;
  } else {
    const [created] = await db
      .insert(profilesTable)
      .values({
        userId,
        name: name ?? "",
        sport: sport ?? "",
        level: level ?? "beginner",
        goals: goals ?? [],
        injuryConcerns: deduplicatedInjuryConcerns ?? [],
        weeklyGoal: weeklyGoal ?? 3,
        trainingDays: trainingDays ?? [0, 1, 2, 3, 4, 5, 6],
        checkInHour: checkInHour ?? 9,
        avatarUrl: processedAvatarUrl ?? null,
        weeklyGoalCelebratedAt: weeklyGoalCelebratedAt ?? null,
      })
      .returning();
    result = created!;
  }

  const { streak, weeklyProgress } = await computeProfileStats(
    userId,
    result.trainingDays ?? undefined
  );

  await cache.invalidate(`stats:${userId}`);

  res.json({ profile: formatProfile(result, streak, weeklyProgress) });
});

router.get("/profile/stats", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;

  const { value: statsPayload, hit } = await cache.getOrSet(
    `stats:${userId}`,
    60,
    async () => {
  // Fetch training-day config first so computeProfileStats can filter correctly.
  const profileRow = await db
    .select({ trainingDays: profilesTable.trainingDays })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1)
    .then((r) => r[0] ?? null);

  // Run all remaining queries in parallel.
  const [
    { streak, weeklyProgress: thisWeekCount, lastWeekCount },
    drillsMastered,
    recentScores,
    totalAnalyses,
    personalBests,
  ] = await Promise.all([
    computeProfileStats(userId, profileRow?.trainingDays ?? undefined),
    db
      .select({ count: count() })
      .from(completedDrillsTable)
      .where(eq(completedDrillsTable.userId, userId))
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ overallScore: analysesTable.overallScore })
      .from(analysesTable)
      .where(and(eq(analysesTable.userId, userId), eq(analysesTable.status, "complete")))
      .orderBy(desc(analysesTable.uploadedAt))
      .limit(2),
    db
      .select({ count: count() })
      .from(analysesTable)
      .where(and(eq(analysesTable.userId, userId), eq(analysesTable.status, "complete")))
      .then((r) => r[0]?.count ?? 0),
    computePersonalBests(userId),
  ]);

  const latestScore = recentScores[0]?.overallScore ?? null;
  const prevScore   = recentScores[1]?.overallScore ?? null;
  const scoreDelta  = latestScore != null && prevScore != null
    ? Math.round(latestScore - prevScore)
    : null;

    return { streak, totalAnalyses, thisWeekCount, lastWeekCount, personalBests, latestScore, scoreDelta, drillsMastered };
  }
  );

  res.set("X-Cache", hit ? "HIT" : "MISS");
  res.json(statsPayload);
});

export default router;
