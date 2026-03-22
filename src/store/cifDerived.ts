import type {
  MatchState,
  TeamSide,
  CourtPosition,
  Lineup,
  Score,
  SubstitutionRecord,
  TimeoutRecord,
} from '@/types/match';
import { getSetEvents, getSubstitutions, getTimeouts } from './derived';
import { rotateLineup, getServer, applySubstitution } from '@/utils/rotation';

export interface CifPointEntry {
  scoringTeam: TeamSide;
  pointNumber: number;
  wasServedPoint: boolean;
  wasLiberoServing: boolean;
  serverNumber: number;
  servingTeam: TeamSide;
  scoreAfter: Score;
}

export interface CifServiceTerm {
  rotationSlot: CourtPosition;
  serverNumber: number;
  isLibero: boolean;
  sideoutPoint: number | null; // point scored via sideout that gained serve (not circled)
  servedPoints: number[];
  exitScore: number | null;
  wasFootFault: boolean; // term ended due to foot fault → boxed R
  inlineEvents: Array<{ type: 'sub' | 'timeout' | 'reServe'; forServingTeam: boolean; detail: string }>;
}

export interface CifSetData {
  points: CifPointEntry[];
  homePositionRows: Record<CourtPosition, CifServiceTerm[]>;
  awayPositionRows: Record<CourtPosition, CifServiceTerm[]>;
  homeStartingLineup: Lineup | null;
  awayStartingLineup: Lineup | null;
  firstServe: TeamSide | null;
  homeSubstitutions: SubstitutionRecord[];
  awaySubstitutions: SubstitutionRecord[];
  homeTimeouts: TimeoutRecord[];
  awayTimeouts: TimeoutRecord[];
  homePenaltyPoints: Set<number>; // point numbers awarded via penalty → boxed P{n}
  awayPenaltyPoints: Set<number>;
}

function emptyRows(): Record<CourtPosition, CifServiceTerm[]> {
  return { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

export function getCifSetData(state: MatchState, setIndex: number): CifSetData {
  const setData = state.sets[setIndex];
  const setEvents = getSetEvents(state.events, setIndex);

  const result: CifSetData = {
    points: [],
    homePositionRows: emptyRows(),
    awayPositionRows: emptyRows(),
    homeStartingLineup: setData?.homeLineup ?? null,
    awayStartingLineup: setData?.awayLineup ?? null,
    firstServe: setData?.firstServe ?? null,
    homeSubstitutions: getSubstitutions(state.events, setIndex, 'home'),
    awaySubstitutions: getSubstitutions(state.events, setIndex, 'away'),
    homeTimeouts: getTimeouts(state.events, setIndex, 'home'),
    awayTimeouts: getTimeouts(state.events, setIndex, 'away'),
    homePenaltyPoints: new Set<number>(),
    awayPenaltyPoints: new Set<number>(),
  };

  if (!setData?.homeLineup || !setData?.awayLineup || !setData.firstServe) {
    return result;
  }

  const homeLiberoNums = new Set(
    state.homeTeam.roster.filter(p => p.isLibero).map(p => p.number)
  );
  const awayLiberoNums = new Set(
    state.awayTeam.roster.filter(p => p.isLibero).map(p => p.number)
  );

  let homeLineup: Lineup = { ...setData.homeLineup };
  let awayLineup: Lineup = { ...setData.awayLineup };
  let servingTeam: TeamSide = setData.firstServe;
  let homeRotationCount = 0;
  let awayRotationCount = 0;
  let homePointCount = 0;
  let awayPointCount = 0;

  // Track current service term via mutable wrapper (avoids TS closure narrowing issues)
  const tracker: { term: CifServiceTerm | null; team: TeamSide | null } = { term: null, team: null };

  function makeNewTerm(team: TeamSide): CifServiceTerm {
    const lineup = team === 'home' ? homeLineup : awayLineup;
    const liberoNums = team === 'home' ? homeLiberoNums : awayLiberoNums;
    const rotCount = team === 'home' ? homeRotationCount : awayRotationCount;
    const slot = ((rotCount % 6) + 1) as CourtPosition;
    const server = getServer(lineup);
    return {
      rotationSlot: slot,
      serverNumber: server,
      isLibero: liberoNums.has(server),
      sideoutPoint: null,
      servedPoints: [],
      exitScore: null,
      wasFootFault: false,
      inlineEvents: [],
    };
  }

  function pushTerm(term: CifServiceTerm, team: TeamSide) {
    const rows = team === 'home' ? result.homePositionRows : result.awayPositionRows;
    rows[term.rotationSlot].push(term);
  }

  // Pre-scan: find penalty points (sanction followed by point)
  for (let i = 0; i < setEvents.length - 1; i++) {
    const e = setEvents[i];
    const next = setEvents[i + 1];
    if (e.type === 'sanction' && next.type === 'point' &&
        (e.sanctionType === 'penalty' || e.sanctionType === 'delay-penalty' ||
         e.sanctionType === 'expulsion' || e.sanctionType === 'disqualification')) {
      // Compute the point number for the scoring team
      let hc = 0, ac = 0;
      for (let j = 0; j <= i + 1; j++) {
        const ev = setEvents[j];
        if (ev.type === 'point') {
          if (ev.scoringTeam === 'home') hc++;
          else ac++;
        }
      }
      if (next.scoringTeam === 'home') result.homePenaltyPoints.add(hc);
      else result.awayPenaltyPoints.add(ac);
    }
  }

  // Start initial service term if there are any events
  if (setEvents.length > 0) {
    tracker.term = makeNewTerm(servingTeam);
    tracker.team = servingTeam;
  }

  for (const event of setEvents) {
    if (event.type === 'point') {
      // Sideout: close current term, rotate gaining team, start new term
      if (event.scoringTeam !== event.servingTeam) {
        // Exit score = opponent's score after sideout point
        if (tracker.term && tracker.team) {
          tracker.term.exitScore = event.scoringTeam === 'home' ? event.homeScore : event.awayScore;
          if (event.footFault) tracker.term.wasFootFault = true;
          pushTerm(tracker.term, tracker.team);
        }

        if (event.scoringTeam === 'home') {
          homeLineup = rotateLineup(homeLineup);
          homeRotationCount++;
        } else {
          awayLineup = rotateLineup(awayLineup);
          awayRotationCount++;
        }
        servingTeam = event.scoringTeam;
        tracker.term = makeNewTerm(servingTeam);
        tracker.team = servingTeam;

        // The sideout point is this team's next point number
        const sideoutPt = (event.scoringTeam === 'home' ? homePointCount : awayPointCount) + 1;
        tracker.term.sideoutPoint = sideoutPt;
      }

      // Record point
      if (event.scoringTeam === 'home') homePointCount++;
      else awayPointCount++;

      const pointNumber = event.scoringTeam === 'home' ? homePointCount : awayPointCount;
      const servingLiberos = event.servingTeam === 'home' ? homeLiberoNums : awayLiberoNums;

      result.points.push({
        scoringTeam: event.scoringTeam,
        pointNumber,
        wasServedPoint: event.scoringTeam === event.servingTeam,
        wasLiberoServing: servingLiberos.has(event.serverNumber),
        serverNumber: event.serverNumber,
        servingTeam: event.servingTeam,
        scoreAfter: { home: event.homeScore, away: event.awayScore },
      });

      // If served point, add to current term's servedPoints
      if (event.scoringTeam === event.servingTeam && tracker.term) {
        tracker.term.servedPoints.push(pointNumber);
      }

    } else if (event.type === 'substitution') {
      if (event.team === 'home') {
        homeLineup = applySubstitution(homeLineup, event.playerOut, event.playerIn);
      } else {
        awayLineup = applySubstitution(awayLineup, event.playerOut, event.playerIn);
      }
      if (tracker.term && tracker.team) {
        tracker.term.inlineEvents.push({
          type: 'sub',
          forServingTeam: event.team === tracker.team,
          detail: `#${event.playerIn}/#${event.playerOut}`,
        });
      }

    } else if (event.type === 'timeout') {
      if (tracker.term && tracker.team) {
        tracker.term.inlineEvents.push({
          type: 'timeout',
          forServingTeam: event.team === tracker.team,
          detail: `${event.homeScore}-${event.awayScore}`,
        });
      }

    } else if (event.type === 'reServe') {
      if (tracker.term && tracker.team) {
        tracker.term.inlineEvents.push({
          type: 'reServe',
          forServingTeam: true,
          detail: 'RS',
        });
      }

    } else if (event.type === 'liberoReplacement') {
      const lineup = event.team === 'home' ? homeLineup : awayLineup;
      if (event.isLiberoEntering) {
        lineup[event.position] = event.liberoNumber;
      } else {
        lineup[event.position] = event.replacedPlayer;
      }
      if (event.team === 'home') homeLineup = { ...lineup };
      else awayLineup = { ...lineup };

      // If libero enters/exits at serving position during active term, update isLibero
      if (event.position === 1 && tracker.term && tracker.team === event.team) {
        const libNums = event.team === 'home' ? homeLiberoNums : awayLiberoNums;
        tracker.term.isLibero = libNums.has(getServer(event.team === 'home' ? homeLineup : awayLineup));
      }

    } else if (event.type === 'correction') {
      homeLineup = { ...event.homeLineup };
      awayLineup = { ...event.awayLineup };
      servingTeam = event.servingTeam;
    }
  }

  // Push ongoing term (still serving, no exit score)
  if (tracker.term && tracker.team) {
    pushTerm(tracker.term, tracker.team);
  }

  return result;
}
