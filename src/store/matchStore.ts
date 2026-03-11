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
} from '@/types/match';
import { DEFAULT_CONFIG } from '@/utils/scoring';
import { isSetComplete, getSetWinner, isMatchComplete } from '@/utils/scoring';
import { getSetScore, getSetsWon, getCurrentRotation } from './derived';
import { getServer } from '@/utils/rotation';
import { validateSubstitution, validateTimeout, validateLiberoReplacement } from './validators';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

        const newEvents = [...state.events, event];

        // Check if set is now complete
        const newScore = { home: newHomeScore, away: newAwayScore };
        const setWinner = getSetWinner(newScore, setIndex, state.config);

        let newMatchComplete: boolean = state.matchComplete;
        if (setWinner) {
          const setsWon = getSetsWon({ ...state, events: newEvents });
          newMatchComplete = isMatchComplete(setsWon, state.config);
        }

        // Track set start/end times
        const sets = [...state.sets];
        const setData = sets[setIndex];
        let setsUpdated = false;

        // First point of the set → record start time
        if (currentScore.home === 0 && currentScore.away === 0) {
          sets[setIndex] = { ...setData, startTime: Date.now() };
          setsUpdated = true;
        }

        // Set just completed → record end time
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

        set({ events: [...state.events, event] });
        return null;
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
