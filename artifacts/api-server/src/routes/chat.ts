import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  chatMessagesTable,
  analysesTable,
  athleteProfilesTable,
  subscriptionsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";
import { chatWithCoach } from "../lib/claude.js";

const router = Router();

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  referencedAnalysisId: z.number().int().positive().optional(),
});

// GET /api/chat — last 50 messages
router.get("/chat", authenticate, async (req: AuthRequest, res) => {
  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, req.userId!))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(50);

  res.json({ messages: messages.reverse() });
});

// POST /api/chat
router.post("/chat", authenticate, async (req: AuthRequest, res) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, req.userId!))
    .limit(1);

  if (subscription?.tier === "free") {
    res.status(403).json({
      error: "AI Coach requires Pro plan",
      code: "UPGRADE_REQUIRED",
      message: "Upgrade to Pro to chat with your AI coach.",
    });
    return;
  }

  // Save user message
  const [userMsg] = await db
    .insert(chatMessagesTable)
    .values({
      userId: req.userId!,
      role: "user",
      content: parsed.data.content,
      referencedAnalysisId: parsed.data.referencedAnalysisId,
    })
    .returning();

  // Gather context
  const [profile] = await db
    .select()
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.userId, req.userId!))
    .limit(1);

  const [recentAnalysis] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.userId, req.userId!))
    .orderBy(desc(analysesTable.uploadedAt))
    .limit(1);

  // Fetch last 10 chat messages for context
  const history = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, req.userId!))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(10);

  const conversationHistory = history
    .reverse()
    .filter((m) => m.id !== userMsg!.id)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  conversationHistory.push({ role: "user", content: parsed.data.content });

  const replyText = await chatWithCoach(conversationHistory, {
    sport: profile?.sport,
    level: profile?.level,
    recentAnalysis: recentAnalysis?.status === "complete"
      ? {
          title: recentAnalysis.title,
          scores: {
            overall: recentAnalysis.overallScore ?? 0,
            technique: recentAnalysis.techniqueScore ?? 0,
            power: recentAnalysis.powerScore ?? 0,
            balance: recentAnalysis.balanceScore ?? 0,
          },
          improvements: (recentAnalysis.improvements as string[]) ?? [],
        }
      : undefined,
  });

  const [assistantMsg] = await db
    .insert(chatMessagesTable)
    .values({
      userId: req.userId!,
      role: "assistant",
      content: replyText,
    })
    .returning();

  res.json({ userMessage: userMsg, assistantMessage: assistantMsg });
});

// DELETE /api/chat — clear history
router.delete("/chat", authenticate, async (req: AuthRequest, res) => {
  await db
    .delete(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, req.userId!));

  res.json({ success: true });
});

export default router;
