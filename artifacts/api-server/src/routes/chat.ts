import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db, chatMessagesTable, analysesTable, profilesTable } from "@workspace/db";
import { requireAuth } from "./auth";

const router: IRouter = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HISTORY_LIMIT = 40;

function formatMessage(m: typeof chatMessagesTable.$inferSelect) {
  return {
    id: String(m.id),
    role: m.role as "user" | "assistant",
    content: m.content,
    referencedAnalysisId: m.referencedAnalysisId ? String(m.referencedAnalysisId) : undefined,
    createdAt: m.createdAt.toISOString(),
  };
}

async function buildSystemPrompt(userId: number): Promise<string> {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  const recentAnalyses = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.userId, userId))
    .orderBy(desc(analysesTable.uploadedAt))
    .limit(5);

  const athleteName = profile?.name ? `${profile.name}` : "this athlete";
  const sport = profile?.sport || "general sport";
  const level = profile?.level || "intermediate";
  const goals = profile?.goals?.length ? profile.goals.join(", ") : null;
  const injuries = profile?.injuryConcerns?.filter(i => i !== "No current injuries");

  let systemPrompt = `You are an expert sports performance coach and biomechanics specialist with deep knowledge of ${sport}. You are coaching ${athleteName}, a ${level}-level ${sport} athlete.`;

  if (goals) {
    systemPrompt += `\n\nTheir stated goals: ${goals}.`;
  }

  if (injuries && injuries.length > 0) {
    systemPrompt += `\nActive injury concerns: ${injuries.join(", ")} — always factor these into advice.`;
  }

  if (recentAnalyses.length > 0) {
    systemPrompt += `\n\nRecent training data (most recent first):`;
    for (const a of recentAnalyses) {
      if (a.status !== "complete") continue;
      const scores = [
        a.overallScore != null ? `Overall ${Math.round(a.overallScore)}` : null,
        a.techniqueScore != null ? `Technique ${Math.round(a.techniqueScore)}` : null,
        a.balanceScore != null ? `Balance ${Math.round(a.balanceScore)}` : null,
        a.powerScore != null ? `Power ${Math.round(a.powerScore)}` : null,
        a.mobilityScore != null ? `Mobility ${Math.round(a.mobilityScore)}` : null,
        a.speedScore != null ? `Speed ${Math.round(a.speedScore)}` : null,
        a.consistencyScore != null ? `Consistency ${Math.round(a.consistencyScore)}` : null,
      ].filter(Boolean);

      systemPrompt += `\n- "${a.title}" (${a.sport}, ${new Date(a.uploadedAt).toLocaleDateString()})`;
      if (scores.length) systemPrompt += ` — ${scores.join(", ")}`;
      if (a.strengths?.length) systemPrompt += `\n  Strengths: ${a.strengths.slice(0, 2).join("; ")}`;
      if (a.improvements?.length) systemPrompt += `\n  Needs work: ${a.improvements.slice(0, 2).join("; ")}`;
    }
  } else {
    systemPrompt += `\n\nThis athlete has no completed analyses yet.`;
  }

  systemPrompt += `\n\nCoaching style:
- Talk to them like a knowledgeable coach, not a textbook
- Reference their actual data when it's relevant ("your balance score is X, so...")
- Give specific, actionable advice — drills, cues, sets/reps when relevant
- Keep answers focused and practical; athletes want direction, not essays
- If they ask about something outside sport/fitness, politely redirect to training`;

  return systemPrompt;
}

router.get("/chat", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;

  const rows = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, userId))
    .orderBy(chatMessagesTable.createdAt)
    .limit(HISTORY_LIMIT);

  res.json({ messages: rows.map(formatMessage) });
});

router.post("/chat", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const { content, referencedAnalysisId } = req.body as {
    content?: string;
    referencedAnalysisId?: string;
  };

  if (!content?.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  // Save user message
  const [userMsg] = await db
    .insert(chatMessagesTable)
    .values({
      userId,
      role: "user",
      content: content.trim(),
      referencedAnalysisId: referencedAnalysisId ? parseInt(referencedAnalysisId, 10) : null,
    })
    .returning();

  // Build conversation history for Claude (last 20 turns)
  const history = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, userId))
    .orderBy(chatMessagesTable.createdAt)
    .limit(HISTORY_LIMIT);

  const systemPrompt = await buildSystemPrompt(userId);

  const messages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const assistantContent = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  const [assistantMsg] = await db
    .insert(chatMessagesTable)
    .values({
      userId,
      role: "assistant",
      content: assistantContent,
    })
    .returning();

  res.json({
    userMessage: formatMessage(userMsg!),
    assistantMessage: formatMessage(assistantMsg!),
  });
});

router.delete("/chat", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.userId, userId));
  res.json({ success: true });
});

export default router;
