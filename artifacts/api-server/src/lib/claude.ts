import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an elite AI sports performance coach named Atlas, built into AthleteAI.
You have deep expertise in biomechanics, sports science, injury prevention, and athletic performance across all sports.

Your coaching style is:
- Data-driven and specific (reference scores, metrics, and analysis results when available)
- Encouraging but honest about areas needing improvement
- Practical (give actionable drills and cues, not generic advice)
- Concise (respond in 2-4 paragraphs max unless a detailed breakdown is requested)

When the user shares analysis data, reference it specifically in your response.
Always end with a concrete next step or drill the athlete can do today.`;

export async function chatWithCoach(
  messages: { role: "user" | "assistant"; content: string }[],
  context?: {
    sport?: string;
    level?: string;
    recentAnalysis?: {
      title: string;
      scores: Record<string, number>;
      improvements: string[];
    };
  }
): Promise<string> {
  const systemWithContext = context
    ? `${SYSTEM_PROMPT}\n\nAthlete context:\n- Sport: ${context.sport ?? "unknown"}\n- Level: ${context.level ?? "unknown"}${
        context.recentAnalysis
          ? `\n- Most recent analysis: "${context.recentAnalysis.title}"\n  Scores: ${JSON.stringify(context.recentAnalysis.scores)}\n  Top improvements needed: ${context.recentAnalysis.improvements.slice(0, 2).join("; ")}`
          : ""
      }`
    : SYSTEM_PROMPT;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemWithContext,
    messages,
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text;
}

export async function generateAnalysis(input: {
  sport: string;
  title: string;
  level: string;
  duration: number;
  jointAngles?: Record<string, number>;
  goals?: string[];
  injuryConcerns?: string[];
}): Promise<{
  scores: {
    overall: number;
    technique: number;
    power: number;
    balance: number;
    consistency: number;
    mobility: number;
    speed: number;
  };
  strengths: string[];
  improvements: string[];
  tips: {
    category: string;
    severity: string;
    title: string;
    description: string;
    drill: string;
  }[];
  injuryRisks: {
    joint: string;
    riskPercent: number;
    description: string;
    prevention: string;
  }[];
}> {
  const prompt = `Analyze a ${input.sport} training video titled "${input.title}" for a ${input.level} athlete.
Duration: ${input.duration}s
${input.jointAngles ? `Detected joint angles: ${JSON.stringify(input.jointAngles)}` : ""}
${input.goals ? `Athlete goals: ${input.goals.join(", ")}` : ""}
${input.injuryConcerns ? `Injury concerns: ${input.injuryConcerns.join(", ")}` : ""}

Return a JSON object with exactly this structure (no markdown, pure JSON):
{
  "scores": {
    "overall": <50-95>,
    "technique": <40-98>,
    "power": <40-98>,
    "balance": <40-98>,
    "consistency": <40-98>,
    "mobility": <40-98>,
    "speed": <40-98>
  },
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "tips": [
    {
      "category": "<technique|injury-risk|mobility|strength|conditioning>",
      "severity": "<info|warning|critical>",
      "title": "<short title>",
      "description": "<2-3 sentence biomechanical explanation>",
      "drill": "<specific drill with sets/reps>"
    }
  ],
  "injuryRisks": [
    {
      "joint": "<joint name>",
      "riskPercent": <10-75>,
      "description": "<why this joint is at risk>",
      "prevention": "<specific prevention strategy>"
    }
  ]
}

Provide 3 tips and 2 injury risks. Make scores realistic and vary them meaningfully.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");

  const text = block.text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  const parsed = JSON.parse(text);
  return parsed;
}
