import type { MatchState, TeamSide, MatchEvent, CourtPosition } from '@/types/match';
import { getSetEvents, getSubCount, getTimeoutCount, getCurrentRotation } from './derived';
import { findPlayerPosition, isBackRow } from '@/utils/rotation';

/**
 * Check if a substitution is legal.
 * Returns null if legal, or an error string if not.
 */
export function validateSubstitution(
  state: MatchState,
  team: TeamSide,
  playerIn: number,
  playerOut: number
): string | null {
  const setIndex = state.currentSetIndex;

  // Check max subs
  const subCount = getSubCount(state.events, setIndex, team);
  if (subCount >= state.config.maxSubsPerSet) {
    return `Maximum ${state.config.maxSubsPerSet} substitutions reached for this set`;
  }

  // Check re-entry rule: a player can only re-enter for the same player who replaced them
  const setEvents = getSetEvents(state.events, setIndex).filter(
    (e) => e.type === 'substitution' && e.team === team
  ) as Array<MatchEvent & { type: 'substitution' }>;

  // Check if playerIn was previously subbed out
  const prevSubOut = setEvents.find((e) => e.playerOut === playerIn);
  if (prevSubOut) {
    // playerIn was previously subbed out - they can only re-enter for the player who replaced them
    if (prevSubOut.playerIn !== playerOut) {
      return `Player #${playerIn} can only re-enter for player #${prevSubOut.playerIn} (USAV re-entry rule)`;
    }
  }

  // Check if playerIn has already re-entered once (max one re-entry per set)
  const reEntries = setEvents.filter((e) => e.playerIn === playerIn);
  if (reEntries.length >= 1 && prevSubOut) {
    return `Player #${playerIn} has already re-entered once this set`;
  }

  // Check that playerOut is actually on the court
  const rotation = getCurrentRotation(state, setIndex);
  if (rotation) {
    const lineup = team === 'home' ? rotation.homeLineup : rotation.awayLineup;
    const pos = findPlayerPosition(lineup, playerOut);
    if (pos === null) {
      return `Player #${playerOut} is not on the court`;
    }
  }

  // Check that playerIn is not already on the court
  if (rotation) {
    const lineup = team === 'home' ? rotation.homeLineup : rotation.awayLineup;
    const pos = findPlayerPosition(lineup, playerIn);
    if (pos !== null) {
      return `Player #${playerIn} is already on the court`;
    }
  }

  // Check that playerIn is not a libero (liberos use replacement, not substitution)
  const teamData = team === 'home' ? state.homeTeam : state.awayTeam;
  const isLibero = teamData.roster.find((p) => p.number === playerIn)?.isLibero;
  if (isLibero) {
    return `Player #${playerIn} is a libero and cannot enter via substitution`;
  }

  return null;
}

/**
 * Check if a timeout can be called.
 */
export function validateTimeout(
  state: MatchState,
  team: TeamSide
): string | null {
  const count = getTimeoutCount(state.events, state.currentSetIndex, team);
  if (count >= state.config.maxTimeoutsPerSet) {
    return `Maximum ${state.config.maxTimeoutsPerSet} timeouts reached for this set`;
  }
  return null;
}

/**
 * Check if a libero replacement is legal.
 */
export function validateLiberoReplacement(
  state: MatchState,
  team: TeamSide,
  liberoNumber: number,
  replacedPlayer: number,
  position: CourtPosition,
  isLiberoEntering: boolean
): string | null {
  // Libero can only replace back-row players
  if (!isBackRow(position)) {
    return 'Libero can only replace back-row players (positions I, V, VI)';
  }

  // Check that the player at the position is correct
  const rotation = getCurrentRotation(state, state.currentSetIndex);
  if (!rotation) return 'No rotation data available';

  const lineup = team === 'home' ? rotation.homeLineup : rotation.awayLineup;

  if (isLiberoEntering) {
    // The player at the position should be the one being replaced
    if (lineup[position] !== replacedPlayer) {
      return `Player #${replacedPlayer} is not at position ${position}`;
    }
  } else {
    // Libero should be at the position
    if (lineup[position] !== liberoNumber) {
      return `Libero #${liberoNumber} is not at position ${position}`;
    }
  }

  return null;
}

/**
 * Get players eligible to sub in for a given team.
 */
export function getEligibleSubsIn(
  state: MatchState,
  team: TeamSide
): number[] {
  const teamData = team === 'home' ? state.homeTeam : state.awayTeam;
  const rotation = getCurrentRotation(state, state.currentSetIndex);
  if (!rotation) return [];

  const lineup = team === 'home' ? rotation.homeLineup : rotation.awayLineup;
  const onCourt = new Set(Object.values(lineup));

  return teamData.roster
    .filter((p) => !p.isLibero && !onCourt.has(p.number))
    .filter((p) => validateSubstitution(state, team, p.number, 0) === null || true)
    .map((p) => p.number);
}

/**
 * Get players on court eligible to be subbed out.
 */
export function getEligibleSubsOut(
  state: MatchState,
  team: TeamSide
): number[] {
  const rotation = getCurrentRotation(state, state.currentSetIndex);
  if (!rotation) return [];

  const lineup = team === 'home' ? rotation.homeLineup : rotation.awayLineup;
  const teamData = team === 'home' ? state.homeTeam : state.awayTeam;
  const liberoNumbers = teamData.roster.filter((p) => p.isLibero).map((p) => p.number);

  // Can sub out anyone on court except liberos currently on court
  return Object.values(lineup).filter((num) => !liberoNumbers.includes(num));
}
