import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, profilesTable, analysesTable } from "@workspace/db";
import { requireAuth } from "./auth";

const router: IRouter = Router();

function formatProfile(p: typeof profilesTable.$inferSelect) {
  return {
    id: String(p.id),
    userId: String(p.userId),
    name: p.name,
    sport: p.sport,
    level: p.level as "beginner" | "intermediate" | "advanced" | "elite",
    goals: p.goals ?? [],
    injuryConcerns: p.injuryConcerns ?? [],
    weeklyGoal: p.weeklyGoal,
    weeklyProgress: 0,
    streakDays: 0,
  };
}

router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;

  const [row] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  if (!row) {
    res.json({ profile: null, subscription: { id: "free", userId: String(userId), tier: "free", status: "active" } });
    return;
  }

  res.json({
    profile: formatProfile(row),
    subscription: { id: "free", userId: String(userId), tier: "free", status: "active" },
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

  const [existing] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

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
    res.json({ profile: formatProfile(updated!) });
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
    res.json({ profile: formatProfile(created!) });
  }
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
