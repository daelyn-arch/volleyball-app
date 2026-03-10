import type { CourtPosition, Lineup } from '@/types/match';

/**
 * Rotate a lineup one position clockwise through the court positions.
 * USAV rotation: I→VI→V→IV→III→II→I
 * Each player moves to the next lower position number, wrapping 1→6.
 */
export function rotateLineup(lineup: Lineup): Lineup {
  return {
    1: lineup[2],
    2: lineup[3],
    3: lineup[4],
    4: lineup[5],
    5: lineup[6],
    6: lineup[1],
  } as Lineup;
}

/** Get the server (player in position I) */
export function getServer(lineup: Lineup): number {
  return lineup[1];
}

/** Check if a position is in the back row (I, VI, V) */
export function isBackRow(position: CourtPosition): boolean {
  return position === 1 || position === 5 || position === 6;
}

/** Check if a position is in the front row (II, III, IV) */
export function isFrontRow(position: CourtPosition): boolean {
  return position === 2 || position === 3 || position === 4;
}

/** Find which position a player occupies in a lineup */
export function findPlayerPosition(lineup: Lineup, playerNumber: number): CourtPosition | null {
  for (let pos = 1; pos <= 6; pos++) {
    if (lineup[pos as CourtPosition] === playerNumber) {
      return pos as CourtPosition;
    }
  }
  return null;
}

/**
 * Apply a substitution to a lineup: replace playerOut with playerIn
 */
export function applySubstitution(lineup: Lineup, playerOut: number, playerIn: number): Lineup {
  const newLineup = { ...lineup };
  for (let pos = 1; pos <= 6; pos++) {
    if (newLineup[pos as CourtPosition] === playerOut) {
      newLineup[pos as CourtPosition] = playerIn;
      break;
    }
  }
  return newLineup;
}

/**
 * Apply all substitutions and rotations from events to get current lineup.
 * This is a pure function - given starting lineup + events, returns current lineup.
 */
export function getCurrentLineupAfterEvents(
  startingLineup: Lineup,
  rotations: number,
  substitutions: Array<{ playerIn: number; playerOut: number }>
): Lineup {
  let lineup = { ...startingLineup };

  // Apply rotations
  for (let i = 0; i < rotations; i++) {
    lineup = rotateLineup(lineup);
  }

  // Apply substitutions
  for (const sub of substitutions) {
    lineup = applySubstitution(lineup, sub.playerOut, sub.playerIn);
  }

  return lineup;
}
