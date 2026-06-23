export interface SubScores {
  techniqueScore: number;
  balanceScore: number;
  powerScore: number;
  consistencyScore: number;
  mobilityScore: number;
  speedScore: number;
}

export interface ScoringWeights {
  technique: number;
  balance: number;
  power: number;
  consistency: number;
  mobility: number;
  speed: number;
}

/**
 * Compute a weighted overall score from the six sub-scores.
 * Weights should sum to 1.0.
 */
export function computeOverallScore(scores: SubScores, weights: ScoringWeights): number {
  return Math.round(
    scores.techniqueScore   * weights.technique   +
    scores.balanceScore     * weights.balance     +
    scores.powerScore       * weights.power       +
    scores.consistencyScore * weights.consistency +
    scores.mobilityScore    * weights.mobility    +
    scores.speedScore       * weights.speed
  );
}

export const PERFORMANCE_WEIGHTS: ScoringWeights = {
  technique:   0.25,
  balance:     0.20,
  power:       0.15,
  consistency: 0.15,
  mobility:    0.15,
  speed:       0.10,
};
