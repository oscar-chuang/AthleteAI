// Claude API integration for video movement analysis.
// Uses the Messages API directly via fetch so the Anthropic SDK is not required.

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 3000;

type Sport =
  | "fencing" | "weightlifting" | "basketball" | "volleyball"
  | "golf" | "tennis" | "baseball" | "soccer" | "swimming"
  | "running" | "gymnastics" | "other";

export interface CoachingTip {
  id: string;
  category: "technique" | "injury-risk" | "strength" | "mobility" | "timing";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  drill?: string;
}

export interface InjuryRisk {
  joint: string;
  risk: number;
  description: string;
  prevention: string;
}

export interface AnalysisResult {
  tips: CoachingTip[];
  injuryRisks: InjuryRisk[];
}

// Sport-specific anatomy context fed into the prompt so Claude can give
// targeted advice with anatomically correct references and drill prescriptions.
const SPORT_CONTEXT: Record<Sport, string> = {
  weightlifting:
    "Barbell weightlifting (snatch / clean & jerk). Key anatomy: posterior chain (glutes, hamstrings, erectors), quad dominance, shoulder girdle stability (rotator cuff, traps, lats). Ideal knee tracking: over 2nd–3rd toe. Drills should reference sets × reps or timed holds (e.g. 3×5 paused squats, 2×8 Romanian deadlifts).",
  fencing:
    "Competitive fencing (foil / épée / sabre). Key anatomy: hip flexors, adductors, knee-tracking lunge, shoulder external rotation, wrist pronation/supination. Footwork drills: advance-retreat, fleche. Prescribe repetition counts (e.g. 4×10 lateral lunges).",
  basketball:
    "Basketball. Key anatomy: achilles / calf complex, knee valgus control, shoulder elevation arc, core anti-rotation. Drills: plyometric box jumps 3×8, lateral band walks 2×12, drop-step footwork.",
  volleyball:
    "Volleyball. Key anatomy: shoulder rotator cuff (external rotation), hip abductors for blocking, ankle dorsiflexion, thoracic extension. Drills: banded shoulder circles 3×15, single-leg squat 3×10.",
  golf:
    "Golf swing. Key anatomy: thoracic rotation, hip separation, trail-knee stability, lead-wrist flexion. Drills: hip-hinge with a club along spine 2×20 reps, half-swing tempo work.",
  tennis:
    "Tennis. Key anatomy: rotator cuff (internal/external rotation), forearm supination/pronation, hip rotation, knee bend at split-step. Drills: medicine ball rotational throw 3×10, split-step practice.",
  baseball:
    "Baseball pitching/batting. Key anatomy: glenohumeral internal rotation, elbow valgus load, hip-shoulder separation, stride length. Drills: shoulder sleeper stretches 2×45 s/side, hip separation plyo throws.",
  soccer:
    "Soccer. Key anatomy: hip flexors, knee valgus, ankle stability, hamstring-to-quad ratio. Drills: Nordic curls 3×6, single-leg balance 3×30 s, hip external-rotation clams 2×15.",
  swimming:
    "Swimming. Key anatomy: shoulder impingement risk, thoracic extension, hip flexor tightness from kicking. Drills: band pull-aparts 3×20, prone cobra 3×20 s, ankle mobility circles.",
  running:
    "Distance / sprint running. Key anatomy: hip flexors, Achilles / calf eccentric load, knee valgus collapse, arm-drive efficiency. Drills: A-skips 3×20 m, calf raises 3×15, glute bridges 3×12.",
  gymnastics:
    "Gymnastics. Key anatomy: wrist extension load, elbow hyperextension, lumbar hyperlordosis, hip flexor / hamstring balance. Drills: wrist circles 2×20, Jefferson curls 3×8, pancake stretch 3×30 s.",
  other:
    "General athletic movement. Focus on knee-over-toe alignment, neutral spine, shoulder-packing, and hip-hinge mechanics. Prescribe accessory drills with sets × reps.",
};

function buildPrompt(sport: Sport, jointSummary: string): string {
  const ctx = SPORT_CONTEXT[sport] ?? SPORT_CONTEXT.other;
  return `You are an elite sports-biomechanics coach analysing a ${sport} athlete's video.

Sport context:
${ctx}

Joint-angle summary from the AI pose model (in degrees):
${jointSummary}

Return ONLY valid JSON in the following shape — no markdown, no extra keys:
{
  "tips": [
    {
      "id": "t1",
      "category": "technique|injury-risk|strength|mobility|timing",
      "severity": "info|warning|critical",
      "title": "Short action-oriented title",
      "description": "2–3 sentences explaining the observation and why it matters.",
      "drill": "Concrete drill with sets × reps or duration (omit if not applicable)"
    }
  ],
  "injuryRisks": [
    {
      "joint": "Joint name",
      "risk": 0-100,
      "description": "1–2 sentences on the observed pattern and mechanism.",
      "prevention": "1–2 sentence prevention strategy with specific exercise or cue."
    }
  ]
}

Requirements:
- Exactly 5 tips covering a mix of categories relevant to this sport.
- Exactly 3 injury risks for the joints with the highest observed stress.
- Be specific: reference angles, sport-specific anatomy, and drills with sets/reps.
- Do NOT fabricate angles not present in the summary; mark unknown joints as "–".
`;
}

export async function analyseMovement(
  sport: Sport,
  jointSummary: string,
  apiKey: string,
): Promise<AnalysisResult> {
  const prompt = buildPrompt(sport, jointSummary);

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const json = await res.json() as { content: Array<{ type: string; text: string }> };
  const text = json.content.find((b) => b.type === "text")?.text ?? "{}";

  let parsed: AnalysisResult;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Claude returned invalid JSON: ${text.slice(0, 200)}`);
  }

  // Ensure expected structure exists even if Claude omits fields
  return {
    tips: (parsed.tips ?? []).slice(0, 5),
    injuryRisks: (parsed.injuryRisks ?? []).slice(0, 3),
  };
}
