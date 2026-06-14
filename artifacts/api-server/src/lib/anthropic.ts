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
    injury: "Heiderscheit et al. (2011, J Orthop Sports Phys Ther) on step rate and joint loading; Novacheck (1998, Gait Posture) on running injury biomechanics; van Gent et al. (2007, Br J Sports Med) on lower-limb running injuries",
    performance: "Moore (2016, Sports Med) on modifiable biomechanical factors in running economy; Saunders et al. (2004, Sports Med) on factors affecting running economy; Cavanagh & Williams (1982, Med Sci Sports Exerc) on stride length and oxygen uptake; Weyand et al. (2000, J Appl Physiol) on ground forces and top running speed",
  },
  weightlifting: {
    injury: "Escamilla et al. (2001, Med Sci Sports Exerc) on squat knee biomechanics; Schoenfeld (2010, J Strength Cond Res) on deep squat patellar tendon stress; Calhoon & Fry (1999, J Athl Train) on weightlifting injury rates",
    performance: "Garhammer (1993, J Strength Cond Res) on Olympic lifting power output; Stone et al. (2006, Strength Cond J) on weightlifting technique principles; Comfort et al. (2012, J Strength Cond Res) on clean derivatives and power development; Glassbrook et al. (2017, J Strength Cond Res) on squat technique and muscle activation",
  },
  powerlifting: {
    injury: "Hales et al. (2009, J Strength Cond Res) on powerlifting spine neutral; Escamilla et al. (2001) on knee biomechanics under load; Siewe et al. (2011, J Strength Cond Res) on powerlifting injuries",
    performance: "Glassbrook et al. (2017, J Strength Cond Res) on high-bar vs low-bar squat mechanics; Garhammer (1993) on power output in strength sports; Cholewa et al. (2017, J Strength Cond Res) on strength training programming and performance",
  },
  crossfit: {
    injury: "Escamilla et al. (2001) on squat knee safety; Hewett et al. (2005, Am J Sports Med) on knee valgus and ACL risk under fatigue; Weisenthal et al. (2014, Orthop J Sports Med) on CrossFit injury patterns",
    performance: "Glassbrook et al. (2017) on squat mechanics; Garhammer (1993) on Olympic lifting power; Moore (2016, Sports Med) on metabolic efficiency; Kibler et al. (2006, Sports Med) on core stability for multi-modal performance",
  },
  basketball: {
    injury: "Hewett et al. (2005, Am J Sports Med) on knee valgus and ACL risk in landing; Decker et al. (2003, Clin Biomech) on lower extremity landing mechanics; McKay et al. (2001, Br J Sports Med) on ankle sprains in basketball",
    performance: "Struzik et al. (2014, J Hum Kinet) on jump shot biomechanics and muscle activation; Pojskic et al. (2014, J Hum Kinet) on shooting performance under fatigue; Abdelkrim et al. (2007, Br J Sports Med) on basketball game movement demands; Ziv & Lidor (2009, J Strength Cond Res) on vertical jump in basketball",
  },
  soccer: {
    injury: "Hewett et al. (2005, Am J Sports Med) on ACL risk mechanics; Heiderscheit et al. (2011) on lower limb loading; Ekstrand et al. (2011, Br J Sports Med) on muscle injury patterns in professional soccer",
    performance: "Kellis & Katis (2007, J Sports Sci Med) on instep kick biomechanics and ball velocity; Stølen et al. (2005, Sports Med) on soccer physiology and movement efficiency; Nunome et al. (2002, Med Sci Sports Exerc) on three-dimensional kicking kinematics; Reilly et al. (2000, J Sports Sci) on science and soccer",
  },
  football: {
    injury: "Hewett et al. (2005) on ACL risk in cutting and deceleration; Decker et al. (2003) on landing mechanics; Kerr et al. (2008, J Athl Train) on contact and non-contact injuries in American football",
    performance: "Brechue (2011, Int J Sports Physiol Perform) on football-specific performance characteristics; Gabbett (2016, Br J Sports Med) on training load and sport-specific conditioning; Mann & Herman (1985) on sprint kinematics applicable to skill positions",
  },
  volleyball: {
    injury: "Hewett et al. (2005) on ACL risk in jump-land patterns; Decker et al. (2003) on landing mechanics for repeated jump athletes; Briner & Kacmar (1997, Sports Med) on volleyball shoulder injuries",
    performance: "Sheppard et al. (2008, J Strength Cond Res) on vertical jump performance and approach mechanics; Palao et al. (2014, Int J Sports Sci Coach) on spiking biomechanics and attack efficiency; Wagner et al. (2009, J Strength Cond Res) on volleyball-specific strength and performance",
  },
  tennis: {
    injury: "Norkin & White (2009) on elbow and shoulder ROM limits; Abrams et al. (2012, Curr Sports Med Rep) on tennis shoulder and elbow injuries; Hewett et al. (2005) on lower body mechanics during lateral movement",
    performance: "Elliott (2006, Br J Sports Med) on tennis biomechanics and stroke efficiency; Reid et al. (2008, Med Sci Sports Exerc) on lower-limb coordination and shoulder mechanics in the serve; Fernandez et al. (2006, Br J Sports Med) on tennis physiology and movement patterns",
  },
  baseball: {
    injury: "Fleisig et al. (1995, Am J Sports Med) on elbow and shoulder kinetics during pitching; Dillman et al. (1993, J Orthop Sports Phys Ther) on pitching mechanics and injury prevention; Werner et al. (2002, Am J Sports Med) on medial elbow injury in throwers",
    performance: "Fleisig et al. (1995) on kinetic chain efficiency in pitching; Escamilla & Andrews (2009, Sports Med) on shoulder muscle activation in throwing; Dillman et al. (1993) on shoulder internal rotation velocity and release mechanics",
  },
  swimming: {
    injury: "Bak (2010, Int J Sports Med) on swimmer's shoulder — supraspinatus impingement; Wanivenhaus et al. (2012, Sports Health) on swimming overuse injuries; Norkin & White (2009) on shoulder ROM thresholds",
    performance: "Toussaint & Beek (1992, Sports Med) on freestyle swimming biomechanics and propulsive efficiency; Zamparo et al. (2005, Eur J Appl Physiol) on front crawl energy balance and drag reduction; Maglischo EW (2003, Human Kinetics) on swimming fastest technique principles",
  },
  gymnastics: {
    injury: "DiFiori et al. (2012, Br J Sports Med) on overuse injuries in young athletes including gymnasts; Caine et al. (2003, Sports Med) on gymnastics injury epidemiology; Hewett et al. (2005) on landing mechanics and joint loading",
    performance: "Arampatzis & Brüggemann (1999, J Biomech) on mechanical energy in giant swing and release elements; Mkaouer et al. (2013, Sci Sports) on performance factors in gymnastics; Jemni et al. (2006, J Strength Cond Res) on gymnastic strength demands",
  },
  cycling: {
    injury: "Bini et al. (2010, J Sci Med Sport) on knee forces and saddle height in cycling; Silberman et al. (2005, Curr Sports Med Rep) on cycling overuse injuries; repetitive motion overuse guidelines",
    performance: "Faria et al. (2005, Sports Med) on cycling biomechanics, pedaling technique, and metabolic efficiency; Bini & Hume (2014, J Sci Cycling) on saddle height, pedaling technique, and joint power output; Lucia et al. (2001, Med Sci Sports Exerc) on cadence and cycling efficiency",
  },
  fencing: {
    injury: "Roi & Bianchedi (2008, Sports Med) on fencing physiology and asymmetric loading risks; Harmer (2008, Br J Sports Med) on fencing injury patterns — ankle, knee, and weapon-arm shoulder; Piry et al. on lunge mechanics and knee joint stress",
    performance: "Roi & Bianchedi (2008, Sports Med) on lunge velocity, recovery speed, and footwork efficiency; Turner et al. (2014, Int J Sports Physiol Perform) on high-intensity interval demands in fencing; Bottoms et al. (2013) on fencing-specific speed and agility training",
  },
  hockey: {
    injury: "Smith AM et al. (2012, Sports Health) on ice hockey skating injuries; Molsa et al. (2003, Br J Sports Med) on ice hockey injury incidence; Stuart & Smith (1995, Am J Sports Med) on neck and face injuries in hockey",
    performance: "Bracko MR (2004, Strength Cond J) on skating biomechanics and performance; Burr JF et al. (2008, Appl Physiol Nutr Metab) on ice hockey physical demands; Twist & Rhodes (1993, Natl Strength Cond Assoc J) on skating-specific conditioning",
  },
  lacrosse: {
    injury: "Kerr ZY et al. (2015, Orthop J Sports Med) on lacrosse injury epidemiology; Lincoln AE et al. (2007, Am J Sports Med) on head injuries in girls' lacrosse; Shankar PR et al. (2007, Am J Sports Med) on lacrosse injuries by body part",
    performance: "Enemark-Miller EA et al. (2009, J Strength Cond Res) on physiological demands of lacrosse; Sell TC et al. on throwing mechanics applicable to lacrosse; Fleisig et al. (1995) on overhead throwing kinetics",
  },
  rugby: {
    injury: "Brooks JHM & Fuller CW (2006, Sports Med) on rugby union injury epidemiology; Duthie G et al. (2003, Sports Med) on applied physiology and game analysis; Taylor AE et al. (2017, Br J Sports Med) on tackle-related injuries",
    performance: "Duthie G, Pyne D, Hooper S. (2003, Sports Med) on rugby union movement patterns and conditioning demands; Baker D & Nance S (1999, J Strength Cond Res) on speed and power in rugby league; Coutts AJ et al. (2009) on rugby league game demands",
  },
  rowing: {
    injury: "Rumball JS et al. (2005, Am J Sports Med) on rowing injury epidemiology — back, knee, rib stress fractures; McGregor AH et al. (2002, Br J Sports Med) on low back pain in rowers; Stallard (1994) on rib stress fractures in rowing",
    performance: "Soper C & Hume PA (2004, Sports Med) on ideal rowing technique for performance; Nolte V (2011, Meyer & Meyer Sport) on rowing biomechanics and catch angle; Bourdin M et al. (2004, Eur J Appl Physiol) on power and efficiency in rowing",
  },
  boxing: {
    injury: "Bledsoe GH et al. (2005, J Trauma) on boxing injury patterns; Zazryn TR et al. (2003, Br J Sports Med) on boxing injury risk factors; Loosemore M et al. (2007, Br J Sports Med) on amateur boxing injuries",
    performance: "Turner A (2009, Strength Cond J) on strength and conditioning for boxing; Dunn EC et al. (2009, J Strength Cond Res) on punch force and muscle activation; Roschel H et al. (2009, Int J Sports Med) on boxing-specific conditioning and punch velocity",
  },
  wrestling: {
    injury: "Yard EE & Comstock RD (2008, J Athl Train) on wrestling injury surveillance; Pasque CB & Hewett TE (2000) on knee injuries in wrestling; Agel J et al. (2007, J Athl Train) on wrestling injury patterns",
    performance: "Chaabène H et al. (2017, J Strength Cond Res) on physical and physiological attributes of wrestlers; Barbas I et al. (2011, J Strength Cond Res) on physiological and performance characteristics of elite wrestlers; Horswill CA (1992, Sports Med) on applied physiology of amateur wrestling",
  },
  badminton: {
    injury: "Fahlström M et al. (2002, Scand J Med Sci Sports) on badminton shoulder injuries; Shariff AH et al. (2009, Int J Sports Med) on badminton injury incidence; Reeves JL et al. on repetitive overhead arm mechanics",
    performance: "Kuntze G et al. (2010, J Sports Sci) on badminton lunge biomechanics and footwork efficiency; Phomsoupha M & Laffaye G (2015, Sports Med) on badminton science including shuttle speed and jump smash; Chen HL & Chen TC (2008) on badminton footwork and agility",
  },
  golf: {
    injury: "McHardy A et al. (2006, Sports Med) on golf injury epidemiology — lower back, elbow, shoulder; Gosheger G et al. (2003, Am J Sports Med) on golf injuries by body region; Lindsay DM & Vandervoort AA (2014, Sports Med) on golf-related low back pain",
    performance: "Hume PA et al. (2005, Sports Med) on golf biomechanics and swing mechanics; Chu Y et al. (2010, J Orthop Sports Phys Ther) on hip and trunk rotation in the golf swing; McLaughlin P & Best R (1994) on kinematic analysis of the golf swing",
  },
  skiing: {
    injury: "Deibert MC et al. (1998, Am J Sports Med) on skiing injury patterns; Ettlinger CF et al. (1995, Am J Sports Med) on ACL injuries in skiing; Bere T et al. (2011, Br J Sports Med) on World Cup alpine ski injury incidence",
    performance: "Hintermeister RA et al. (1997, Med Sci Sports Exerc) on muscle activity in alpine skiing; Müller E & Schwameder H (2003, J Biomech) on biomechanical aspects of alpine skiing; Reid RC et al. on carved vs skidded turn mechanics",
  },
  volleyball_beach: {
    injury: "Schafle MD et al. (1990, Am J Sports Med) on volleyball injuries; Briner & Kacmar (1997) on shoulder injuries in overhead athletes",
    performance: "Sheppard et al. (2008) on vertical jump and approach mechanics; Forthomme B et al. (2005, Int J Sports Med) on volleyball spike and muscle activity patterns",
  },
};

// Per-sport scoring profiles: which metrics are most diagnostic and typical patterns
// for an average recreational/amateur athlete in each sport
const SPORT_SCORE_PROFILE: Record<string, string> = {
  running: "For a recreational runner: consistency tends to be HIGH (repetitive motion); technique is MEDIUM (posture/cadence issues are common); mobility is often LOW (tight hip flexors and hamstrings); power is LOW for endurance runners but HIGHER for sprinters; speed is the PRIMARY metric. Typical weak areas: mobility and technique.",
  weightlifting: "For an Olympic weightlifter: power is the PRIMARY metric and should reflect whether lifts look explosive; technique is CRITICAL and often LOW for beginners (complex movements take years); mobility is often a BOTTLENECK for overhead positions; balance is key for receiving positions. Typical weak areas: technique and mobility.",
  powerlifting: "For a powerlifter: power and strength are PRIMARY; technique in squat/bench/deadlift determines scores; mobility is often LIMITED especially in hips and thoracic spine; speed is less relevant than force. Typical weak areas: mobility and consistency across the three lifts.",
  crossfit: "For a CrossFit athlete: consistency is the CHALLENGE (varied modalities); technique is MEDIUM for most movements; power and speed are key performance drivers; balance and mobility vary widely. Typical weak areas: technique on Olympic lifts and mobility.",
  basketball: "For a basketball player: speed and power are key; technique (shooting form, footwork) is PRIMARY and often medium; balance in landing is critical; consistency varies by player experience. Typical weak areas: landing mechanics (balance) and shooting technique consistency.",
  soccer: "For a soccer player: speed is a PRIMARY metric; technique (kicking, ball contact) drives performance; consistency across 90 minutes is a real challenge; balance during kicking is important. Typical weak areas: consistency (fatigue) and speed-specific conditioning.",
  football: "For an American football player: power and speed are DOMINANT metrics, typically higher than most sports; technique varies greatly by position; balance in blocking/tackling positions matters. Typical weak areas: mobility and technique for non-linemen.",
  volleyball: "For a volleyball player: technique in jumping and arm swing is PRIMARY; power drives spike velocity; balance in landing after blocks/spikes is critical (often lower); speed of lateral movement is key. Typical weak areas: landing balance and consistency.",
  tennis: "For a tennis player: technique is DOMINANT (stroke mechanics); consistency varies by experience; speed (footwork to ball) is key; power drives serve velocity; balance during lateral movement is important. Typical weak areas: consistency under pressure and mobility.",
  baseball: "For a baseball player: technique in throwing/hitting is extremely diagnostic; power is key for hitters/pitchers; speed matters for fielders and baserunners; consistency is often a weak area. Typical weak areas: technique and mobility (shoulder and hip rotation).",
  swimming: "For a swimmer: technique is PRIMARY (stroke efficiency directly impacts speed); consistency across laps is important; power drives acceleration off turns; mobility in shoulders and ankles is critical and often limited; balance/body position is key. Typical weak areas: technique and mobility.",
  gymnastics: "For a gymnast: technique is the DOMINANT metric; balance is PRIMARY and usually HIGH for experienced gymnasts; mobility is very HIGH compared to other sports; power for vaults and tumbling; consistency is the ongoing challenge. Typical weak areas: consistency and power.",
  cycling: "For a cyclist: consistency is HIGH (repetitive pedaling); technique (pedaling mechanics, position) is MEDIUM; power is the PRIMARY performance driver; speed correlates with power output; mobility is often limited (hip flexors). Typical weak areas: mobility and technique (pedaling efficiency).",
  fencing: "For a fencer: technique is DOMINANT (blade work, point control, attack timing); speed of lunge and recovery is PRIMARY; balance is critical for on-guard position and lunge recovery, often MEDIUM; consistency varies by experience; power is LOWER than strength sports but MATTERS for explosive lunges; mobility is often ASYMMETRIC from one-sided training. Typical weak areas: balance, mobility (asymmetric), and consistency under pressure.",
  hockey: "For a hockey player: speed (skating) is PRIMARY; technique in skating mechanics and stick handling is key; power drives shooting; balance on skates is essential; consistency throughout a game matters. Typical weak areas: technique in skating mechanics and balance.",
  rugby: "For a rugby player: power is HIGH (contact sport demands); speed is key for backs, less so for forwards; technique in tackling and scrummaging matters; balance and consistency under fatigue are important. Typical weak areas: technique and mobility.",
  rowing: "For a rower: technique is DOMINANT (catch angle, drive sequence); consistency is HIGH (repetitive stroke); power is PRIMARY; balance (boat stability) is important; mobility in hips and shoulders limits performance. Typical weak areas: technique (catch timing) and mobility.",
  boxing: "For a boxer: technique (punch mechanics, guard position, footwork) is PRIMARY; speed is critical; balance and guard position matter constantly; power varies by weight class; consistency under fatigue is the challenge. Typical weak areas: technique under fatigue and consistency.",
  wrestling: "For a wrestler: power and balance are DOMINANT; technique in takedowns and control positions is primary; speed of reaction and movement matters; consistency across 6-minute matches is the challenge. Typical weak areas: mobility and consistency.",
  badminton: "For a badminton player: speed (footwork and reaction) is PRIMARY; technique in stroke production is key; balance in lunge and recovery is critical; power drives smash velocity; consistency is a challenge. Typical weak areas: balance in lunge positions and consistency.",
  golf: "For a golfer: technique is DOMINANT (swing mechanics); consistency is the PRIMARY performance driver; power drives distance; balance throughout the swing is critical; speed is less relevant. Typical weak areas: consistency and technique.",
  lacrosse: "For a lacrosse player: speed and technique (stick skills, throwing mechanics) are PRIMARY; power matters for shooting; balance in cutting and dodging is important; consistency varies. Typical weak areas: technique in throwing mechanics and consistency.",
};

const getResearch = (sport: string) =>
  SPORT_RESEARCH[sport.toLowerCase()] ?? {
    injury: "Hewett et al. (2005) on joint loading and ACL risk; Heiderscheit et al. (2011) on lower limb mechanics; Meeuwisse WH et al. on sport injury risk models",
    performance: "Kibler et al. (2006, Sports Med) on core stability in athletic function; Moore (2016, Sports Med) on movement economy; Glassbrook et al. (2017, J Strength Cond Res) on functional movement mechanics",
  };

const getScoreProfile = (sport: string) =>
  SPORT_SCORE_PROFILE[sport.toLowerCase()] ??
  "Score each metric based on what is typical for this sport — make sure the scores reflect the unique demands of the sport, not generic fitness. Key metrics should score differently than secondary ones.";

const SYSTEM_PROMPT = `You are a friendly sports coach helping everyday athletes improve. Write all text fields in plain, easy-to-understand language — like you're talking to a motivated athlete who is NOT a scientist or medical professional. Avoid jargon. When you need a technical term, explain it in simple words in the same sentence. Keep sentences short and direct. You MUST respond with ONLY a raw JSON object — no markdown, no code fences, no explanation, no text before or after. Your entire response must be parseable by JSON.parse().

The JSON shape is exactly:
{
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

export interface AthleteProfile {
  name?: string;
  level?: string;
  goals?: string[];
  injuryConcerns?: string[];
}

export interface JointAngles {
  leftKnee?: number;
  rightKnee?: number;
  leftHip?: number;
  rightHip?: number;
  leftElbow?: number;
  rightElbow?: number;
}

export interface JointRisks {
  leftKnee?: number; // 0 = safe, 1 = caution, 2 = high risk
  rightKnee?: number;
  leftHip?: number;
  rightHip?: number;
  leftElbow?: number;
  rightElbow?: number;
}

const RISK_LABEL = ["safe", "caution", "HIGH RISK"];

function formatJointAngles(angles: JointAngles, risks: JointRisks): string {
  const joints: { label: string; deg?: number; lvl?: number }[] = [
    { label: "Left knee",  deg: angles.leftKnee,  lvl: risks.leftKnee  },
    { label: "Right knee", deg: angles.rightKnee, lvl: risks.rightKnee },
    { label: "Left hip",   deg: angles.leftHip,   lvl: risks.leftHip   },
    { label: "Right hip",  deg: angles.rightHip,  lvl: risks.rightHip  },
    { label: "Left elbow", deg: angles.leftElbow, lvl: risks.leftElbow },
    { label: "Right elbow",deg: angles.rightElbow,lvl: risks.rightElbow},
  ].filter((j) => j.deg != null);

  if (joints.length === 0) return "";

  return `\nMeasured joint angles from the highest-risk frame (MediaPipe biomechanics scan):
${joints.map((j) => `  ${j.label}: ${Math.round(j.deg!)}° [${RISK_LABEL[j.lvl ?? 0]}]`).join("\n")}

Use these ACTUAL measurements to drive your scoring — they are real numbers from the video, not estimates:
- Joints flagged as HIGH RISK: the related score (technique, balance, or mobility) must be in the "Focus Here" band (below 65)
- Joints flagged as caution: the related score should be in the "On Track" band (65–79)
- Joints flagged as safe: those scores can be Strong (80+) if the sport profile supports it
- If ANY joint is HIGH RISK, the overall injury risks section must name that joint specifically`;
}

export async function analyzeAthletePerformance(
  sport: string,
  title: string,
  videoUrl?: string | null,
  athleteProfile?: AthleteProfile | null,
  jointAngles?: JointAngles | null,
  jointRisks?: JointRisks | null
): Promise<AIAnalysisResult> {
  const research = getResearch(sport);
  const scoreProfile = getScoreProfile(sport);

  const athleteCtx = athleteProfile
    ? [
        athleteProfile.level ? `Athlete level: ${athleteProfile.level}` : null,
        athleteProfile.goals?.length ? `Goals: ${athleteProfile.goals.join(", ")}` : null,
        athleteProfile.injuryConcerns?.filter(i => i !== "No current injuries").length
          ? `Injury concerns: ${athleteProfile.injuryConcerns!.filter(i => i !== "No current injuries").join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : null;

  const angleSection = jointAngles ? formatJointAngles(jointAngles, jointRisks ?? {}) : "";

  const userPrompt = `Analyze this ${sport} training session titled "${title}"${videoUrl ? ` (video: ${videoUrl})` : ""}.
${athleteCtx ? `\nAthlete context:\n${athleteCtx}\n` : ""}${angleSection}
Use these research sources to ground your analysis:
Injury prevention: ${research.injury}
Performance/efficiency: ${research.performance}

Sport-specific scoring profile — use this to produce DIFFERENTIATED scores that reflect the real demands of ${sport}:
${scoreProfile}

Requirements:
- Write like a coach talking to this specific athlete — use their level and goals to frame feedback
- All tips and risks must be SPECIFIC to ${sport} — no generic advice
- 2 injury tips (tipType "injury", severity "warning" or "critical") — prioritize any stated injury concerns
- 3 performance tips (tipType "performance", severity "info") — each must name the direct performance benefit in everyday terms
- 2-3 injury risks naming the specific joint and what could go wrong in plain terms
- Drills must include sets/reps/duration and be written as clear step-by-step instructions
- Score using these bands: 80–100 = Strong · 65–79 = On Track · below 65 = Focus Here
- Scores MUST reflect the sport profile above — a fencer and a runner should get very different scores across metrics
- Scores must vary meaningfully across the six metrics — do NOT cluster everything in the 70s
- Do NOT include an overallScore field — it will be computed separately
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

  // Compute overall from sub-scores so it always reflects the real breakdown.
  // Claude's self-reported overall clusters at ~72 regardless of sport.
  // Weights: technique 25%, balance 20%, power 15%, consistency 15%, mobility 15%, speed 10%
  parsed.overallScore = Math.round(
    parsed.techniqueScore    * 0.25 +
    parsed.balanceScore      * 0.20 +
    parsed.powerScore        * 0.15 +
    parsed.consistencyScore  * 0.15 +
    parsed.mobilityScore     * 0.15 +
    parsed.speedScore        * 0.10
  );

  return parsed;
}
