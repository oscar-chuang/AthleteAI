import { Router, type IRouter, type Request, type Response } from "express";
import { db, analysesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "./auth";

const router: IRouter = Router();

router.get("/achievements", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;

  const [row] = await db
    .select({ total: count() })
    .from(analysesTable)
    .where(eq(analysesTable.userId, userId));

  const totalAnalyses = Number(row?.total ?? 0);

  const achievements = [
    {
      id: "1",
      title: "First Steps",
      description: "Complete your first analysis",
      icon: "play-circle",
      progress: Math.min(totalAnalyses, 1),
      total: 1,
      unlocked: totalAnalyses >= 1,
    },
    {
      id: "2",
      title: "Getting Started",
      description: "Complete 5 analyses",
      icon: "trending-up",
      progress: Math.min(totalAnalyses, 5),
      total: 5,
      unlocked: totalAnalyses >= 5,
    },
    {
      id: "3",
      title: "Consistent Athlete",
      description: "Complete 10 analyses",
      icon: "award",
      progress: Math.min(totalAnalyses, 10),
      total: 10,
      unlocked: totalAnalyses >= 10,
    },
    {
      id: "4",
      title: "Dedicated",
      description: "Complete 25 analyses",
      icon: "star",
      progress: Math.min(totalAnalyses, 25),
      total: 25,
      unlocked: totalAnalyses >= 25,
    },
    {
      id: "5",
      title: "Form Master",
      description: "Complete 50 analyses",
      icon: "zap",
      progress: Math.min(totalAnalyses, 50),
      total: 50,
      unlocked: totalAnalyses >= 50,
    },
  ];

  res.json({ achievements });
});

export default router;
