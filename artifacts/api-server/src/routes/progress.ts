import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "./auth";
import {
  getSportDistribution,
  getPersonalRecords,
  getProgressSummary,
  getProgressEntries,
} from "../services/progressService";

const router: IRouter = Router();

router.get("/progress/sports", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const result = await getSportDistribution(userId);
  res.json(result);
});

router.get("/progress/personal-records", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const sport = typeof req.query["sport"] === "string" ? req.query["sport"].toLowerCase() : null;
  const result = await getPersonalRecords(userId, sport);
  res.json(result);
});

router.get("/progress/summary", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const sport = typeof req.query["sport"] === "string" ? req.query["sport"].toLowerCase() : null;
  const movementType = typeof req.query["movementType"] === "string" ? req.query["movementType"] : null;

  if (!sport) {
    res.status(400).json({ error: "sport query parameter is required" });
    return;
  }

  const result = await getProgressSummary(userId, sport, movementType);
  res.json(result);
});

router.get("/progress", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const sport = typeof req.query["sport"] === "string" ? req.query["sport"].toLowerCase() : null;
  const movementType = typeof req.query["movementType"] === "string" ? req.query["movementType"] : null;

  const result = await getProgressEntries(userId, sport, movementType);
  res.json(result);
});

export default router;
