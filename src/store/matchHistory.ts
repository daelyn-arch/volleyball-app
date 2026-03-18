import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MatchState } from '@/types/match';

export interface MatchHistoryEntry {
  id: string;
  createdAt: number;
  homeTeamName: string;
  awayTeamName: string;
  state: MatchState;
}

interface MatchHistoryStore {
  matches: MatchHistoryEntry[];
  archiveMatch: (state: MatchState) => void;
  deleteMatch: (id: string) => void;
}

export const useMatchHistory = create<MatchHistoryStore>()(
  persist(
    (set, get) => ({
      matches: [],

      archiveMatch: (state: MatchState) => {
        const existing = get().matches;
        // Don't duplicate
        if (existing.some((m) => m.id === state.id)) return;
        set({
          matches: [
            {
              id: state.id,
              createdAt: state.createdAt,
              homeTeamName: state.homeTeam.name,
              awayTeamName: state.awayTeam.name,
              state,
            },
            ...existing,
          ],
        });
      },

      deleteMatch: (id: string) => {
        set({ matches: get().matches.filter((m) => m.id !== id) });
      },
    }),
    {
      name: 'volleyball-match-history',
    }
  )
);
