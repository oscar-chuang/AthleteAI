import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, profilesTable, analysesTable, subscriptionsTable } from "@workspace/db";
import { requireAuth } from "./auth";
import { computeProfileStats } from "../lib/stats";

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
    weeklyProgress,
    streakDays,
  };
}

router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;

  const [row] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);

  const subscription = sub
    ? {
        id: sub.stripeSubscriptionId ?? `free_${sub.tier}`,
        userId: String(sub.userId),
        tier: sub.tier,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      }
    : { id: "free", userId: String(userId), tier: "free", status: "active" };

  if (!row) {
    res.json({ profile: null, subscription });
    return;
  }

  const { streak, weeklyProgress } = await computeProfileStats(userId);
  res.json({
    profile: formatProfile(row, streak, weeklyProgress),
    subscription,
  });
});

router.patch("/profile", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const { name, sport, level, goals, injuryConcerns, weeklyGoal } = req.body as {
    name?: string;
    sport?: string;
    level?: string;
    goals?: string[];
    injuryConcerns?: string[];
    weeklyGoal?: number;
  };

  if (level !== undefined && !VALID_LEVELS.includes(level as any)) {
    res.status(400).json({ error: `level must be one of: ${VALID_LEVELS.join(", ")}` });
    return;
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
        ...(injuryConcerns !== undefined && { injuryConcerns }),
        ...(weeklyGoal !== undefined && { weeklyGoal }),
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
        injuryConcerns: injuryConcerns ?? [],
        weeklyGoal: weeklyGoal ?? 3,
      })
      .returning();
    result = created!;
  }

  const { streak, weeklyProgress } = await computeProfileStats(userId);
  res.json({ profile: formatProfile(result, streak, weeklyProgress) });
});

router.get("/profile/stats", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;

  const rows = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.userId, userId), eq(analysesTable.status, "complete")))
    .orderBy(desc(analysesTable.uploadedAt));

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

  const thisWeekCount = rows.filter(r => new Date(r.uploadedAt) >= weekStart).length;
  const lastWeekCount = rows.filter(r => {
    const d = new Date(r.uploadedAt);
    return d >= lastWeekStart && d < weekStart;
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

  res.json({ streak, totalAnalyses: rows.length, thisWeekCount, lastWeekCount, personalBests, latestScore, scoreDelta });
});

export default router;
