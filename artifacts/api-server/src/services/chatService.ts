import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "../lib/ai/chatPrompt";
import {
  findMessages, createMessage, deleteMessages, findAnalysisOwnership,
  findLatestCompletedAnalysis,
} from "../repositories/chatRepository";
import { cache } from "../lib/redis";
import { logger } from "../lib/logger";
import { stripUserInputDelimiters } from "../lib/anthropic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HISTORY_LIMIT = 40;
const MAX_CONTENT_LENGTH = 4000;

export function formatMessage(m: {
  id: number; role: string; content: string;
  referencedAnalysisId: number | null; createdAt: Date;
}) {
  return {
    id: String(m.id),
    role: m.role as "user" | "assistant",
    content: m.content,
    referencedAnalysisId: m.referencedAnalysisId ? String(m.referencedAnalysisId) : undefined,
    createdAt: m.createdAt.toISOString(),
  };
}

function getWorstMetric(a: {
  techniqueScore: number | null; powerScore: number | null; balanceScore: number | null;
  consistencyScore: number | null; mobilityScore: number | null; speedScore: number | null;
}): string {
  const metrics: [string, number | null][] = [
    ["technique", a.techniqueScore],
    ["power", a.powerScore],
    ["balance", a.balanceScore],
    ["consistency", a.consistencyScore],
    ["mobility", a.mobilityScore],
    ["speed", a.speedScore],
  ];
  const scored = metrics.filter((m): m is [string, number] => m[1] != null);
  if (!scored.length) return "technique";
  return scored.sort((x, y) => x[1] - y[1])[0]![0];
}

export async function getChatHistory(userId: number) {
  const rows = await findMessages(userId, HISTORY_LIMIT);
  return { messages: rows.map(formatMessage) };
}

export async function getChatSuggestions(userId: number) {
  const { value } = await cache.getOrSet(
    `suggestions:${userId}`,
    120,
    async () => {
      const latest = await findLatestCompletedAnalysis(userId);
      const sport = latest?.sport ?? "general";
      const worst = latest ? getWorstMetric(latest) : null;

      const scoreMap: Record<string, number | null | undefined> = {
        technique: latest?.techniqueScore,
        power: latest?.powerScore,
        balance: latest?.balanceScore,
        consistency: latest?.consistencyScore,
        mobility: latest?.mobilityScore,
        speed: latest?.speedScore,
      };
      const worstKey = worst ?? "technique";
      const suggestions = latest ? [
        `How do I improve my ${worstKey} score from ${Math.round(scoreMap[worstKey] ?? 0)}?`,
        `Give me a weekly drill plan for my ${sport} training`,
        "What are my biggest injury risks right now?",
        "How can I make my next session more effective?",
      ] : [
        "How do I start improving my athletic performance?",
        "What should a beginner focus on first?",
        "How often should I record and analyze my sessions?",
        "What are the most impactful drills for any sport?",
      ];

      return { suggestions, hasCompletedAnalyses: !!latest };
    }
  );
  return value;
}

export async function sendChatMessage(
  userId: number,
  content: string | undefined,
  referencedAnalysisId: string | undefined,
) {
  if (!content?.trim()) return { error: "content is required", status: 400 };
  if (content.length > MAX_CONTENT_LENGTH) {
    return { error: `Message must be ${MAX_CONTENT_LENGTH} characters or fewer`, status: 400 };
  }

  let resolvedAnalysisId: number | null = null;
  if (referencedAnalysisId) {
    const analysisId = parseInt(referencedAnalysisId, 10);
    if (!isNaN(analysisId)) {
      const owned = await findAnalysisOwnership(analysisId, userId);
      resolvedAnalysisId = owned?.id ?? null;
    }
  }

  const userMsg = await createMessage({
    userId, role: "user", content: content.trim(),
    referencedAnalysisId: resolvedAnalysisId,
  });

  const history = await findMessages(userId, HISTORY_LIMIT);
  const systemPrompt = await buildSystemPrompt(userId);
  const messages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.role === "user"
      ? `<user_input>${stripUserInputDelimiters(m.content)}</user_input>`
      : m.content,
  }));

  let response;
  try {
    response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });
  } catch (err) {
    logger.error({ err }, "Anthropic API error in POST /chat");
    return { error: "Coach is temporarily unavailable. Please try again in a moment.", status: 500 };
  }

  const assistantContent = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  const assistantMsg = await createMessage({ userId, role: "assistant", content: assistantContent });

  await cache.invalidate(`suggestions:${userId}`);

  return {
    userMessage: formatMessage(userMsg),
    assistantMessage: formatMessage(assistantMsg),
    status: 200,
  };
}

export async function clearChatHistory(userId: number) {
  await deleteMessages(userId);
  return { success: true };
}
