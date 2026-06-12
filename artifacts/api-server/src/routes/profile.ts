import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
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

export default router;
