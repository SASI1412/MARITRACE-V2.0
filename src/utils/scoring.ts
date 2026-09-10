export const SCORING_WEIGHTS = {
  spatial: 0.25,
  temporal: 0.20,
  trajectory: 0.20,
  drift: 0.25,
  aisQuality: 0.10
};

export interface ScoreComponents {
  spatial: number;
  temporal: number;
  trajectory: number;
  drift: number;
  aisQuality: number;
}

/**
 * Calculates the overall compatibility score based on weighted evidence dimensions.
 */
export function calculateOverallScore(scores: ScoreComponents): number {
  const overall = 
    scores.spatial * SCORING_WEIGHTS.spatial +
    scores.temporal * SCORING_WEIGHTS.temporal +
    scores.trajectory * SCORING_WEIGHTS.trajectory +
    scores.drift * SCORING_WEIGHTS.drift +
    scores.aisQuality * SCORING_WEIGHTS.aisQuality;
    
  return Math.round(overall);
}

/**
 * Classifies the attribution confidence based on the overall compatibility score.
 */
export function calculateConfidence(overallScore: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (overallScore >= 80) {
    return 'HIGH';
  } else if (overallScore >= 50) {
    return 'MEDIUM';
  } else {
    return 'LOW';
  }
}
