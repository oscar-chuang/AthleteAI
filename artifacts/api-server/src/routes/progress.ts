import { Router } from "express";
import { db } from "@workspace/db";
import { progressEntriesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

// GET /api/progress
router.get("/progress", authenticate, async (req: AuthRequest, res) => {
  const entries = await db
    .select()
    .from(progressEntriesTable)
    .where(eq(progressEntriesTable.userId, req.userId!))
    .orderBy(desc(progressEntriesTable.date))
    .limit(90);

  res.json({ entries: entries.reverse() });
});

export default router;
