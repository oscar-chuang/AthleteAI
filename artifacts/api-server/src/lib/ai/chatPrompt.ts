import { eq, desc, and } from "drizzle-orm";
import { db, analysesTable, profilesTable, completedDrillsTable } from "@workspace/db";

type TipDrill = {
  name: string;
  sets: string;
  reps: string;
  cue: string;
  drillFeelCue?: string;
};

type Tip = {
  id?: string;
  tipType?: string;
  title?: string;
  drill?: TipDrill;
};

export async function buildSystemPrompt(userId: number): Promise<string> {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  const [recentAnalyses, allCompletedDrills] = await Promise.all([
    db
      .select()
      .from(analysesTable)
      .where(and(eq(analysesTable.userId, userId), eq(analysesTable.status, "complete")))
      .orderBy(desc(analysesTable.uploadedAt))
      .limit(5),
    db
      .select()
      .from(completedDrillsTable)
      .where(eq(completedDrillsTable.userId, userId))
      .orderBy(desc(completedDrillsTable.completedAt)),
  ]);

  const recentAnalysisIds = new Set(recentAnalyses.map((a) => a.id));

  const completedByAnalysis = new Map<number, { tipId: string; drillName: string | null; completedAt: Date }[]>();
  const olderSessionDrillNames = new Set<string>();

  for (const row of allCompletedDrills) {
    const list = completedByAnalysis.get(row.analysisId) ?? [];
    list.push({ tipId: row.tipId, drillName: row.drillName, completedAt: row.completedAt });
    completedByAnalysis.set(row.analysisId, list);

    if (!recentAnalysisIds.has(row.analysisId) && row.drillName && olderSessionDrillNames.size < 10) {
      olderSessionDrillNames.add(row.drillName);
    }
  }

  const athleteName = profile?.name ? `${profile.name}` : "this athlete";
  const sport = profile?.sport || "general sport";
  const level = profile?.level || "intermediate";
  const goals = profile?.goals?.length ? profile.goals.join(", ") : null;
  const injuries = profile?.injuryConcerns?.filter(i => i !== "No current injuries");

  let systemPrompt = `You are an expert sports performance coach and biomechanics specialist with deep knowledge of ${sport}. You are coaching ${athleteName}, a ${level}-level ${sport} athlete.`;

  if (goals) {
    systemPrompt += `\n\nTheir stated goals: ${goals}.`;
  }

  if (injuries && injuries.length > 0) {
    systemPrompt += `\nActive injury concerns: ${injuries.join(", ")} — always factor these into advice.`;
  }

  if (recentAnalyses.length > 0) {
    systemPrompt += `\n\nRecent training data (most recent first):`;
    for (const a of recentAnalyses) {
      const scores = [
        a.overallScore != null ? `Overall ${Math.round(a.overallScore)}` : null,
        a.techniqueScore != null ? `Technique ${Math.round(a.techniqueScore)}` : null,
        a.balanceScore != null ? `Balance ${Math.round(a.balanceScore)}` : null,
        a.powerScore != null ? `Power ${Math.round(a.powerScore)}` : null,
        a.mobilityScore != null ? `Mobility ${Math.round(a.mobilityScore)}` : null,
        a.speedScore != null ? `Speed ${Math.round(a.speedScore)}` : null,
        a.consistencyScore != null ? `Consistency ${Math.round(a.consistencyScore)}` : null,
      ].filter(Boolean);

      systemPrompt += `\n- "${a.title}" (${a.sport}, ${new Date(a.uploadedAt).toLocaleDateString()})`;
      if (scores.length) systemPrompt += ` — ${scores.join(", ")}`;
      if (a.strengths?.length) systemPrompt += `\n  Strengths: ${a.strengths.slice(0, 2).join("; ")}`;
      if (a.improvements?.length) systemPrompt += `\n  Needs work: ${a.improvements.slice(0, 2).join("; ")}`;

      const tips = (a.tips ?? []) as Tip[];
      const doneTipIds = new Set((completedByAnalysis.get(a.id) ?? []).map((c) => c.tipId));
      if (tips.length > 0) {
        systemPrompt += `\n  Coaching tips & drills:`;
        for (const tip of tips) {
          if (!tip.title) continue;
          const done = tip.id != null && doneTipIds.has(tip.id);
          systemPrompt += `\n    • [${tip.tipType ?? "tip"}] ${tip.title}${done ? " ✓ COMPLETED" : ""}`;
          if (tip.drill?.name) {
            systemPrompt += `\n      Drill: ${tip.drill.name}${done ? " (done)" : ""}`;
            if (tip.drill.sets || tip.drill.reps) {
              systemPrompt += ` — ${[tip.drill.sets, tip.drill.reps].filter(Boolean).join(" × ")}`;
            }
            if (tip.drill.cue) {
              systemPrompt += `\n      Cue: ${tip.drill.cue}`;
            }
            if (tip.drill.drillFeelCue) {
              systemPrompt += `\n      Feel: ${tip.drill.drillFeelCue}`;
            }
          }
        }
      }

      const completedForThis = completedByAnalysis.get(a.id) ?? [];
      const completedWithName = completedForThis.filter((c) => c.drillName);
      if (completedWithName.length > 0) {
        systemPrompt += `\n  Previously completed drills: ${completedWithName.map((c) => c.drillName).join(", ")}`;
      }
    }
  } else {
    systemPrompt += `\n\nThis athlete has no completed analyses yet.`;
  }

  if (olderSessionDrillNames.size > 0) {
    systemPrompt += `\n\nDrills mastered in earlier sessions (do not re-prescribe unless the athlete asks): ${[...olderSessionDrillNames].join(", ")}.`;
  }

  systemPrompt += `\n\nCoaching style:
- Talk to them like a knowledgeable coach, not a textbook
- Reference their actual data when it's relevant ("your balance score is X, so...")
- Give specific, actionable advice — drills, cues, sets/reps when relevant
- Keep answers focused and practical; athletes want direction, not essays
- If they ask about something outside sport/fitness, politely redirect to training`;

  return systemPrompt;
}
