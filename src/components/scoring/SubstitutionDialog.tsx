import { useState } from 'react';
import { useMatchStore } from '@/store/matchStore';
import { getCurrentRotation } from '@/store/derived';
import { validateSubstitution } from '@/store/validators';
import type { TeamSide } from '@/types/match';

interface Props {
  team: TeamSide;
  onClose: () => void;
}

export default function SubstitutionDialog({ team, onClose }: Props) {
  const state = useMatchStore();
  const { homeTeam, awayTeam, recordSubstitution } = state;
  const teamData = team === 'home' ? homeTeam : awayTeam;
  const rotation = getCurrentRotation(state, state.currentSetIndex);

  const [playerOut, setPlayerOut] = useState<number | null>(null);
  const [playerIn, setPlayerIn] = useState<number | null>(null);
  const [error, setError] = useState('');

  if (!rotation) return null;

  const lineup = team === 'home' ? rotation.homeLineup : rotation.awayLineup;
  const onCourt = Object.values(lineup);
  const liberoNumbers = new Set(teamData.roster.filter((p) => p.isLibero).map((p) => p.number));
  const benchPlayers = teamData.roster
    .filter((p) => !p.isLibero && !onCourt.includes(p.number))
    .map((p) => p.number);

  function handleConfirm() {
    if (playerOut === null || playerIn === null) {
      setError('Select both players');
      return;
    }
    const validationError = validateSubstitution(state, team, playerIn, playerOut);
    if (validationError) {
      setError(validationError);
      return;
    }
    const result = recordSubstitution(team, playerIn, playerOut);
    if (result) {
      setError(result);
      return;
    }
    onClose();
  }

  const borderColor = team === 'home' ? 'border-blue-500' : 'border-red-500';
  const teamColor = team === 'home' ? 'text-blue-400' : 'text-red-400';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`bg-slate-800 rounded-2xl p-6 w-full max-w-md border-2 ${borderColor}`}>
        <h2 className={`text-2xl font-bold ${teamColor} mb-4`}>
          Substitution - {teamData.name}
        </h2>

        {/* Player Out */}
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">Player OUT (on court)</label>
          <div className="grid grid-cols-3 gap-2">
            {onCourt
              .filter((n) => !liberoNumbers.has(n))
              .map((num) => (
                <button
                  key={num}
                  onClick={() => setPlayerOut(num)}
                  className={`py-3 rounded-lg text-lg font-bold transition-colors ${
                    playerOut === num
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  #{num}
                </button>
              ))}
          </div>
        </div>

        {/* Player In */}
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">Player IN (from bench)</label>
          <div className="grid grid-cols-3 gap-2">
            {benchPlayers.map((num) => {
              const canSub = playerOut !== null
                ? validateSubstitution(state, team, num, playerOut) === null
                : true;
              return (
                <button
                  key={num}
                  onClick={() => canSub && setPlayerIn(num)}
                  disabled={!canSub}
                  className={`py-3 rounded-lg text-lg font-bold transition-colors ${
                    playerIn === num
                      ? 'bg-green-600 text-white'
                      : canSub
                      ? 'bg-slate-700 text-white hover:bg-slate-600'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  #{num}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-3 py-2 mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition-colors"
          >
            Confirm Sub
          </button>
        </div>
      </div>
    </div>
  );
}
