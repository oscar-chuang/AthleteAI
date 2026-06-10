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

export async function analyzeAthletePerformance(
  sport: string,
  title: string,
  videoUrl?: string | null
): Promise<AIAnalysisResult> {
  const research = getResearch(sport);

  const prompt = `You are an elite sports performance analyst and certified strength & conditioning coach with deep expertise in ${sport} biomechanics. Analyze this training session titled "${title}"${videoUrl ? ` (video: ${videoUrl})` : ""}.

Generate a highly specific, research-informed analysis split into two distinct categories:

INJURY PREVENTION — grounded in:
${research.injury}
Identify movement patterns that increase injury risk and how to correct them.

PERFORMANCE & EFFICIENCY — grounded in:
${research.performance}
Identify biomechanical improvements that will directly improve ${sport} performance, power output, technique efficiency, and movement economy.

Respond ONLY with a valid JSON object in this exact shape (no markdown, no explanation):
{
  "overallScore": <integer 55-95>,
  "techniqueScore": <integer 50-100>,
  "powerScore": <integer 50-100>,
  "balanceScore": <integer 50-100>,
  "consistencyScore": <integer 50-100>,
  "mobilityScore": <integer 45-100>,
  "speedScore": <integer 50-100>,
  "strengths": [<3 specific strength observations for a ${sport} athlete>],
  "improvements": [<3 specific improvement areas for a ${sport} athlete>],
  "tips": [
    {
      "tipType": "injury",
      "category": "Injury Prevention",
      "severity": <"warning"|"critical">,
      "title": <specific title naming the risk and joint>,
      "description": <2-3 sentences: what the risk mechanism is and why it matters in ${sport}>,
      "drill": <specific corrective drill with sets/reps/duration>
    },
    {
      "tipType": "injury",
      "category": "Injury Prevention",
      "severity": <"warning"|"critical">,
      "title": <specific title>,
      "description": <2-3 sentences>,
      "drill": <specific corrective drill>
    },
    {
      "tipType": "performance",
      "category": <"Form"|"Strength"|"Mobility"|"Explosiveness"|"Speed"|"Efficiency"|"Technique">,
      "severity": "info",
      "title": <specific title naming the performance gain>,
      "description": <2-3 sentences: what to do, how it applies to ${sport}, and what performance benefit it delivers (e.g. more power, faster splits, better economy)>,
      "drill": <specific ${sport} performance drill with sets/reps/duration and expected adaptation>
    },
    {
      "tipType": "performance",
      "category": <"Form"|"Strength"|"Mobility"|"Explosiveness"|"Speed"|"Efficiency"|"Technique">,
      "severity": "info",
      "title": <specific title>,
      "description": <2-3 sentences>,
      "drill": <specific drill>
    },
    {
      "tipType": "performance",
      "category": <"Form"|"Strength"|"Mobility"|"Explosiveness"|"Speed"|"Efficiency"|"Technique">,
      "severity": "info",
      "title": <specific title>,
      "description": <2-3 sentences>,
      "drill": <specific drill>
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
- Every tip and risk must be SPECIFIC to ${sport} — no generic advice
- Performance tips must name the direct performance benefit (e.g. "increases serve velocity", "improves stroke efficiency", "reduces ground contact time")
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
