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

// ─── Session share payload ────────────────────────────────────────────────────

/** The deep-link scheme used to link back to a specific analysis session. */
export const SESSION_DEEP_LINK_SCHEME = "athleteai://analysis";

/**
 * Returns the deep link URL for a given analysis session.
 * e.g. "athleteai://analysis/abc-123"
 */
export function buildSessionDeepLink(analysisId: string): string {
  return `${SESSION_DEEP_LINK_SCHEME}/${analysisId}`;
}

/**
 * Returns the share message that accompanies a session share card.
 * Always includes the deep link so the recipient can open the session directly.
 */
export function buildSessionShareMessage(analysisId: string, sport: string): string {
  const deepLink = buildSessionDeepLink(analysisId);
  return `Check out my ${sport} session on AthleteAI!\n${deepLink}`;
}

export interface SessionSharePayload {
  /** Used by iOS Share.share() — the image file URI. */
  url: string;
  /** Text body included on all platforms; always contains the deep link. */
  message: string;
}

/**
 * Assembles the full share payload for a session.
 *
 * iOS: pass both `url` (image) and `message` (text + deep link) to Share.share().
 * Android fallback: pass only `message` to Share.share() when expo-sharing is unavailable.
 */
export function buildSessionSharePayload(
  analysisId: string,
  sport: string,
  imageUri: string,
): SessionSharePayload {
  return {
    url: imageUri,
    message: buildSessionShareMessage(analysisId, sport),
  };
}
