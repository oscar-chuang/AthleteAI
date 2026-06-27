import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { athleteProfilesTable, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  sport: z.string().optional(),
  level: z.enum(["beginner", "intermediate", "advanced", "elite"]).optional(),
  goals: z.array(z.string()).optional(),
  injuryConcerns: z.array(z.string()).optional(),
  weeklyGoal: z.number().int().min(1).max(14).optional(),
});

// GET /api/profile
router.get("/profile", authenticate, async (req: AuthRequest, res) => {
  const [profile] = await db
    .select()
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.userId, req.userId!))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, req.userId!))
    .limit(1);

  res.json({ profile, subscription });
});

// PATCH /api/profile
router.patch("/profile", authenticate, async (req: AuthRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const [updated] = await db
    .update(athleteProfilesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(athleteProfilesTable.userId, req.userId!))
    .returning();

  res.json({ profile: updated });
});

export default router;
