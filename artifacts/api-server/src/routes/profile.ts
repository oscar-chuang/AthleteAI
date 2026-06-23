import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "./auth";
import {
  getProfile,
  patchProfile,
  getProfileStats,
  compressAvatarIfNeeded,
  type PatchProfileBody,
} from "../services/profileService";

// Re-export for tests that import compressAvatarIfNeeded directly from this module.
export { compressAvatarIfNeeded };

const router: IRouter = Router();

router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { profile } = await getProfile(userId);
  res.json({
    profile: profile ?? null,
    subscription: { id: "free", userId: String(userId), tier: "free", status: "active" },
  });
});

router.patch("/profile", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const body = req.body as PatchProfileBody;

  const result = await patchProfile(userId, body);
  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ profile: result.profile });
});

router.get("/profile/stats", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const result = await getProfileStats(userId);
  res.json(result);
});

export default router;
