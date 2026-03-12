import type {
  MatchEvent,
  MatchState,
  Score,
  ServiceRound,
  RunningScoreEntry,
  SubstitutionRecord,
  TimeoutRecord,
  SetSummary,
  TeamSide,
  Lineup,
  CourtPosition,
  RotationState,
  SetData,
} from '@/types/match';
import { rotateLineup, applySubstitution, getServer } from '@/utils/rotation';
import { getSetWinner } from '@/utils/scoring';

// ── Helpers ───────────────────────────────────────────────

/** Get all events for a specific set */
export function getSetEvents(events: MatchEvent[], setIndex: number): MatchEvent[] {
  return events.filter((e) => e.setIndex === setIndex);
}

/** Get current score for a set from events */
export function getSetScore(events: MatchEvent[], setIndex: number): Score {
  const scoreEvents = getSetEvents(events, setIndex).filter((e) => e.type === 'point' || e.type === 'correction');
  if (scoreEvents.length === 0) return { home: 0, away: 0 };
  const last = scoreEvents[scoreEvents.length - 1];
  return { home: last.homeScore, away: last.awayScore };
}

/** Count sets won by each team */
export function getSetsWon(
  state: MatchState
): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (let i = 0; i <= state.currentSetIndex; i++) {
    const score = getSetScore(state.events, i);
    const winner = getSetWinner(score, i, state.config);
    if (winner === 'home') home++;
    else if (winner === 'away') away++;
  }
  return { home, away };
}

// ── Current rotation (computed from starting lineup + events) ──

export function getCurrentRotation(state: MatchState, setIndex?: number): RotationState | null {
  const si = setIndex ?? state.currentSetIndex;
  const setData = state.sets[si];
  if (!setData?.homeLineup || !setData?.awayLineup || !setData.firstServe) return null;

  let homeLineup: Lineup = { ...setData.homeLineup };
  let awayLineup: Lineup = { ...setData.awayLineup };
  let servingTeam: TeamSide = setData.firstServe;

  const setEvents = getSetEvents(state.events, si);
  let lastScoringTeam: TeamSide | null = null;

  for (const event of setEvents) {
    if (event.type === 'point') {
      // If sideout (receiving team scored), rotate the team that gains serve
      if (lastScoringTeam !== null || event.scoringTeam !== servingTeam) {
        if (event.scoringTeam !== event.servingTeam) {
          // Sideout: rotate the team that was receiving (and just won the point)
          if (event.scoringTeam === 'home') {
            homeLineup = rotateLineup(homeLineup);
          } else {
            awayLineup = rotateLineup(awayLineup);
          }
          servingTeam = event.scoringTeam;
        }
      }
      lastScoringTeam = event.scoringTeam;
    } else if (event.type === 'substitution') {
      if (event.team === 'home') {
        homeLineup = applySubstitution(homeLineup, event.playerOut, event.playerIn);
      } else {
        awayLineup = applySubstitution(awayLineup, event.playerOut, event.playerIn);
      }
    } else if (event.type === 'liberoReplacement') {
      const lineup = event.team === 'home' ? homeLineup : awayLineup;
      if (event.isLiberoEntering) {
        // Libero enters: replace the player at the given position with libero
        lineup[event.position] = event.liberoNumber;
      } else {
        // Libero exits: replace libero with the original player
        lineup[event.position] = event.replacedPlayer;
      }
      if (event.team === 'home') homeLineup = { ...lineup };
      else awayLineup = { ...lineup };
    } else if (event.type === 'correction') {
      homeLineup = { ...event.homeLineup };
      awayLineup = { ...event.awayLineup };
      servingTeam = event.servingTeam;
    }
  }

  return {
    homeLineup,
    awayLineup,
    servingTeam,
    serverNumber: getServer(servingTeam === 'home' ? homeLineup : awayLineup),
  };
}

// ── Service Rounds ────────────────────────────────────────

export function getServiceRounds(
  events: MatchEvent[],
  setIndex: number,
  setData: SetData
): { home: ServiceRound[]; away: ServiceRound[] } {
  if (!setData.homeLineup || !setData.awayLineup || !setData.firstServe) {
    return { home: [], away: [] };
  }

  const homeRounds: ServiceRound[] = [];
  const awayRounds: ServiceRound[] = [];

  const pointEvents = getSetEvents(events, setIndex).filter(
    (e) => e.type === 'point'
  ) as Array<MatchEvent & { type: 'point' }>;

  if (pointEvents.length === 0) return { home: [], away: [] };

  let currentRound: ServiceRound | null = null;

  for (const pe of pointEvents) {
    if (!currentRound || pe.servingTeam !== currentRound.servingTeam || pe.serverNumber !== currentRound.serverNumber) {
      // Close previous round
      if (currentRound) {
        const rounds = currentRound.servingTeam === 'home' ? homeRounds : awayRounds;
        rounds.push(currentRound);
      }
      // Start new round
      currentRound = {
        servingTeam: pe.servingTeam,
        serverNumber: pe.serverNumber,
        startScore: {
          home: pe.homeScore - (pe.scoringTeam === 'home' ? 1 : 0),
          away: pe.awayScore - (pe.scoringTeam === 'away' ? 1 : 0),
        },
        endScore: null,
        pointsScored: 0,
      };
    }

    if (pe.scoringTeam === pe.servingTeam) {
      currentRound.pointsScored++;
    }
    currentRound.endScore = { home: pe.homeScore, away: pe.awayScore };
  }

  // Close last round
  if (currentRound) {
    const rounds = currentRound.servingTeam === 'home' ? homeRounds : awayRounds;
    rounds.push(currentRound);
  }

  return { home: homeRounds, away: awayRounds };
}

// ── Running Score ─────────────────────────────────────────

export function getRunningScoreData(
  events: MatchEvent[],
  setIndex: number
): { home: RunningScoreEntry[]; away: RunningScoreEntry[] } {
  const home: RunningScoreEntry[] = [];
  const away: RunningScoreEntry[] = [];

  const pointEvents = getSetEvents(events, setIndex).filter(
    (e) => e.type === 'point'
  ) as Array<MatchEvent & { type: 'point' }>;

  for (const pe of pointEvents) {
    const entry: RunningScoreEntry = {
      point: pe.scoringTeam === 'home' ? pe.homeScore : pe.awayScore,
      serverNumber: pe.serverNumber,
      team: pe.scoringTeam,
    };
    if (pe.scoringTeam === 'home') {
      home.push(entry);
    } else {
      away.push(entry);
    }
  }

  return { home, away };
}

// ── Substitutions & Timeouts for a set ────────────────────

export function getSubstitutions(
  events: MatchEvent[],
  setIndex: number,
  team: TeamSide
): SubstitutionRecord[] {
  return getSetEvents(events, setIndex)
    .filter((e) => e.type === 'substitution' && e.team === team)
    .map((e) => {
      const sub = e as SubstitutionRecord & { type: 'substitution'; team: TeamSide };
      return {
        playerIn: sub.playerIn,
        playerOut: sub.playerOut,
        homeScore: sub.homeScore,
        awayScore: sub.awayScore,
        subNumber: sub.subNumber,
      };
    });
}

export function getTimeouts(
  events: MatchEvent[],
  setIndex: number,
  team: TeamSide
): TimeoutRecord[] {
  return getSetEvents(events, setIndex)
    .filter((e) => e.type === 'timeout' && e.team === team)
    .map((e) => {
      const to = e as TimeoutRecord & { type: 'timeout'; team: TeamSide };
      return {
        homeScore: to.homeScore,
        awayScore: to.awayScore,
        timeoutNumber: to.timeoutNumber,
      };
    });
}

export function getSubCount(events: MatchEvent[], setIndex: number, team: TeamSide): number {
  return getSetEvents(events, setIndex).filter(
    (e) => e.type === 'substitution' && e.team === team
  ).length;
}

export function getTimeoutCount(events: MatchEvent[], setIndex: number, team: TeamSide): number {
  return getSetEvents(events, setIndex).filter(
    (e) => e.type === 'timeout' && e.team === team
  ).length;
}

// ── Full Set Summary ──────────────────────────────────────

export function getSetSummary(state: MatchState, setIndex: number): SetSummary {
  const score = getSetScore(state.events, setIndex);
  const winner = getSetWinner(score, setIndex, state.config);
  const setData = state.sets[setIndex];
  const { home: homeServiceRounds, away: awayServiceRounds } = setData
    ? getServiceRounds(state.events, setIndex, setData)
    : { home: [], away: [] };
  const { home: homeRunningScore, away: awayRunningScore } = getRunningScoreData(
    state.events,
    setIndex
  );

  return {
    setIndex,
    homeScore: score.home,
    awayScore: score.away,
    winner,
    homeServiceRounds,
    awayServiceRounds,
    homeRunningScore,
    awayRunningScore,
    homeSubstitutions: getSubstitutions(state.events, setIndex, 'home'),
    awaySubstitutions: getSubstitutions(state.events, setIndex, 'away'),
    homeTimeouts: getTimeouts(state.events, setIndex, 'home'),
    awayTimeouts: getTimeouts(state.events, setIndex, 'away'),
  };
}
