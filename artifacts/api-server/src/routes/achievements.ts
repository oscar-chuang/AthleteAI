import { Router } from "express";
import { db } from "@workspace/db";
import {
  achievementsTable,
  userAchievementsTable,
  analysesTable,
} from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

const ACHIEVEMENT_CATALOG = [
  { id: "first-upload", title: "First Rep", description: "Upload your first training video", icon: "🎬", requiredCount: 1 },
  { id: "five-analyses", title: "Consistent", description: "Complete 5 video analyses", icon: "📊", requiredCount: 5 },
  { id: "ten-analyses", title: "Dedicated", description: "Complete 10 video analyses", icon: "🏆", requiredCount: 10 },
  { id: "streak-7", title: "Week Warrior", description: "Maintain a 7-day training streak", icon: "🔥", requiredCount: 7 },
  { id: "score-80", title: "High Performer", description: "Achieve an overall score of 80+", icon: "⭐", requiredCount: 1 },
  { id: "score-90", title: "Elite Athlete", description: "Achieve an overall score of 90+", icon: "💎", requiredCount: 1 },
  { id: "injury-free", title: "Safe Mover", description: "Complete 5 analyses with no high-risk injuries", icon: "🛡️", requiredCount: 5 },
  { id: "chat-10", title: "Coach's Pet", description: "Send 10 messages to your AI coach", icon: "💬", requiredCount: 10 },
];

async function seedAchievements() {
  for (const a of ACHIEVEMENT_CATALOG) {
    await db
      .insert(achievementsTable)
      .values(a)
      .onConflictDoNothing();
  }
}

// GET /api/achievements
router.get("/achievements", authenticate, async (req: AuthRequest, res) => {
  await seedAchievements();

  const allAchievements = await db.select().from(achievementsTable);

  const userAchievements = await db
    .select()
    .from(userAchievementsTable)
    .where(eq(userAchievementsTable.userId, req.userId!));

  const [{ total: analysisCount }] = await db
    .select({ total: count() })
    .from(analysesTable)
    .where(eq(analysesTable.userId, req.userId!));

  const userMap = new Map(
    userAchievements.map((ua) => [ua.achievementId, ua])
  );

  const result = allAchievements.map((a) => {
    const ua = userMap.get(a.id);
    let progress = ua?.progress ?? 0;

    if (a.id === "first-upload" || a.id === "five-analyses" || a.id === "ten-analyses") {
      progress = Math.min(Number(analysisCount), a.requiredCount);
    }

    return {
      ...a,
      progress,
      total: a.requiredCount,
      unlockedAt: ua?.unlockedAt ?? null,
      unlocked: !!ua?.unlockedAt || progress >= a.requiredCount,
    };
  });

  await checkAndUnlockAchievements(req.userId!, Number(analysisCount), userMap);

  res.json({ achievements: result });
});

async function checkAndUnlockAchievements(
  userId: number,
  analysisCount: number,
  existingMap: Map<string, any>
) {
  const toUnlock: string[] = [];

  if (analysisCount >= 1 && !existingMap.get("first-upload")?.unlockedAt)
    toUnlock.push("first-upload");
  if (analysisCount >= 5 && !existingMap.get("five-analyses")?.unlockedAt)
    toUnlock.push("five-analyses");
  if (analysisCount >= 10 && !existingMap.get("ten-analyses")?.unlockedAt)
    toUnlock.push("ten-analyses");

  for (const achievementId of toUnlock) {
    const existing = existingMap.get(achievementId);
    if (existing) {
      await db
        .update(userAchievementsTable)
        .set({ unlockedAt: new Date(), progress: analysisCount })
        .where(eq(userAchievementsTable.id, existing.id));
    } else {
      await db.insert(userAchievementsTable).values({
        userId,
        achievementId,
        progress: analysisCount,
        total: ACHIEVEMENT_CATALOG.find((a) => a.id === achievementId)?.requiredCount ?? 1,
        unlockedAt: new Date(),
      });
    }
  }
}

export default router;
