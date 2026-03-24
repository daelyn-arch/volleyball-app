import type { MatchEvent, TeamSide, Player, SanctionEvent } from '@/types/match';

/** Get set events filtered by set index */
function getSetEvents(events: MatchEvent[], setIndex: number): MatchEvent[] {
  return events.filter((e) => e.setIndex === setIndex);
}

/**
 * Find penalty points: sanction (penalty/delay-penalty/expulsion/DQ) immediately followed by a point.
 * Returns the point number (team-relative, 1-based) for the scoring team.
 */
export function getPenaltyPoints(
  events: MatchEvent[],
  setIndex: number,
  team: TeamSide
): Set<number> {
  const setEvents = getSetEvents(events, setIndex);
  const result = new Set<number>();

  for (let i = 0; i < setEvents.length - 1; i++) {
    const e = setEvents[i];
    const next = setEvents[i + 1];
    if (
      e.type === 'sanction' &&
      next.type === 'point' &&
      (e.sanctionType === 'penalty' ||
        e.sanctionType === 'delay-penalty' ||
        e.sanctionType === 'expulsion' ||
        e.sanctionType === 'disqualification')
    ) {
      // Count this team's points up to and including the penalty point
      let count = 0;
      for (let j = 0; j <= i + 1; j++) {
        const ev = setEvents[j];
        if (ev.type === 'point' && ev.scoringTeam === team) count++;
      }
      if (next.scoringTeam === team) result.add(count);
    }
  }
  return result;
}

/** Get all sanction events, optionally filtered by set index */
export function getSanctions(
  events: MatchEvent[],
  setIndex?: number
): SanctionEvent[] {
  return events.filter(
    (e): e is SanctionEvent =>
      e.type === 'sanction' &&
      (setIndex === undefined || e.setIndex === setIndex)
  );
}

/** Get libero player numbers from a roster */
export function getLiberoNumbers(roster: Player[]): Set<number> {
  const nums = new Set<number>();
  for (const p of roster) {
    if (p.isLibero) nums.add(p.number);
  }
  return nums;
}

/** Check if a server number is a libero */
export function isLiberoServing(
  serverNum: number,
  liberoNums: Set<number>
): boolean {
  return liberoNums.has(serverNum);
}

/** Format a sanction type for display */
export function formatSanctionType(
  sanctionType: SanctionEvent['sanctionType']
): string {
  switch (sanctionType) {
    case 'warning':
      return 'Warning';
    case 'penalty':
      return 'Penalty';
    case 'expulsion':
      return 'Expulsion';
    case 'disqualification':
      return 'Disqualification';
    case 'delay-warning':
      return 'Delay Warning';
    case 'delay-penalty':
      return 'Delay Penalty';
  }
}

/** Get the color for a sanction type */
export function sanctionColor(
  sanctionType: SanctionEvent['sanctionType']
): string {
  switch (sanctionType) {
    case 'warning':
    case 'delay-warning':
      return '#eab308'; // yellow
    case 'penalty':
    case 'delay-penalty':
      return '#dc2626'; // red
    case 'expulsion':
      return '#ea580c'; // orange
    case 'disqualification':
      return '#111827'; // near-black
  }
}

/** Format sanction recipient */
export function formatRecipient(
  recipient?: string,
  playerNumber?: number
): string {
  if (!recipient) return playerNumber ? `#${playerNumber}` : '';
  switch (recipient) {
    case 'player':
      return playerNumber ? `#${playerNumber}` : 'Player';
    case 'coach':
      return 'Coach';
    case 'asstCoach':
      return 'Asst Coach';
    case 'trainer':
      return 'Trainer';
    case 'manager':
      return 'Manager';
    default:
      return recipient;
  }
}
