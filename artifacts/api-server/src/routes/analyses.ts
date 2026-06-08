import { Router, type IRouter, type Request, type Response } from "express";
import { db, analysesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "./auth";

const router: IRouter = Router();

const SPORT_TIPS: Record<string, { strengths: string[]; improvements: string[]; tips: Array<{ category: string; severity: string; title: string; description: string; drill?: string }>; risks: Array<{ joint: string; riskPercent: number; description: string; prevention: string }> }> = {
  default: {
    strengths: ["Good overall body control", "Consistent movement patterns", "Strong core engagement"],
    improvements: ["Work on hip mobility for deeper range of motion", "Focus on symmetry between left and right sides", "Improve deceleration control"],
    tips: [
      { category: "Form", severity: "info", title: "Keep your core braced", description: "A tight core protects your spine and transfers power more efficiently through your body. Focus on engaging your abs before each rep.", drill: "Dead bug: lie on your back, brace core, slowly lower opposite arm and leg without letting your lower back arch." },
      { category: "Injury Prevention", severity: "warning", title: "Warm up your joints fully", description: "Cold joints are injury-prone joints. Spend 5–10 min on dynamic warm-up targeting the ankles, knees, hips, and shoulders before any training session.", drill: "Leg swings (forward/lateral), arm circles, hip circles — 10 reps each direction." },
      { category: "Recovery", severity: "info", title: "Prioritize post-session mobility", description: "Stretching while muscles are warm improves flexibility faster. Hold each stretch 30–60 seconds, breathing deeply.", drill: "Hip flexor stretch, hamstring stretch, thoracic spine rotation — hold 45s each side." },
    ],
    risks: [
      { joint: "Knee", riskPercent: 18, description: "Mild valgus (inward collapse) detected at peak load. This places extra stress on the ACL and medial meniscus.", prevention: "Strengthen glutes (clamshells, lateral band walks) and cue knee-over-toe alignment during movement." },
      { joint: "Lower Back", riskPercent: 12, description: "Slight forward lean under fatigue. Can lead to lumbar strain over time.", prevention: "Practice hip hinge pattern, keep chest up. Limit training volume when form degrades." },
    ],
  },
  weightlifting: {
    strengths: ["Strong initial drive off the floor", "Good bar path control", "Solid upper back engagement"],
    improvements: ["Drop hips lower in starting position", "Speed through the mid-pull needs work", "Improve wrist flexibility for overhead catch"],
    tips: [
      { category: "Form", severity: "warning", title: "Set your back before every pull", description: "A neutral spine at the start prevents rounding under heavy loads. Think 'chest up, lats tight' before you initiate the pull.", drill: "Good mornings with a barbell — 3×10 to groove the hip hinge with a locked spine." },
      { category: "Injury Prevention", severity: "warning", title: "Watch your knees at the catch", description: "Knees track outward during the squat catch — any inward collapse under a heavy load risks ACL and meniscus damage.", drill: "Pause front squat at the bottom with a band around the knees to train outward drive. 4×5 at 50% max." },
      { category: "Mobility", severity: "info", title: "Open your thoracic spine for overhead stability", description: "Limited upper-back mobility forces compensation at the shoulder, increasing impingement risk.", drill: "Foam roll upper back 2 min, then 10 x thoracic extensions over the roller." },
    ],
    risks: [
      { joint: "Knee", riskPercent: 22, description: "Valgus stress detected at catch position. Common in lifters with limited ankle dorsiflexion.", prevention: "Heel-elevated goblet squats to improve depth, clamshells and lateral band walks for glute activation." },
      { joint: "Lower Back", riskPercent: 28, description: "Bar drifts forward mid-pull, causing lumbar hyperextension. High cumulative risk over many sessions.", prevention: "Deficit deadlifts to reinforce lat engagement throughout the pull. Keep the bar close to the body." },
      { joint: "Shoulder", riskPercent: 15, description: "Asymmetric overhead catch — left side loads earlier. Rotator cuff stress over time.", prevention: "Single-arm dumbbell press, face pulls, and band pull-aparts to balance shoulder stability." },
    ],
  },
  running: {
    strengths: ["Efficient arm swing", "Good forward lean angle", "Consistent cadence throughout clip"],
    improvements: ["Increase cadence to reduce ground contact time", "Reduce vertical oscillation (too much bounce)", "Strengthen hip stabilizers to reduce lateral sway"],
    tips: [
      { category: "Form", severity: "info", title: "Run tall with a slight forward lean", description: "Lean from the ankles, not the waist. This positions you to land with your foot under your hips, reducing braking force.", drill: "Wall lean drill: lean into a wall at 45°, then march in place keeping that angle for 30 sec." },
      { category: "Injury Prevention", severity: "warning", title: "Increase cadence gradually", description: "A cadence below 165 spm increases impact forces. Aim for 170–180. A 5% increase per week is safe.", drill: "Run to a 170 bpm metronome for 10 min twice per week, then extend duration." },
      { category: "Strength", severity: "info", title: "Single-leg strength is key for runners", description: "Each stride is a single-leg task. Weak glutes and hip abductors = IT band syndrome, runner's knee.", drill: "Single-leg Romanian deadlifts 3×10, lateral band walks 3×20 steps each direction." },
    ],
    risks: [
      { joint: "Knee", riskPercent: 30, description: "Heel striking detected with overstriding. This dramatically increases knee joint loading.", prevention: "Shorten stride, increase cadence, and strengthen hip flexors with A-skip drills." },
      { joint: "Ankle", riskPercent: 14, description: "Limited ankle dorsiflexion — foot not fully dorsiflexed at midstance.", prevention: "Calf stretching (straight and bent knee), ankle mobility circles, and eccentric calf raises." },
    ],
  },
  basketball: {
    strengths: ["Quick first step", "Good vertical jump mechanics", "Solid landing position"],
    improvements: ["Improve hip depth in defensive stance", "Work on deceleration control after sprints", "Strengthen ankle for cut stability"],
    tips: [
      { category: "Form", severity: "info", title: "Land soft — knees bent, hips back", description: "Every jump landing should absorb force like a spring. Stiff landings = patellar tendon stress.", drill: "Drop landing drill: step off a 12\" box, land soft and hold 3 seconds. Progress to single-leg." },
      { category: "Injury Prevention", severity: "warning", title: "Protect your ankles on cuts", description: "Lateral cuts at speed are the #1 cause of ankle sprains. Strengthen and stabilize before increasing agility volume.", drill: "Single-leg balance on unstable surface 3×30 sec. Add eyes-closed progression." },
      { category: "Explosiveness", severity: "info", title: "Hip power drives your vertical", description: "Jumping and sprinting both originate from hip extension. Weak glutes limit your ceiling.", drill: "Barbell hip thrusts 3×8, box jumps 3×6, pause squats 3×5." },
    ],
    risks: [
      { joint: "Ankle", riskPercent: 35, description: "Frequent lateral cuts detected with limited ankle inversion control.", prevention: "Ankle strengthening program: resistance band eversion/inversion, single-leg balance progressions." },
      { joint: "Knee", riskPercent: 25, description: "Valgus collapse on jump landings — high ACL risk profile.", prevention: "ACL prevention program: Nordic hamstring curls, lateral band walks, landing mechanics drills." },
    ],
  },
};

function getSportData(sport: string) {
  const key = sport.toLowerCase();
  return SPORT_TIPS[key] ?? SPORT_TIPS.default;
}

function randInt(min: number, max: number) {
  return Math.round(Math.random() * (max - min) + min);
}

function generateScores() {
  const overall = randInt(62, 92);
  return {
    overallScore: overall,
    techniqueScore: randInt(Math.max(50, overall - 15), Math.min(100, overall + 15)),
    powerScore: randInt(Math.max(50, overall - 18), Math.min(100, overall + 10)),
    balanceScore: randInt(Math.max(50, overall - 12), Math.min(100, overall + 12)),
    consistencyScore: randInt(Math.max(50, overall - 10), Math.min(100, overall + 10)),
    mobilityScore: randInt(Math.max(45, overall - 20), Math.min(100, overall + 8)),
    speedScore: randInt(Math.max(50, overall - 15), Math.min(100, overall + 15)),
  };
}

function formatAnalysis(a: typeof analysesTable.$inferSelect) {
  return {
    id: String(a.id),
    userId: String(a.userId),
    title: a.title,
    sport: a.sport,
    status: a.status,
    videoUrl: a.videoUrl ?? undefined,
    thumbnailUrl: a.thumbnailUrl ?? undefined,
    duration: a.duration ?? undefined,
    overallScore: a.overallScore ?? undefined,
    techniqueScore: a.techniqueScore ?? undefined,
    powerScore: a.powerScore ?? undefined,
    balanceScore: a.balanceScore ?? undefined,
    consistencyScore: a.consistencyScore ?? undefined,
    mobilityScore: a.mobilityScore ?? undefined,
    speedScore: a.speedScore ?? undefined,
    strengths: a.strengths ?? [],
    improvements: a.improvements ?? [],
    uploadedAt: a.uploadedAt.toISOString(),
  };
}

router.get("/analyses", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const rows = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.userId, userId))
    .orderBy(desc(analysesTable.uploadedAt));
  res.json({ analyses: rows.map(formatAnalysis) });
});

router.post("/analyses", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const { title, sport, videoUrl, duration } = req.body as {
    title?: string; sport?: string; videoUrl?: string; duration?: number;
  };

  if (!title || !sport) {
    res.status(400).json({ error: "title and sport are required" });
    return;
  }

  const sportData = getSportData(sport);
  const scores = generateScores();

  const [row] = await db.insert(analysesTable).values({
    userId,
    title,
    sport: sport.toLowerCase(),
    status: "complete",
    videoUrl: videoUrl ?? null,
    duration: duration ?? null,
    ...scores,
    strengths: sportData.strengths,
    improvements: sportData.improvements,
  }).returning();

  res.status(201).json({ analysis: formatAnalysis(row!) });
});

router.get("/analyses/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }

  const [row] = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)));

  if (!row) { res.status(404).json({ error: "Analysis not found" }); return; }

  const sportData = getSportData(row.sport);

  const tips = sportData.tips.map((t, i) => ({ id: String(i + 1), ...t }));
  const injuryRisks = sportData.risks.map((r, i) => ({ id: String(i + 1), ...r }));

  res.json({ analysis: formatAnalysis(row), tips, injuryRisks });
});

router.delete("/analyses/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }

  await db
    .delete(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, userId)));

  res.json({ success: true });
});

export default router;
