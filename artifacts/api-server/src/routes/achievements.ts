import { Router, type IRouter, type Request, type Response } from "express";
import { db, analysesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "./auth";

const router: IRouter = Router();

function mk(
  id: string, title: string, description: string,
  icon: string, category: string, progress: number, total: number,
  sport: string | null = null,
) {
  return { id, title, description, icon, category, progress: Math.min(progress, total), total, unlocked: progress >= total, sport };
}

router.get("/achievements", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;

  const rows = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.userId, userId), eq(analysesTable.status, "complete")))
    .orderBy(desc(analysesTable.uploadedAt));

  const total = rows.length;

  // Streak — consecutive calendar days ending today (or yesterday)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daySet = new Set(
    rows.map((r) => {
      const d = new Date(r.uploadedAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    if (daySet.has(today.getTime() - i * 86_400_000)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  // Personal bests per metric
  const pb = {
    overall:     rows.length ? Math.max(...rows.map((r) => r.overallScore     ?? 0)) : 0,
    technique:   rows.length ? Math.max(...rows.map((r) => r.techniqueScore   ?? 0)) : 0,
    power:       rows.length ? Math.max(...rows.map((r) => r.powerScore       ?? 0)) : 0,
    speed:       rows.length ? Math.max(...rows.map((r) => r.speedScore       ?? 0)) : 0,
    balance:     rows.length ? Math.max(...rows.map((r) => r.balanceScore     ?? 0)) : 0,
    mobility:    rows.length ? Math.max(...rows.map((r) => r.mobilityScore    ?? 0)) : 0,
    consistency: rows.length ? Math.max(...rows.map((r) => r.consistencyScore ?? 0)) : 0,
  };

  // Per-sport session counts
  const sportCounts = new Map<string, number>();
  for (const r of rows) {
    const sp = r.sport.toLowerCase();
    sportCounts.set(sp, (sportCounts.get(sp) ?? 0) + 1);
  }

  // Distinct sports
  const sports = new Set(rows.map((r) => r.sport.toLowerCase()));

  // Net improvement: latest session vs earliest
  const improvement =
    rows.length >= 2
      ? (rows[0]!.overallScore ?? 0) - (rows[rows.length - 1]!.overallScore ?? 0)
      : 0;

  // Sessions with all injury risk items < 50 %
  const safeSessions = rows.filter((r) => {
    if (!r.injuryRisks || !Array.isArray(r.injuryRisks)) return true;
    const risks = r.injuryRisks as Array<{ riskPercent?: number; risk?: number }>;
    return risks.every((x) => (x.riskPercent ?? x.risk ?? 0) < 50);
  }).length;

  const achievements = [
    // ── Volume (global) ─────────────────────────────────────────────────────────
    mk("vol-1",   "First Steps",        "Complete your first AI analysis",   "play-circle",   "Volume", total,  1),
    mk("vol-5",   "Getting Serious",    "Complete 5 analyses",               "trending-up",   "Volume", total,  5),
    mk("vol-10",  "Consistent Athlete", "Complete 10 analyses",              "award",         "Volume", total, 10),
    mk("vol-25",  "Dedicated",          "Complete 25 analyses",              "star",          "Volume", total, 25),
    mk("vol-50",  "Elite Volume",       "Complete 50 analyses",              "zap",           "Volume", total, 50),
    mk("vol-100", "Centurion",          "Complete 100 analyses",             "shield",        "Volume", total,100),

    // ── Per-sport volume (sport-specific) ───────────────────────────────────────
    ...Array.from(sportCounts.entries()).flatMap(([sport, count]) => {
      const label = sport.charAt(0).toUpperCase() + sport.slice(1);
      return [
        mk(`sport-vol-${sport}-1`,  `${label} Debut`,    `Complete your first ${label} analysis`,  "play-circle",  "Sport Volume", count,  1, sport),
        mk(`sport-vol-${sport}-5`,  `${label} Regular`,  `Complete 5 ${label} analyses`,           "trending-up",  "Sport Volume", count,  5, sport),
        mk(`sport-vol-${sport}-10`, `${label} Veteran`,  `Complete 10 ${label} analyses`,          "award",        "Sport Volume", count, 10, sport),
      ];
    }),

    // ── Performance (global) ────────────────────────────────────────────────────
    mk("score-70",   "Solid Form",       "Score 70+ overall in any session",   "check-circle",     "Performance", Math.round(pb.overall),     70),
    mk("score-80",   "Strong Performer", "Score 80+ overall in any session",   "target",           "Performance", Math.round(pb.overall),     80),
    mk("score-90",   "Near Perfect",     "Score 90+ overall in any session",   "crosshair",        "Performance", Math.round(pb.overall),     90),
    mk("tech-80",    "Technique Expert", "Score 80+ on Technique",             "sliders",          "Performance", Math.round(pb.technique),   80),
    mk("power-85",   "Power House",      "Score 85+ on Power",                 "battery-charging", "Performance", Math.round(pb.power),       85),
    mk("speed-85",   "Lightning Fast",   "Score 85+ on Speed",                 "wind",             "Performance", Math.round(pb.speed),       85),
    mk("balance-85", "Rock Solid",       "Score 85+ on Balance",               "activity",         "Performance", Math.round(pb.balance),     85),
    mk("mob-85",     "Flexible Beast",   "Score 85+ on Mobility",              "maximize-2",       "Performance", Math.round(pb.mobility),    85),
    mk("con-85",     "Mr. Consistent",   "Score 85+ on Consistency",           "refresh-cw",       "Performance", Math.round(pb.consistency), 85),

    // ── Consistency (global) ────────────────────────────────────────────────────
    mk("streak-3",  "On a Roll",      "Analyze on 3 consecutive days",   "zap",      "Consistency", streak,  3),
    mk("streak-7",  "Week Warrior",   "Analyze on 7 consecutive days",   "calendar", "Consistency", streak,  7),
    mk("streak-14", "Fortnight Pro",  "Analyze on 14 consecutive days",  "sun",      "Consistency", streak, 14),
    mk("streak-30", "Unstoppable",    "Analyze on 30 consecutive days",  "award",    "Consistency", streak, 30),

    // ── Explorer (global) ───────────────────────────────────────────────────────
    mk("sport-2", "Multi-Sport",         "Analyze 2 different sports",   "shuffle", "Explorer", sports.size, 2),
    mk("sport-4", "Versatile Athlete",   "Analyze 4 different sports",   "globe",   "Explorer", sports.size, 4),
    mk("sport-6", "Renaissance Athlete", "Analyze 6 different sports",   "star",    "Explorer", sports.size, 6),

    // ── Growth (global) ─────────────────────────────────────────────────────────
    mk("improve-10", "Rising Star",  "Improve your overall score by 10+ points", "arrow-up-circle", "Growth",
       Math.round(Math.max(0, improvement)), 10),
    mk("improve-20", "Breakthrough", "Improve your overall score by 20+ points", "trending-up",     "Growth",
       Math.round(Math.max(0, improvement)), 20),

    // ── Safety (global) ─────────────────────────────────────────────────────────
    mk("safe-5",  "Safe Mover",      "Complete 5 low-risk sessions",    "shield", "Safety", safeSessions,  5),
    mk("safe-15", "Injury-Free Pro", "Complete 15 low-risk sessions",   "heart",  "Safety", safeSessions, 15),
  ];

  res.json({ achievements });
});

export default router;
