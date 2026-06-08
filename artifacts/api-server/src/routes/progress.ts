import { Router, type IRouter, type Request, type Response } from "express";
import { db, analysesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "./auth";

const router: IRouter = Router();

router.get("/progress", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;

  const rows = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.userId, userId))
    .orderBy(asc(analysesTable.uploadedAt));

  const entries = rows
    .filter((r) => r.overallScore != null)
    .map((r) => ({
      id: String(r.id),
      date: r.uploadedAt.toISOString(),
      overallScore: r.overallScore!,
      techniqueScore: r.techniqueScore ?? undefined,
      powerScore: r.powerScore ?? undefined,
      balanceScore: r.balanceScore ?? undefined,
      consistencyScore: r.consistencyScore ?? undefined,
      mobilityScore: r.mobilityScore ?? undefined,
      speedScore: r.speedScore ?? undefined,
    }));

  res.json({ entries });
});

export default router;
