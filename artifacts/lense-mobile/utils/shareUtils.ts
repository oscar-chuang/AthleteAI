export interface GoalShareParams {
  sessionCount: number;
  sport?: string | null;
  streakDays?: number;
}

/**
 * Builds the share message shown when a user hits their weekly training goal.
 *
 * Rules:
 *  - Session count is always included and correctly pluralised.
 *  - Sport name is appended in parentheses when provided.
 *  - A streak suffix is appended only when streakDays > 1.
 */
export function buildGoalShareMessage({
  sessionCount,
  sport,
  streakDays = 0,
}: GoalShareParams): string {
  const sportSuffix  = sport ? ` (${sport})` : "";
  const streakSuffix = streakDays > 1 ? ` ${streakDays}-day streak and counting!` : "";
  const sessions     = `${sessionCount} session${sessionCount !== 1 ? "s" : ""}`;
  return `I hit my weekly training goal on AthleteAI! 🏆 ${sessions} this week${sportSuffix}.${streakSuffix}`;
}
