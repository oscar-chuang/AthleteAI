import { client, withRetry } from "./types";

export async function generateProgressSummary(
  sport: string,
  movementType: string | null,
  sessions: Array<{ date: string; overallScore: number; techniqueScore?: number | null }>,
  jointImprovements: Array<{ joint: string; deltaDeg: number; improved: boolean }>,
  personalBest: number,
): Promise<string> {
  if (sessions.length < 2) {
    const movement = movementType && movementType !== "General" ? ` ${movementType}` : "";
    return `You have ${sessions.length === 1 ? "1 session" : "no sessions"} recorded for ${sport}${movement}. Complete more sessions to unlock your personalized progress summary.`;
  }

  const recent = sessions.slice(-5);
  const first = recent[0]!;
  const last = recent[recent.length - 1]!;
  const delta = Math.round(last.overallScore - first.overallScore);
  const movement = movementType && movementType !== "General" ? ` ${movementType}` : "";
  const bestJoint = jointImprovements.filter(j => j.improved).sort((a, b) => Math.abs(b.deltaDeg) - Math.abs(a.deltaDeg))[0];

  const prompt = `You are a sports coach giving a brief, encouraging progress summary to an athlete.
Sport: ${sport}${movement ? `, Movement: ${movement}` : ""}
Recent ${recent.length} sessions: scores from ${Math.round(first.overallScore)} to ${Math.round(last.overallScore)} (${delta >= 0 ? "+" : ""}${delta} points)
Personal best overall score: ${Math.round(personalBest)}
Total sessions: ${sessions.length}
${bestJoint ? `Best improving joint: ${bestJoint.joint} improved ${Math.abs(bestJoint.deltaDeg)}°` : ""}

Write EXACTLY 2-3 short sentences summarizing this athlete's recent ${sport}${movement} progress. Be specific: name the sport, movement type, and actual numbers. Be encouraging but honest. Plain English only, no jargon. No markdown. No prefix like "Summary:" — just the sentences.`;

  const message = await withRetry(() => client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 120,
    messages: [{ role: "user", content: prompt }],
  }));

  return message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();
}
