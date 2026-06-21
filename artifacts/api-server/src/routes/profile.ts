import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import sharp from "sharp";
import { db, profilesTable, analysesTable, completedDrillsTable } from "@workspace/db";
import { requireAuth } from "./auth";
import { computeProfileStats } from "../lib/stats";

const AVATAR_MAX_PX = 64;
const AVATAR_MAX_BYTES = 20 * 1024;

export async function compressAvatarIfNeeded(avatarUrl: string): Promise<string> {
  const match = avatarUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) return avatarUrl;

  const inputBuffer = Buffer.from(match[2], "base64");

  let quality = 80;
  let outputBuffer: Buffer;

  do {
    outputBuffer = await sharp(inputBuffer)
      .resize(AVATAR_MAX_PX, AVATAR_MAX_PX, { fit: "cover", position: "centre" })
      .jpeg({ quality })
      .toBuffer();
    quality -= 10;
  } while (outputBuffer.byteLength > AVATAR_MAX_BYTES && quality >= 20);

  return `data:image/jpeg;base64,${outputBuffer.toString("base64")}`;
}

const router: IRouter = Router();

const VALID_LEVELS = ["beginner", "intermediate", "advanced", "elite"] as const;

function formatProfile(
  p: typeof profilesTable.$inferSelect,
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
  res.json({ profile: formatProfile(result, streak, weeklyProgress) });
});

router.get("/profile/stats", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;

  const [profileRow, rows, drillsMasteredResult] = await Promise.all([
    db
      .select({ trainingDays: profilesTable.trainingDays })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select()
      .from(analysesTable)
      .where(and(eq(analysesTable.userId, userId), eq(analysesTable.status, "complete")))
      .orderBy(desc(analysesTable.uploadedAt)),
    db
      .select({ count: count() })
      .from(completedDrillsTable)
      .where(eq(completedDrillsTable.userId, userId))
      .then((r) => r[0]?.count ?? 0),
  ]);

  const trainingDaySet =
    profileRow?.trainingDays && profileRow.trainingDays.length > 0
      ? new Set(profileRow.trainingDays)
      : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayKeys = new Set(rows.map(r => {
    const d = new Date(r.uploadedAt);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }));

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const check = new Date(today.getTime() - i * 86_400_000);
    if (dayKeys.has(check.getTime())) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 86_400_000);

  const thisWeekCount = rows.filter(r => {
    const d = new Date(r.uploadedAt);
    if (d < weekStart) return false;
    if (trainingDaySet !== null && !trainingDaySet.has(d.getDay())) return false;
    return true;
  }).length;
  const lastWeekCount = rows.filter(r => {
    const d = new Date(r.uploadedAt);
    if (d < lastWeekStart || d >= weekStart) return false;
    if (trainingDaySet !== null && !trainingDaySet.has(d.getDay())) return false;
    return true;
  }).length;

  const pbNum = (key: keyof typeof rows[0]) =>
    rows.length ? Math.max(0, ...rows.map(r => (r[key] as number | null) ?? 0)) : 0;

  const personalBests = {
    overall:     pbNum("overallScore"),
    technique:   pbNum("techniqueScore"),
    power:       pbNum("powerScore"),
    balance:     pbNum("balanceScore"),
    consistency: pbNum("consistencyScore"),
    mobility:    pbNum("mobilityScore"),
    speed:       pbNum("speedScore"),
  };

  const latestScore  = rows[0]?.overallScore ?? null;
  const prevScore    = rows[1]?.overallScore ?? null;
  const scoreDelta   = latestScore != null && prevScore != null
    ? Math.round(latestScore - prevScore) : null;

  res.json({ streak, totalAnalyses: rows.length, thisWeekCount, lastWeekCount, personalBests, latestScore, scoreDelta, drillsMastered: drillsMasteredResult });
});

export default router;
