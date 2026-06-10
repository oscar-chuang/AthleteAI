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
    tipType: "injury" | "performance";
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
  const prompt = `You are an elite sports performance analyst and certified strength & conditioning coach with expertise in ${sport} biomechanics. Analyze this training session titled "${title}"${videoUrl ? ` (video: ${videoUrl})` : ""}.

Generate a highly specific, research-informed analysis in two distinct categories:

INJURY PREVENTION — based on biomechanics research (Escamilla et al. 2001, Hewett et al. 2005, Heiderscheit et al. 2011, Decker et al. 2003): identify movement patterns that increase injury risk and how to correct them.

PERFORMANCE & EFFICIENCY — based on sports science research (Moore 2016 on running economy, Saunders et al. 2004, Glassbrook et al. 2017 on squat mechanics, Kibler et al. 2006 on core stability, Cavanagh & Williams 1982 on stride optimization): identify biomechanical improvements that will directly improve ${sport} performance, power output, and movement efficiency.

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
      "tipType": "injury",
      "category": <"Injury Prevention"|"Recovery">,
      "severity": <"warning"|"critical">,
      "title": <short specific title>,
      "description": <2-3 sentence coaching cue with the specific mechanism and risk>,
      "drill": <specific corrective drill with sets/reps/duration>
    },
    {
      "tipType": "injury",
      "category": <"Injury Prevention"|"Recovery">,
      "severity": <"warning"|"critical">,
      "title": <short specific title>,
      "description": <2-3 sentence coaching cue>,
      "drill": <specific corrective drill with sets/reps/duration>
    },
    {
      "tipType": "performance",
      "category": <"Form"|"Strength"|"Mobility"|"Explosiveness"|"Speed"|"Efficiency">,
      "severity": "info",
      "title": <short specific title focused on performance gain>,
      "description": <2-3 sentence coaching cue explaining the performance benefit and how it applies to ${sport}>,
      "drill": <specific performance drill with sets/reps/duration and expected adaptation>
    },
    {
      "tipType": "performance",
      "category": <"Form"|"Strength"|"Mobility"|"Explosiveness"|"Speed"|"Efficiency">,
      "severity": "info",
      "title": <short specific title>,
      "description": <2-3 sentence coaching cue>,
      "drill": <specific performance drill with sets/reps/duration>
    },
    {
      "tipType": "performance",
      "category": <"Form"|"Strength"|"Mobility"|"Explosiveness"|"Speed"|"Efficiency">,
      "severity": "info",
      "title": <short specific title>,
      "description": <2-3 sentence coaching cue>,
      "drill": <specific performance drill>
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
- Provide exactly 2 injury tips and 3 performance tips (5 total)
- Provide 2-3 injury risks
- Make EVERYTHING specific to ${sport} — no generic advice
- Performance tips must explain the direct performance benefit (more power, faster times, better economy, etc.)
- Injury tips must name the specific mechanism and joint
- Drills must be specific with sets/reps/duration
- Scores should vary meaningfully from each other`;

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
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
