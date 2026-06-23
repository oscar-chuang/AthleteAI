import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "./auth";
import { cache } from "../lib/redis";
import { aiRateLimit } from "../middleware/rateLimit";
import { logger } from "../lib/logger";
import { stripUserInputDelimiters } from "../lib/anthropic";
import {
  getChatHistory,
  getChatSuggestions,
  sendChatMessage,
  clearChatHistory,
} from "../services/chatService";

// Re-export for tests that import buildSystemPrompt directly from this module.
export { buildSystemPrompt } from "../lib/ai/chatPrompt";

const chatPostSchema = z.object({
  content: z.string().trim().min(1, "content is required").max(
    4000,
    "Message must be 4000 characters or fewer"
  ),
  referencedAnalysisId: z.string().optional(),
});

const router: IRouter = Router();

router.get("/chat/suggestions", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const result = await getChatSuggestions(userId);
  res.json(result);
});

router.get("/chat", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const result = await getChatHistory(userId);
  res.json(result);
});

router.post("/chat", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
  const userId = req.userId!;

  const parsed = chatPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { content, referencedAnalysisId } = parsed.data;
  const result = await sendChatMessage(userId, content, referencedAnalysisId);

  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({
    userMessage: result.userMessage,
    assistantMessage: result.assistantMessage,
  });
});

router.delete("/chat", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const result = await clearChatHistory(userId);
  res.json(result);
});

export default router;
