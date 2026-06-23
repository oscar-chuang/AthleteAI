import { client, withRetry, sanitizeJoints, type JointKey } from "./types";

export interface CoachingMoment {
  id: string;
  timestamp: number;
  joints: JointKey[];
  whatWeNoticed: string;
  whyItMatters: string;
  suggestedFix: string;
  confidence: number;
  confidenceNote?: string;
  evidence: { joint?: string; angle?: number; timestamp?: number };
  riskLevel: number;
}

export interface FlaggedMoment {
  t: number;
  joints: string[];
  angles: Partial<Record<JointKey, number>>;
  risks: Partial<Record<JointKey, number>>;
}

export interface MovementSummary {
  flowScore: number;
  efficiencyScore: number;
  bodyControlScore: number;
  consistencyScore: number;
  rhythmScore: number;
  overallScore: number;
  topStrengths: string[];
  topImprovements: string[];
  mostImportantFix: string;
  coachSummary: string;
}

const COACHING_MOMENT_SYSTEM = `You are a sports biomechanics coach. Given a list of flagged moments from a video pose-analysis scan, generate concise coaching observations grounded in the measured joint angles. Each observation must cite the specific angle measurement that triggered the flag.

Respond with ONLY a raw JSON array — no markdown, no code fences. Your entire response must be parseable by JSON.parse().

Format: [{
  "id": "cm1",
  "timestamp": <number — seconds>,
  "joints": ["leftKnee"],
  "whatWeNoticed": "<15-20 word plain-language observation citing the exact angle>",
  "whyItMatters": "<15-20 word performance or injury implication>",
  "suggestedFix": "<10-15 word single actionable correction>",
  "confidence": <0.0-1.0>,
  "confidenceNote": "<if confidence < 0.70, one sentence explaining why>",
  "evidence": { "joint": "leftKnee", "angle": 138, "timestamp": 2.4 },
  "riskLevel": <0=strength · 1=technique issue · 2=injury risk>
}]

Rules:
- Only include moments that have real flagged joints with measured angles.
- Merge nearby moments (< 1.5 s apart, same joint) into one.
- Strengths (riskLevel 0) should appear when a joint angle is consistently in the safe range.
- Plain language, no medical jargon.
- Never invent angles — use only the provided measurements.
- Limit to 8 moments maximum. If many moments cluster, pick the most representative.`;

const MOVEMENT_SUMMARY_SYSTEM = `You are a sports biomechanics coach generating a movement quality summary. Respond with ONLY a raw JSON object — no markdown, no code fences, no explanation.

Format:
{
  "flowScore": <integer 40-100>,
  "efficiencyScore": <integer 40-100>,
  "bodyControlScore": <integer 40-100>,
  "consistencyScore": <integer 40-100>,
  "rhythmScore": <integer 40-100>,
  "overallScore": <integer 40-100>,
  "topStrengths": ["<10-15 words>", "<10-15 words>", "<10-15 words>"],
  "topImprovements": ["<10-15 words>", "<10-15 words>", "<10-15 words>"],
  "mostImportantFix": "<20-30 word single most actionable correction>",
  "coachSummary": "<2-3 sentence plain-language narrative grounded in the measured data>"
}

Rules:
- Scores must be grounded in the biomechanical data provided.
- overallScore = weighted average (flow 25%, efficiency 20%, bodyControl 20%, consistency 20%, rhythm 15%).
- Plain language in all text fields. No medical jargon.
- topStrengths and topImprovements must each have exactly 3 items.
- coachSummary must cite at least one specific measured joint angle or risk level.`;

export async function generateCoachingMoments(
  sport: string,
  title: string,
  flaggedMoments: FlaggedMoment[],
  existingTips?: object[]
): Promise<CoachingMoment[]> {
  if (flaggedMoments.length === 0) return [];

  const momentsList = flaggedMoments
    .map((m, i) => {
      const jointDesc = Object.entries(m.angles)
        .filter(([, v]) => v != null)
        .map(([j, v]) => {
          const lvl = m.risks[j as JointKey] ?? 0;
          const riskWord = lvl === 2 ? "HIGH RISK" : lvl === 1 ? "CAUTION" : "safe";
          return `${j}: ${Math.round(v!)}° (${riskWord})`;
        })
        .join(", ");
      return `Moment ${i + 1} — t=${m.t.toFixed(2)}s — ${jointDesc}`;
    })
    .join("\n");

  const tipSummary = existingTips?.length
    ? `\nExisting coaching tips for context:\n${JSON.stringify(existingTips.slice(0, 3), null, 2)}`
    : "";

  const prompt = `Sport: ${sport} — "${title}"

Flagged moments from biomechanics scan:
${momentsList}
${tipSummary}

Generate coaching observations for these flagged moments. For any joints consistently in the safe range across multiple moments, also include one "strength" observation (riskLevel 0).`;

  const message = await withRetry(() => client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: COACHING_MOMENT_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  }));

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const arrMatch = stripped.match(/\[[\s\S]*\]/);
  if (!arrMatch) throw new Error("No JSON array in coaching moments response");

  const parsed = JSON.parse(arrMatch[0]) as CoachingMoment[];

  return parsed
    .filter((m) => m && m.id && m.timestamp != null)
    .map((m, i) => ({
      ...m,
      id: `cm${i + 1}`,
      joints: sanitizeJoints(m.joints),
    }))
    .slice(0, 8);
}

export async function generateMovementSummary(
  sport: string,
  title: string,
  scores: {
    technique?: number; power?: number; balance?: number;
    consistency?: number; mobility?: number; speed?: number; overall?: number;
  },
  jointStats: Array<{ joint: string; avgAngle: number; maxRisk: number; timesFlag: number }>,
  strengths: string[],
  improvements: string[]
): Promise<MovementSummary> {
  const scoreBlock = Object.entries(scores)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: ${Math.round(v!)}`)
    .join(", ");

  const jointBlock = jointStats
    .map((j) => {
      const riskWord = j.maxRisk === 2 ? "HIGH RISK" : j.maxRisk === 1 ? "caution" : "safe";
      return `${j.joint}: avg ${Math.round(j.avgAngle)}° (${riskWord}, flagged ${j.timesFlag}× across scan)`;
    })
    .join("\n");

  const prompt = `Sport: ${sport} — "${title}"

AI coaching scores: ${scoreBlock || "not available"}

Joint readings across scan:
${jointBlock || "No joint data available"}

Existing strengths: ${strengths.join("; ") || "none"}
Existing improvements: ${improvements.join("; ") || "none"}

Generate a movement quality summary with five dimension scores and narrative. Use the joint angle data to ground your scores — joints flagged HIGH RISK should pull bodyControl and consistency scores lower.`;

  const message = await withRetry(() => client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: MOVEMENT_SUMMARY_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  }));

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const objMatch = stripped.match(/\{[\s\S]*\}/);
  if (!objMatch) throw new Error("No JSON in movement summary response");

  const parsed = JSON.parse(objMatch[0]) as MovementSummary;

  const clamp = (v: number) => Math.max(40, Math.min(100, Math.round(v || 50)));
  parsed.flowScore = clamp(parsed.flowScore);
  parsed.efficiencyScore = clamp(parsed.efficiencyScore);
  parsed.bodyControlScore = clamp(parsed.bodyControlScore);
  parsed.consistencyScore = clamp(parsed.consistencyScore);
  parsed.rhythmScore = clamp(parsed.rhythmScore);
  parsed.overallScore = Math.round(
    parsed.flowScore * 0.25 +
    parsed.efficiencyScore * 0.20 +
    parsed.bodyControlScore * 0.20 +
    parsed.consistencyScore * 0.20 +
    parsed.rhythmScore * 0.15
  );
  if (!Array.isArray(parsed.topStrengths) || parsed.topStrengths.length === 0) {
    parsed.topStrengths = strengths.slice(0, 3);
  }
  if (!Array.isArray(parsed.topImprovements) || parsed.topImprovements.length === 0) {
    parsed.topImprovements = improvements.slice(0, 3);
  }
  if (!parsed.mostImportantFix) parsed.mostImportantFix = improvements[0] ?? "Focus on consistent joint alignment";
  if (!parsed.coachSummary) parsed.coachSummary = "Review the joint readings above and work on the flagged areas.";

  return parsed;
}
