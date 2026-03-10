import type { MatchConfig, Score, TeamSide } from '@/types/match';

/**
 * Check if a set is complete given the current score and set index.
 */
export function isSetComplete(
  score: Score,
  setIndex: number,
  config: MatchConfig
): boolean {
  const isDecidingSet = setIndex === config.bestOf - 1;
  const target = isDecidingSet ? config.decidingSetPoints : config.pointsToWin;
  return getSetWinner(score, setIndex, config) !== null;
}

/**
 * Get the winner of a set, or null if the set is not yet complete.
 */
export function getSetWinner(
  score: Score,
  setIndex: number,
  config: MatchConfig
): TeamSide | null {
  const isDecidingSet = setIndex === config.bestOf - 1;
  const target = isDecidingSet ? config.decidingSetPoints : config.pointsToWin;

  // Must reach target and win by 2
  if (score.home >= target && score.home - score.away >= 2) return 'home';
  if (score.away >= target && score.away - score.home >= 2) return 'away';
  return null;
}

/**
 * Get the points target for a given set.
 */
export function getPointsTarget(setIndex: number, config: MatchConfig): number {
  const isDecidingSet = setIndex === config.bestOf - 1;
  return isDecidingSet ? config.decidingSetPoints : config.pointsToWin;
}

/**
 * Check if the match is complete (one team has won enough sets).
 */
export function isMatchComplete(
  setsWon: { home: number; away: number },
  config: MatchConfig
): boolean {
  const setsToWin = Math.ceil(config.bestOf / 2);
  return setsWon.home >= setsToWin || setsWon.away >= setsToWin;
}

/**
 * Get match winner or null.
 */
export function getMatchWinner(
  setsWon: { home: number; away: number },
  config: MatchConfig
): TeamSide | null {
  const setsToWin = Math.ceil(config.bestOf / 2);
  if (setsWon.home >= setsToWin) return 'home';
  if (setsWon.away >= setsToWin) return 'away';
  return null;
}

/**
 * In 5th set (deciding set for best-of-5), teams switch sides at 8 points.
 * In 3rd set (deciding set for best-of-3), teams switch at 8 points.
 */
export function shouldSwitchSides(
  score: Score,
  setIndex: number,
  config: MatchConfig
): boolean {
  const isDecidingSet = setIndex === config.bestOf - 1;
  if (!isDecidingSet) return false;
  const switchPoint = Math.ceil(config.decidingSetPoints / 2);
  return score.home + score.away === switchPoint;
}

export const DEFAULT_CONFIG: MatchConfig = {
  bestOf: 5,
  pointsToWin: 25,
  decidingSetPoints: 15,
  maxSubsPerSet: 6,
  maxTimeoutsPerSet: 2,
};
