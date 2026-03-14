import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  MatchState,
  MatchConfig,
  MatchMetadata,
  Team,
  Lineup,
  TeamSide,
  CourtPosition,
  MatchEvent,
  SetData,
  SanctionRecipient,
} from '@/types/match';
import { DEFAULT_CONFIG } from '@/utils/scoring';
import { isSetComplete, getSetWinner, isMatchComplete } from '@/utils/scoring';
import { getSetScore, getSetsWon, getCurrentRotation } from './derived';
import { getServer, isFrontRow, findPlayerPosition, rotateLineup } from '@/utils/rotation';
import { validateSubstitution, validateTimeout, validateLiberoReplacement, hasDelayWarning } from './validators';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Find the original player that a libero replaced at a given position by tracing events backwards */
function findLiberoOriginalPlayer(
  events: MatchEvent[],
  setIndex: number,
  team: TeamSide,
  liberoNumber: number,
  _position: CourtPosition
): number | null {
  // Look backwards through events for the most recent liberoReplacement where this libero entered for this team
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.setIndex !== setIndex) continue;
    if (e.type === 'liberoReplacement' && e.team === team && e.liberoNumber === liberoNumber && e.isLiberoEntering) {
      return e.replacedPlayer;
    }
  }
  return null;
}

function createEmptySetData(): SetData {
  return {
    homeLineup: null,
    awayLineup: null,
    firstServe: null,
    homeBenchSide: 'left',
    startTime: null,
    endTime: null,
  };
}

interface SanctionInput {
  team: TeamSide;
  sanctionType: 'warning' | 'penalty' | 'expulsion' | 'disqualification' | 'delay-warning' | 'delay-penalty';
  playerNumber?: number;
  sanctionRecipient?: SanctionRecipient;
}

interface MatchActions {
  // Setup
  createMatch: (homeTeam: Team, awayTeam: Team, config?: Partial<MatchConfig>, metadata?: Partial<MatchMetadata>) => void;
  updateMetadata: (metadata: Partial<MatchMetadata>) => void;
  setLineup: (setIndex: number, team: TeamSide, lineup: Lineup) => void;
  setFirstServe: (setIndex: number, team: TeamSide) => void;
  setBenchSide: (setIndex: number, side: 'left' | 'right') => void;

  // Scoring
  awardPoint: (scoringTeam: TeamSide) => void;
  decrementPoint: (team: TeamSide) => void;

  // Substitutions
  recordSubstitution: (team: TeamSide, playerIn: number, playerOut: number) => string | null;

  // Timeouts
  recordTimeout: (team: TeamSide) => string | null;

  // Libero
  recordLiberoReplacement: (
    team: TeamSide,
    liberoNumber: number,
    replacedPlayer: number,
    position: CourtPosition,
    isLiberoEntering: boolean
  ) => string | null;

  // Sanctions
  recordSanction: (team: TeamSide, sanctionType: 'warning' | 'penalty' | 'expulsion' | 'disqualification' | 'delay-warning' | 'delay-penalty', playerNumber?: number, sanctionRecipient?: SanctionRecipient) => void;
  recordDoubleSanction: (sanction1: SanctionInput, sanction2: SanctionInput) => void;

  // Wrong Server
  getWrongServerPointCount: (team: TeamSide) => number;
  cancelWrongServerPoints: (team: TeamSide, count: number) => number;

  // Exceptional Substitution
  recordExceptionalSubstitution: (team: TeamSide, playerIn: number, playerOut: number) => void;

  // Two-libero swap (direct replacement without rally)
  swapLiberos: (team: TeamSide, enteringLibero: number, exitingLibero: number, position: CourtPosition) => string | null;

  // Libero redesignation after injury
  redesignateLibero: (team: TeamSide, oldLiberoNumber: number, newLiberoNumber: number) => void;

  // Corrections
  applyCorrection: (homeScore: number, awayScore: number, homeLineup: Lineup, awayLineup: Lineup, servingTeam: TeamSide) => void;

  // Remarks
  addRemark: (note: string) => void;

  // Undo
  undo: () => void;

  // Navigation
  advanceToNextSet: () => void;

  // Roster
  addPlayerToRoster: (team: TeamSide, playerNumber: number) => void;

  // Reset
  resetMatch: () => void;
}

export type MatchStore = MatchState & MatchActions;

const EMPTY_METADATA: MatchMetadata = {
  competition: '',
  cityState: '',
  hall: '',
  matchNumber: '',
  level: '',
  division: '',
  category: '',
  poolPhase: '',
  court: '',
  scorer: '',
  referee: '',
  downRef: '',
};

const initialState: MatchState = {
  id: '',
  createdAt: 0,
  homeTeam: { name: '', roster: [] },
  awayTeam: { name: '', roster: [] },
  config: DEFAULT_CONFIG,
  sets: [],
  events: [],
  currentSetIndex: 0,
  matchComplete: false,
  metadata: { ...EMPTY_METADATA },
  liberoServingPositions: {},
  remarks: [],
};

export const useMatchStore = create<MatchStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      createMatch: (homeTeam, awayTeam, config, metadata) => {
        const matchConfig = { ...DEFAULT_CONFIG, ...config };
        const sets: SetData[] = [];
        for (let i = 0; i < matchConfig.bestOf; i++) {
          sets.push(createEmptySetData());
        }
        set({
          id: generateId(),
          createdAt: Date.now(),
          homeTeam,
          awayTeam,
          config: matchConfig,
          sets,
          events: [],
          currentSetIndex: 0,
          matchComplete: false,
          metadata: { ...EMPTY_METADATA, ...metadata },
          liberoServingPositions: {},
          remarks: [],
        });
      },

      updateMetadata: (metadata) => {
        set((state) => ({
          metadata: { ...state.metadata, ...metadata },
        }));
      },

      setLineup: (setIndex, team, lineup) => {
        set((state) => {
          const sets = [...state.sets];
          sets[setIndex] = {
            ...sets[setIndex],
            [team === 'home' ? 'homeLineup' : 'awayLineup']: lineup,
          };
          return { sets };
        });
      },

      setFirstServe: (setIndex, team) => {
        set((state) => {
          const sets = [...state.sets];
          sets[setIndex] = { ...sets[setIndex], firstServe: team };
          return { sets };
        });
      },

      setBenchSide: (setIndex, side) => {
        set((state) => {
          const sets = [...state.sets];
          sets[setIndex] = { ...sets[setIndex], homeBenchSide: side };
          return { sets };
        });
      },

      awardPoint: (scoringTeam) => {
        const state = get();
        if (state.matchComplete) return;

        const setIndex = state.currentSetIndex;
        const rotation = getCurrentRotation(state, setIndex);
        if (!rotation) return;

        const currentScore = getSetScore(state.events, setIndex);

        // Don't allow points if set is already complete
        if (isSetComplete(currentScore, setIndex, state.config)) return;

        const newHomeScore = currentScore.home + (scoringTeam === 'home' ? 1 : 0);
        const newAwayScore = currentScore.away + (scoringTeam === 'away' ? 1 : 0);

        const event: MatchEvent = {
          type: 'point',
          id: generateId(),
          timestamp: Date.now(),
          setIndex,
          scoringTeam,
          servingTeam: rotation.servingTeam,
          serverNumber: rotation.serverNumber,
          homeScore: newHomeScore,
          awayScore: newAwayScore,
        };

        let newEvents = [...state.events, event];

        // Check if set is now complete
        const newScore = { home: newHomeScore, away: newAwayScore };
        const setWinner = getSetWinner(newScore, setIndex, state.config);

        // Auto libero-out: if a sideout rotation would put a libero in the front row,
        // automatically swap the libero out for the original player
        if (!setWinner && scoringTeam !== rotation.servingTeam) {
          // Sideout occurred — the scoring team rotates
          const preRotationLineup = scoringTeam === 'home' ? { ...rotation.homeLineup } : { ...rotation.awayLineup };
          const postRotationLineup = rotateLineup(preRotationLineup);
          const teamData = scoringTeam === 'home' ? state.homeTeam : state.awayTeam;
          const liberoNums = new Set(teamData.roster.filter(p => p.isLibero).map(p => p.number));

          if (liberoNums.size > 0) {
            // Check each front row position after rotation for a libero
            for (let pos = 1; pos <= 6; pos++) {
              const p = pos as CourtPosition;
              if (isFrontRow(p) && liberoNums.has(postRotationLineup[p])) {
                const liberoNumber = postRotationLineup[p];
                // Find which player the libero originally replaced by looking back through events
                const replacedPlayer = findLiberoOriginalPlayer(newEvents, setIndex, scoringTeam, liberoNumber, p);
                if (replacedPlayer !== null) {
                  const liberoEvent: MatchEvent = {
                    type: 'liberoReplacement',
                    id: generateId(),
                    timestamp: Date.now(),
                    setIndex,
                    team: scoringTeam,
                    liberoNumber,
                    replacedPlayer,
                    position: p,
                    isLiberoEntering: false,
                    autoSwap: true,
                  };
                  newEvents = [...newEvents, liberoEvent];
                }
              }
            }
          }
        }

        let newMatchComplete: boolean = state.matchComplete;
        if (setWinner) {
          const setsWon = getSetsWon({ ...state, events: newEvents });
          newMatchComplete = isMatchComplete(setsWon, state.config);
        }

        // Track set start/end times
        const sets = [...state.sets];
        const setData = sets[setIndex];
        let setsUpdated = false;

        // First point of the set torecord start time
        if (currentScore.home === 0 && currentScore.away === 0) {
          sets[setIndex] = { ...setData, startTime: Date.now() };
          setsUpdated = true;
        }

        // Set just completed torecord end time
        if (setWinner) {
          sets[setIndex] = { ...(setsUpdated ? sets[setIndex] : setData), endTime: Date.now() };
          setsUpdated = true;
        }

        set({
          events: newEvents,
          matchComplete: newMatchComplete,
          ...(setsUpdated ? { sets } : {}),
        });
      },

      decrementPoint: (team) => {
        const state = get();
        const setIndex = state.currentSetIndex;

        // Find the last point event for this team in the current set
        let removeIdx = -1;
        for (let i = state.events.length - 1; i >= 0; i--) {
          const e = state.events[i];
          if (e.setIndex === setIndex && e.type === 'point' && e.scoringTeam === team) {
            removeIdx = i;
            break;
          }
        }
        if (removeIdx === -1) return; // nothing to remove

        const removedEvent = state.events[removeIdx];
        const removedScore = team === 'home'
          ? (removedEvent as any).homeScore
          : (removedEvent as any).awayScore;

        // Build new events: remove the point, adjust subsequent scores
        const newEvents: MatchEvent[] = [];
        for (let i = 0; i < state.events.length; i++) {
          if (i === removeIdx) continue;

          const e = state.events[i];
          if (i > removeIdx && e.setIndex === setIndex) {
            // Decrement the corrected team's score in all subsequent events
            if (e.type === 'point' || e.type === 'substitution' || e.type === 'timeout' || e.type === 'sanction') {
              const adjusted = { ...e };
              if (team === 'home') adjusted.homeScore--;
              else adjusted.awayScore--;
              newEvents.push(adjusted);
              continue;
            }
          }
          newEvents.push(e);
        }

        // Recalculate match state
        const newScore = getSetScore(newEvents, setIndex);
        const setWinner = getSetWinner(newScore, setIndex, state.config);

        // Add remark per USAV format: What happened, Team, Set # and Score
        const teamName = team === 'home' ? state.homeTeam.name : state.awayTeam.name;
        const remarks = [...(state.remarks || [])];
        remarks.push(`PTS REMOVED, ${teamName}, Set ${setIndex + 1}, ${newScore.home}-${newScore.away}`);
        let newMatchComplete = false;
        if (setWinner) {
          const setsWon = getSetsWon({ ...state, events: newEvents });
          newMatchComplete = isMatchComplete(setsWon, state.config);
        }

        set({ events: newEvents, matchComplete: newMatchComplete, remarks });
      },

      recordSubstitution: (team, playerIn, playerOut) => {
        const state = get();
        const error = validateSubstitution(state, team, playerIn, playerOut);
        if (error) return error;

        const setIndex = state.currentSetIndex;
        const currentScore = getSetScore(state.events, setIndex);
        const subCount = state.events.filter(
          (e) => e.setIndex === setIndex && e.type === 'substitution' && e.team === team
        ).length;

        const event: MatchEvent = {
          type: 'substitution',
          id: generateId(),
          timestamp: Date.now(),
          setIndex,
          team,
          playerIn,
          playerOut,
          homeScore: currentScore.home,
          awayScore: currentScore.away,
          subNumber: subCount + 1,
        };

        set({ events: [...state.events, event] });
        return null;
      },

      recordTimeout: (team) => {
        const state = get();
        const error = validateTimeout(state, team);
        if (error) return error;

        const setIndex = state.currentSetIndex;
        const currentScore = getSetScore(state.events, setIndex);
        const toCount = state.events.filter(
          (e) => e.setIndex === setIndex && e.type === 'timeout' && e.team === team
        ).length;

        const event: MatchEvent = {
          type: 'timeout',
          id: generateId(),
          timestamp: Date.now(),
          setIndex,
          team,
          homeScore: currentScore.home,
          awayScore: currentScore.away,
          timeoutNumber: (toCount + 1) as 1 | 2,
        };

        set({ events: [...state.events, event] });
        return null;
      },

      recordLiberoReplacement: (team, liberoNumber, replacedPlayer, position, isLiberoEntering) => {
        const state = get();
        const error = validateLiberoReplacement(state, team, liberoNumber, replacedPlayer, position, isLiberoEntering);
        if (error) return error;

        const event: MatchEvent = {
          type: 'liberoReplacement',
          id: generateId(),
          timestamp: Date.now(),
          setIndex: state.currentSetIndex,
          team,
          liberoNumber,
          replacedPlayer,
          position,
          isLiberoEntering,
        };

        // Lock in libero serving position when entering at position I
        let updatedServingPositions = state.liberoServingPositions;
        if (isLiberoEntering && position === 1) {
          const key = `${state.currentSetIndex}-${team}`;
          if (!state.liberoServingPositions[key]) {
            updatedServingPositions = {
              ...state.liberoServingPositions,
              [key]: { liberoNumber, replacedPlayer },
            };
          }
        }

        set({ events: [...state.events, event], liberoServingPositions: updatedServingPositions });
        return null;
      },

      recordSanction: (team, sanctionType, playerNumber, sanctionRecipient) => {
        const state = get();
        const setIndex = state.currentSetIndex;
        const currentScore = getSetScore(state.events, setIndex);

        // USAV: delay warning is per-match — auto-upgrade to delay-penalty if team already warned
        if (sanctionType === 'delay-warning' && hasDelayWarning(state.events, team)) {
          sanctionType = 'delay-penalty';
        }

        // Sanctions that award a point to the opposing team
        const awardsPoint = sanctionType === 'penalty' || sanctionType === 'delay-penalty' || sanctionType === 'expulsion' || sanctionType === 'disqualification';
        const opposingTeam = team === 'home' ? 'away' : 'home';

        const scoreAfter = awardsPoint
          ? { home: currentScore.home + (opposingTeam === 'home' ? 1 : 0), away: currentScore.away + (opposingTeam === 'away' ? 1 : 0) }
          : currentScore;

        const newEvents: MatchEvent[] = [];

        const sanctionEvent: MatchEvent = {
          type: 'sanction',
          id: generateId(),
          timestamp: Date.now(),
          setIndex,
          team,
          sanctionType,
          sanctionRecipient,
          playerNumber,
          homeScore: currentScore.home,
          awayScore: currentScore.away,
        };
        newEvents.push(sanctionEvent);

        // If it awards a point, also record the point event
        if (awardsPoint) {
          const rotation = getCurrentRotation(state, setIndex);
          const serverNumber = rotation ? getServer(rotation.servingTeam === 'home' ? rotation.homeLineup : rotation.awayLineup) : 0;

          const pointEvent: MatchEvent = {
            type: 'point',
            id: generateId(),
            timestamp: Date.now(),
            setIndex,
            scoringTeam: opposingTeam,
            servingTeam: rotation?.servingTeam ?? 'home',
            serverNumber,
            homeScore: scoreAfter.home,
            awayScore: scoreAfter.away,
          };
          newEvents.push(pointEvent);
        }

        set({ events: [...state.events, ...newEvents] });
      },

      recordDoubleSanction: (sanction1, sanction2) => {
        const state = get();
        const setIndex = state.currentSetIndex;
        const currentScore = getSetScore(state.events, setIndex);
        const rotation = getCurrentRotation(state, setIndex);

        // Snapshot pre-sanction state
        const preServingTeam = rotation?.servingTeam ?? 'home';
        const preServerNumber = rotation ? getServer(preServingTeam === 'home' ? rotation.homeLineup : rotation.awayLineup) : 0;
        const preHomeLineup = rotation ? { ...rotation.homeLineup } : null;
        const preAwayLineup = rotation ? { ...rotation.awayLineup } : null;

        const awardsPoint = (type: string) =>
          type === 'penalty' || type === 'delay-penalty' || type === 'expulsion' || type === 'disqualification';
        const s1Awards = awardsPoint(sanction1.sanctionType);
        const s2Awards = awardsPoint(sanction2.sanctionType);

        const opposing1: TeamSide = sanction1.team === 'home' ? 'away' : 'home';
        const opposing2: TeamSide = sanction2.team === 'home' ? 'away' : 'home';

        let runningHome = currentScore.home;
        let runningAway = currentScore.away;
        const newEvents: MatchEvent[] = [];

        // Sanction 1
        newEvents.push({
          type: 'sanction',
          id: generateId(),
          timestamp: Date.now(),
          setIndex,
          team: sanction1.team,
          sanctionType: sanction1.sanctionType,
          sanctionRecipient: sanction1.sanctionRecipient,
          playerNumber: sanction1.playerNumber,
          homeScore: runningHome,
          awayScore: runningAway,
        });

        if (s1Awards) {
          if (opposing1 === 'home') runningHome++;
          else runningAway++;
          newEvents.push({
            type: 'point',
            id: generateId(),
            timestamp: Date.now(),
            setIndex,
            scoringTeam: opposing1,
            servingTeam: preServingTeam,
            serverNumber: preServerNumber,
            homeScore: runningHome,
            awayScore: runningAway,
          });
        }

        // Sanction 2
        newEvents.push({
          type: 'sanction',
          id: generateId(),
          timestamp: Date.now(),
          setIndex,
          team: sanction2.team,
          sanctionType: sanction2.sanctionType,
          sanctionRecipient: sanction2.sanctionRecipient,
          playerNumber: sanction2.playerNumber,
          homeScore: runningHome,
          awayScore: runningAway,
        });

        if (s2Awards) {
          if (opposing2 === 'home') runningHome++;
          else runningAway++;
          newEvents.push({
            type: 'point',
            id: generateId(),
            timestamp: Date.now(),
            setIndex,
            scoringTeam: opposing2,
            servingTeam: preServingTeam,
            serverNumber: preServerNumber,
            homeScore: runningHome,
            awayScore: runningAway,
          });
        }

        // If both awarded points, restore pre-sanction rotation (no service change rule)
        if (s1Awards && s2Awards && preHomeLineup && preAwayLineup) {
          newEvents.push({
            type: 'correction',
            id: generateId(),
            timestamp: Date.now(),
            setIndex,
            homeScore: runningHome,
            awayScore: runningAway,
            homeLineup: preHomeLineup,
            awayLineup: preAwayLineup,
            servingTeam: preServingTeam,
          });
        }

        const allEvents = [...state.events, ...newEvents];
        const remarks = [...(state.remarks || [])];
        remarks.push(`DOUBLE SANCTION Set ${setIndex + 1}: no service change (${runningHome}-${runningAway})`);

        const newScore = getSetScore(allEvents, setIndex);
        const setWinner = getSetWinner(newScore, setIndex, state.config);
        let newMatchComplete = state.matchComplete;
        if (setWinner) {
          const setsWon = getSetsWon({ ...state, events: allEvents });
          newMatchComplete = isMatchComplete(setsWon, state.config);
        }

        set({ events: allEvents, matchComplete: newMatchComplete, remarks });
      },

      getWrongServerPointCount: (team) => {
        const state = get();
        const setIndex = state.currentSetIndex;
        let count = 0;
        for (let i = state.events.length - 1; i >= 0; i--) {
          const e = state.events[i];
          if (e.setIndex !== setIndex) break;
          if (e.type !== 'point') continue;
          if (e.scoringTeam === team && e.servingTeam === team) {
            count++;
          } else {
            break;
          }
        }
        return count;
      },

      cancelWrongServerPoints: (team, count) => {
        const state = get();
        const setIndex = state.currentSetIndex;

        // Walk backward to find consecutive points in current service run
        const allMatching: number[] = [];
        for (let i = state.events.length - 1; i >= 0; i--) {
          const e = state.events[i];
          if (e.setIndex !== setIndex) break;
          if (e.type !== 'point') continue;
          if (e.scoringTeam === team && e.servingTeam === team) {
            allMatching.push(i);
          } else {
            break;
          }
        }

        if (allMatching.length === 0 || count <= 0) return 0;

        // Only remove the most recent 'count' points (allMatching is newest-first)
        const indicesToRemove = allMatching.slice(0, Math.min(count, allMatching.length));
        const removeSet = new Set(indicesToRemove);
        const actualCount = indicesToRemove.length;
        const firstRemoveIdx = Math.min(...indicesToRemove);

        // Build new events: remove points and adjust subsequent scores
        const newEvents: MatchEvent[] = [];
        for (let i = 0; i < state.events.length; i++) {
          if (removeSet.has(i)) continue;
          const e = state.events[i];
          if (i > firstRemoveIdx && e.setIndex === setIndex) {
            if (e.type === 'point' || e.type === 'substitution' || e.type === 'timeout' || e.type === 'sanction') {
              const adjusted = { ...e };
              if (team === 'home') adjusted.homeScore -= actualCount;
              else adjusted.awayScore -= actualCount;
              newEvents.push(adjusted);
              continue;
            }
          }
          newEvents.push(e);
        }

        // Add correction to switch server to opponent
        const opposingTeam: TeamSide = team === 'home' ? 'away' : 'home';
        const rotation = getCurrentRotation({ ...state, events: newEvents }, setIndex);
        if (rotation) {
          const newScore = getSetScore(newEvents, setIndex);
          newEvents.push({
            type: 'correction',
            id: generateId(),
            timestamp: Date.now(),
            setIndex,
            homeScore: newScore.home,
            awayScore: newScore.away,
            homeLineup: rotation.homeLineup,
            awayLineup: rotation.awayLineup,
            servingTeam: opposingTeam,
          });
        }

        const finalScore = getSetScore(newEvents, setIndex);
        const teamName = team === 'home' ? state.homeTeam.name : state.awayTeam.name;
        const remarks = [...(state.remarks || [])];
        remarks.push(`WRONG SERVER: ${actualCount} pts removed from ${teamName}, Set ${setIndex + 1}, ${finalScore.home}-${finalScore.away}`);

        const setWinner = getSetWinner(finalScore, setIndex, state.config);
        let newMatchComplete = false;
        if (setWinner) {
          const setsWon = getSetsWon({ ...state, events: newEvents });
          newMatchComplete = isMatchComplete(setsWon, state.config);
        }

        set({ events: newEvents, matchComplete: newMatchComplete, remarks });
        return actualCount;
      },

      recordExceptionalSubstitution: (team, playerIn, playerOut) => {
        const state = get();
        const setIndex = state.currentSetIndex;
        const currentScore = getSetScore(state.events, setIndex);
        const subCount = state.events.filter(
          (e) => e.setIndex === setIndex && e.type === 'substitution' && e.team === team
        ).length;

        const event: MatchEvent = {
          type: 'substitution',
          id: generateId(),
          timestamp: Date.now(),
          setIndex,
          team,
          playerIn,
          playerOut,
          homeScore: currentScore.home,
          awayScore: currentScore.away,
          subNumber: subCount + 1,
        };

        const teamName = team === 'home' ? state.homeTeam.name : state.awayTeam.name;
        const remarks = [...(state.remarks || [])];
        remarks.push(`EXCEPTIONAL SUB: #${playerIn} for #${playerOut} (injury), ${teamName}, Set ${setIndex + 1}, ${currentScore.home}-${currentScore.away}`);

        set({ events: [...state.events, event], remarks });
      },

      swapLiberos: (team, enteringLibero, exitingLibero, position) => {
        const state = get();
        const setIndex = state.currentSetIndex;

        // Find the original non-libero player the exiting libero replaced
        const originalPlayer = findLiberoOriginalPlayer(state.events, setIndex, team, exitingLibero, position);
        if (!originalPlayer) return 'Cannot determine original player for libero swap';

        // Check serving lock-in if at position I
        let updatedServingPositions = state.liberoServingPositions;
        if (position === 1) {
          const key = `${setIndex}-${team}`;
          const locked = state.liberoServingPositions[key];
          if (locked && (locked.liberoNumber !== enteringLibero || locked.replacedPlayer !== originalPlayer)) {
            return `Serving position locked to Libero #${locked.liberoNumber} replacing #${locked.replacedPlayer}`;
          }
          if (!locked) {
            updatedServingPositions = {
              ...state.liberoServingPositions,
              [key]: { liberoNumber: enteringLibero, replacedPlayer: originalPlayer },
            };
          }
        }

        // Two atomic events: exit + enter
        const exitEvent: MatchEvent = {
          type: 'liberoReplacement',
          id: generateId(),
          timestamp: Date.now(),
          setIndex,
          team,
          liberoNumber: exitingLibero,
          replacedPlayer: originalPlayer,
          position,
          isLiberoEntering: false,
        };

        const enterEvent: MatchEvent = {
          type: 'liberoReplacement',
          id: generateId(),
          timestamp: Date.now(),
          setIndex,
          team,
          liberoNumber: enteringLibero,
          replacedPlayer: originalPlayer,
          position,
          isLiberoEntering: true,
        };

        set({
          events: [...state.events, exitEvent, enterEvent],
          liberoServingPositions: updatedServingPositions,
        });
        return null;
      },

      redesignateLibero: (team, oldLiberoNumber, newLiberoNumber) => {
        set((state) => {
          const teamKey = team === 'home' ? 'homeTeam' : 'awayTeam';
          const teamData = state[teamKey];
          const newRoster = teamData.roster.map((p) => {
            if (p.number === oldLiberoNumber) return { ...p, isLibero: false };
            if (p.number === newLiberoNumber) return { ...p, isLibero: true };
            return p;
          });

          const remarks = [...(state.remarks || [])];
          remarks.push(
            `LIBERO REDESIGNATION: #${newLiberoNumber} replaces injured #${oldLiberoNumber}, ${teamData.name}, Set ${state.currentSetIndex + 1}`
          );

          return {
            [teamKey]: { ...teamData, roster: newRoster },
            remarks,
          };
        });
      },

      applyCorrection: (homeScore, awayScore, homeLineup, awayLineup, servingTeam) => {
        const state = get();
        const setIndex = state.currentSetIndex;
        const currentScore = getSetScore(state.events, setIndex);
        const rotation = getCurrentRotation(state, setIndex);

        const event: MatchEvent = {
          type: 'correction',
          id: generateId(),
          timestamp: Date.now(),
          setIndex,
          homeScore,
          awayScore,
          homeLineup,
          awayLineup,
          servingTeam,
        };

        const changes: string[] = [];
        if (currentScore.home !== homeScore || currentScore.away !== awayScore) {
          changes.push(`Score: ${currentScore.home}:${currentScore.away} to${homeScore}:${awayScore}`);
        }
        if (rotation && rotation.servingTeam !== servingTeam) {
          const servName = servingTeam === 'home' ? state.homeTeam.name : state.awayTeam.name;
          changes.push(`Server to${servName}`);
        }

        const remarks = [...(state.remarks || [])];
        remarks.push(`CORRECTION Set ${setIndex + 1} (${homeScore}:${awayScore}): ${changes.join(', ') || 'Lineup adjusted'}`);

        set({ events: [...state.events, event], remarks });
      },

      addRemark: (note: string) => {
        const state = get();
        set({ remarks: [...(state.remarks || []), note] });
      },

      undo: () => {
        const state = get();
        if (state.events.length === 0) return;

        const newEvents = state.events.slice(0, -1);
        // Recalculate matchComplete
        const lastSetScore = getSetScore(newEvents, state.currentSetIndex);
        const setWinner = getSetWinner(lastSetScore, state.currentSetIndex, state.config);
        let undoMatchComplete = false;
        if (setWinner) {
          const setsWon = getSetsWon({ ...state, events: newEvents });
          undoMatchComplete = isMatchComplete(setsWon, state.config);
        }

        set({ events: newEvents, matchComplete: undoMatchComplete });
      },

      advanceToNextSet: () => {
        const state = get();
        if (state.matchComplete) return;
        const nextSetIndex = state.currentSetIndex + 1;
        if (nextSetIndex >= state.config.bestOf) return;

        // Ensure set data exists
        const sets = [...state.sets];
        if (!sets[nextSetIndex]) {
          sets[nextSetIndex] = createEmptySetData();
        }
        // Alternate bench sides
        sets[nextSetIndex] = {
          ...sets[nextSetIndex],
          homeBenchSide: sets[state.currentSetIndex].homeBenchSide === 'left' ? 'right' : 'left',
        };

        set({ currentSetIndex: nextSetIndex, sets });
      },

      addPlayerToRoster: (team, playerNumber) => {
        set((state) => {
          const teamKey = team === 'home' ? 'homeTeam' : 'awayTeam';
          const teamData = state[teamKey];
          // Don't add if already on roster
          if (teamData.roster.some((p) => p.number === playerNumber)) return {};
          return {
            [teamKey]: {
              ...teamData,
              roster: [...teamData.roster, { number: playerNumber }],
            },
          };
        });
      },

      resetMatch: () => {
        set(initialState);
      },
    }),
    {
      name: 'volleyball-match-storage',
    }
  )
);
