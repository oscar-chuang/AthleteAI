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

// Research literature by sport, used to ground the AI prompt
const SPORT_RESEARCH: Record<string, { injury: string; performance: string }> = {
  running: {
    injury: "Heiderscheit et al. (2011, J Orthop Sports Phys Ther) on step rate and joint loading; Novacheck (1998, Gait Posture) on running injury biomechanics",
    performance: "Moore (2016, Sports Med) on modifiable biomechanical factors in running economy; Saunders et al. (2004, Sports Med) on factors affecting running economy; Cavanagh & Williams (1982, Med Sci Sports Exerc) on stride length and oxygen uptake; Mann & Herman (1985, Int J Sport Biomech) on Olympic sprint kinematics",
  },
  weightlifting: {
    injury: "Escamilla et al. (2001, Med Sci Sports Exerc) on squat knee biomechanics; Schoenfeld (2010, J Strength Cond Res) on deep squat patellar tendon stress",
    performance: "Garhammer (1993, J Strength Cond Res) on Olympic lifting power output; Stone et al. (2006, Strength Cond J) on weightlifting technique principles; Comfort et al. (2012, J Strength Cond Res) on clean derivatives and power development; Glassbrook et al. (2017, J Strength Cond Res) on squat technique and muscle activation",
  },
  powerlifting: {
    injury: "Hales et al. (2009, J Strength Cond Res) on powerlifting spine neutral; Escamilla et al. (2001) on knee biomechanics under load",
    performance: "Glassbrook et al. (2017, J Strength Cond Res) on high-bar vs low-bar squat mechanics; Garhammer (1993) on power output in strength sports; Stone et al. (2006) on technique principles for maximal force expression",
  },
  crossfit: {
    injury: "Escamilla et al. (2001) on squat knee safety; Hewett et al. (2005, Am J Sports Med) on knee valgus and ACL risk under fatigue",
    performance: "Glassbrook et al. (2017) on squat mechanics; Garhammer (1993) on Olympic lifting power; Moore (2016, Sports Med) on metabolic efficiency; Kibler et al. (2006, Sports Med) on core stability for multi-modal performance",
  },
  basketball: {
    injury: "Hewett et al. (2005, Am J Sports Med) on knee valgus and ACL risk in landing; Decker et al. (2003, Clin Biomech) on lower extremity landing mechanics",
    performance: "Struzik et al. (2014, J Hum Kinet) on jump shot biomechanics and muscle activation; Pojskic et al. (2014, J Hum Kinet) on shooting performance under fatigue; Abdelkrim et al. (2007, Br J Sports Med) on basketball game movement demands and positional efficiency",
  },
  soccer: {
    injury: "Hewett et al. (2005, Am J Sports Med) on ACL risk mechanics; Heiderscheit et al. (2011) on lower limb loading during repeated sprints",
    performance: "Kellis & Katis (2007, J Sports Sci Med) on instep kick biomechanics and ball velocity; Stølen et al. (2005, Sports Med) on soccer physiology and movement efficiency; Nunome et al. (2002, Med Sci Sports Exerc) on three-dimensional kicking kinematics",
  },
  football: {
    injury: "Hewett et al. (2005) on ACL risk in cutting and deceleration; Decker et al. (2003) on landing mechanics",
    performance: "Brechue (2011, Int J Sports Physiol Perform) on football-specific performance characteristics; Gabbett (2016, Br J Sports Med) on training load, explosiveness, and sport-specific conditioning; Kibler et al. (2006, Sports Med) on core stability for explosive movements",
  },
  volleyball: {
    injury: "Hewett et al. (2005) on ACL risk in jump-land patterns; Decker et al. (2003) on landing mechanics for repeated jump athletes",
    performance: "Sheppard et al. (2008, J Strength Cond Res) on vertical jump performance and approach mechanics; Palao et al. (2014, Int J Sports Sci Coach) on spiking biomechanics and attack efficiency; Kibler et al. (2006, Sports Med) on shoulder and core stability for overhead athletes",
  },
  tennis: {
    injury: "Norkin & White (2009) on elbow and shoulder ROM limits; Hewett et al. (2005) on lower body mechanics during lateral movement",
    performance: "Elliott (2006, Br J Sports Med) on tennis biomechanics and stroke efficiency; Reid et al. (2008, Med Sci Sports Exerc) on lower-limb coordination and shoulder mechanics in the serve; Kibler et al. (2006, Sports Med) on core stability and kinetic chain for stroke power",
  },
  baseball: {
    injury: "Fleisig et al. (1995, Am J Sports Med) on elbow and shoulder kinetics during pitching; Dillman et al. (1993, J Orthop Sports Phys Ther) on pitching mechanics and injury prevention",
    performance: "Fleisig et al. (1995) on kinetic chain efficiency in pitching; Dillman et al. (1993) on shoulder internal rotation velocity and release mechanics; Kibler et al. (2006, Sports Med) on core and scapular stability for throwing power",
  },
  swimming: {
    injury: "Norkin & White (2009) on shoulder ROM and impingement thresholds; repeated overhead mechanics guidelines",
    performance: "Toussaint & Beek (1992, Sports Med) on freestyle swimming biomechanics and propulsive efficiency; Zamparo et al. (2005, Eur J Appl Physiol) on front crawl energy balance and drag reduction; Kibler et al. (2006, Sports Med) on core stability for rotational power in freestyle and butterfly",
  },
  gymnastics: {
    injury: "Norkin & White (2009) on extreme ROM demands; Hewett et al. (2005) on landing mechanics and joint loading",
    performance: "Arampatzis & Brüggemann (1999, J Biomech) on mechanical energy in giant swing and release elements; Mkaouer et al. (2013, Sci Sports) on performance factors in gymnastics including strength-to-weight and technique; Kibler et al. (2006, Sports Med) on core stability for complex movement sequences",
  },
  cycling: {
    injury: "Norkin & White (2009) on knee and hip ROM; repetitive motion overuse guidelines for cyclists",
    performance: "Faria et al. (2005, Sports Med) on cycling biomechanics, pedaling technique, and metabolic efficiency; Bini & Hume (2014, J Sci Cycling) on saddle height, pedaling technique, and joint power output; Kibler et al. (2006, Sports Med) on core stability for power transfer on the bike",
  },
};

const getResearch = (sport: string) =>
  SPORT_RESEARCH[sport.toLowerCase()] ?? {
    injury: "Hewett et al. (2005) on joint loading and ACL risk; Heiderscheit et al. (2011) on lower limb mechanics",
    performance: "Kibler et al. (2006, Sports Med) on core stability in athletic function; Moore (2016, Sports Med) on movement economy; Glassbrook et al. (2017, J Strength Cond Res) on functional movement mechanics",
  };

const SYSTEM_PROMPT = `You are a friendly sports coach helping everyday athletes improve. Write all text fields in plain, easy-to-understand language — like you're talking to a motivated athlete who is NOT a scientist or medical professional. Avoid jargon (no "valgus collapse", "kinetic chain", "proprioception", "eccentric loading" etc). When you need a technical term, explain it in simple words in the same sentence. Keep sentences short and direct. You MUST respond with ONLY a raw JSON object — no markdown, no code fences, no explanation, no text before or after. Your entire response must be parseable by JSON.parse().

The JSON shape is exactly:
{
  "overallScore": <integer 55-95>,
  "techniqueScore": <integer 50-100>,
  "powerScore": <integer 50-100>,
  "balanceScore": <integer 50-100>,
  "consistencyScore": <integer 50-100>,
  "mobilityScore": <integer 45-100>,
  "speedScore": <integer 50-100>,
  "strengths": ["string", "string", "string"],
  "improvements": ["string", "string", "string"],
  "tips": [
    { "tipType": "injury", "category": "Injury Prevention", "severity": "warning", "title": "string", "description": "string", "drill": "string" },
    { "tipType": "injury", "category": "Injury Prevention", "severity": "warning", "title": "string", "description": "string", "drill": "string" },
    { "tipType": "performance", "category": "Efficiency", "severity": "info", "title": "string", "description": "string", "drill": "string" },
    { "tipType": "performance", "category": "Form", "severity": "info", "title": "string", "description": "string", "drill": "string" },
    { "tipType": "performance", "category": "Strength", "severity": "info", "title": "string", "description": "string", "drill": "string" }
  ],
  "injuryRisks": [
    { "joint": "string", "riskPercent": <8-45>, "description": "string", "prevention": "string" },
    { "joint": "string", "riskPercent": <8-45>, "description": "string", "prevention": "string" }
  ]
}`;

export async function analyzeAthletePerformance(
  sport: string,
  title: string,
  videoUrl?: string | null
): Promise<AIAnalysisResult> {
  const research = getResearch(sport);

  const userPrompt = `Analyze this ${sport} training session titled "${title}"${videoUrl ? ` (video: ${videoUrl})` : ""}.

Use these research sources to ground your analysis:
Injury prevention: ${research.injury}
Performance/efficiency: ${research.performance}

Requirements:
- Write like a coach talking to an athlete — plain English, short sentences, no jargon
- All tips and risks must be SPECIFIC to ${sport} — no generic advice
- 2 injury tips (tipType "injury", severity "warning" or "critical")
- 3 performance tips (tipType "performance", severity "info") — each must name the direct performance benefit in everyday terms (e.g. "run faster", "hit harder", "jump higher")
- 2-3 injury risks naming the specific joint and what could go wrong in plain terms
- Drills must include sets/reps/duration and be written as clear step-by-step instructions
- Score each metric honestly using these bands:
  80–100 = Strong (athlete excels here)
  65–79  = On Track (solid but room to grow)
  below 65 = Focus Here (needs meaningful work)
- Scores must vary meaningfully — do NOT cluster everything in the 70s
- Respond with ONLY the JSON object, nothing else`;

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Strip any accidental markdown fences
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("Anthropic raw response (no JSON found):", text.slice(0, 500));
    throw new Error("No JSON in Anthropic response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as AIAnalysisResult;
  return parsed;
}
