import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import analysesRouter from "./analyses";
import achievementsRouter from "./achievements";
import progressRouter from "./progress";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(analysesRouter);
router.use(achievementsRouter);
router.use(progressRouter);

export default router;
