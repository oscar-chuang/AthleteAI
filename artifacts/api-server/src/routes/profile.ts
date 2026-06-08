import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

// Stub profile endpoint — returns null until profiles are fully implemented
router.get("/profile", (_req: Request, res: Response) => {
  res.json({ profile: null, subscription: null });
});

router.patch("/profile", (req: Request, res: Response) => {
  res.json({ profile: null });
});

export default router;
