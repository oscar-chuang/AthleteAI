import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AIAnalysisResult {
  overallScore: number;
  techniqueScore: number;
  powerScore: number;
  balanceScore: number;
  consistencyScore: number;
  mobilityScore: number;
  speedScore: number;
  strengths: string[];
  improvements: string[];
  tips: Array<{
    category: string;
    severity: "info" | "warning" | "critical";
    title: string;
    description: string;
    drill?: string;
  }>;
  injuryRisks: Array<{
    joint: string;
    riskPercent: number;
    description: string;
    prevention: string;
  }>;
}

export async function analyzeAthletePerformance(
  sport: string,
  title: string,
  videoUrl?: string | null
): Promise<AIAnalysisResult> {
  const prompt = `You are an elite sports performance analyst and certified strength & conditioning coach. Analyze this ${sport} training session titled "${title}"${videoUrl ? ` (video: ${videoUrl})` : ""}.

Generate a detailed, specific, actionable analysis for this athlete. Base your analysis on expert knowledge of ${sport} biomechanics, common form issues, and sport-specific injury patterns.

Respond ONLY with a valid JSON object in this exact shape (no markdown, no explanation):
{
  "overallScore": <integer 55-95>,
  "techniqueScore": <integer 50-100>,
  "powerScore": <integer 50-100>,
  "balanceScore": <integer 50-100>,
  "consistencyScore": <integer 50-100>,
  "mobilityScore": <integer 45-100>,
  "speedScore": <integer 50-100>,
  "strengths": [<3 specific strength observations as strings>],
  "improvements": [<3 specific improvement areas as strings>],
  "tips": [
    {
      "category": <"Form"|"Injury Prevention"|"Recovery"|"Mobility"|"Strength"|"Explosiveness">,
      "severity": <"info"|"warning"|"critical">,
      "title": <short tip title>,
      "description": <2-3 sentence coaching cue>,
      "drill": <specific drill with sets/reps>
    }
  ],
  "injuryRisks": [
    {
      "joint": <joint name>,
      "riskPercent": <integer 8-45>,
      "description": <specific risk observation for ${sport}>,
      "prevention": <concrete prevention protocol>
    }
  ]
}

Rules:
- Provide exactly 3 tips and 2-3 injury risks
- Make everything specific to ${sport} — no generic advice
- Scores should be realistic and vary meaningfully (not all the same)
- Drills must be specific with sets/reps/duration
- Injury risks must name the specific joint and mechanism`;

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Anthropic response");

  const parsed = JSON.parse(jsonMatch[0]) as AIAnalysisResult;
  return parsed;
}
