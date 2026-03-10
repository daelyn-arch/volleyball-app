import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  MatchState,
  MatchConfig,
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
  };
}

interface MatchActions {
  // Setup
  createMatch: (homeTeam: Team, awayTeam: Team, config?: Partial<MatchConfig>) => void;
  setLineup: (setIndex: number, team: TeamSide, lineup: Lineup) => void;
  setFirstServe: (setIndex: number, team: TeamSide) => void;
  setBenchSide: (setIndex: number, side: 'left' | 'right') => void;

  // Scoring
  awardPoint: (scoringTeam: TeamSide) => void;

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

  // Reset
  resetMatch: () => void;
}

export type MatchStore = MatchState & MatchActions;

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
  liberoServingPositions: {},
};

export const useMatchStore = create<MatchStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      createMatch: (homeTeam, awayTeam, config) => {
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
          liberoServingPositions: {},
        });
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

        set({ events: newEvents, matchComplete: newMatchComplete });
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

      resetMatch: () => {
        set(initialState);
      },
    }),
    {
      name: 'volleyball-match-storage',
    }
  )
);
