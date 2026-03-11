import { useState, useMemo } from 'react';
import { useMatchStore } from '@/store/matchStore';
import { getCurrentRotation, getSubCount } from '@/store/derived';
import { validateSubstitution } from '@/store/validators';
import type { TeamSide } from '@/types/match';

interface Props {
  team: TeamSide;
  onClose: () => void;
  preSelectedOut?: number | null;
}

export default function SubstitutionDialog({ team, onClose, preSelectedOut }: Props) {
  const state = useMatchStore();
  const { homeTeam, awayTeam, recordSubstitution, addPlayerToRoster } = state;
  const teamData = team === 'home' ? homeTeam : awayTeam;
  const rotation = getCurrentRotation(state, state.currentSetIndex);

  const [playerOut, setPlayerOut] = useState<number | null>(preSelectedOut ?? null);
  const [playerIn, setPlayerIn] = useState<number | null>(null);
  const [playerInInput, setPlayerInInput] = useState('');
  const [showAddPrompt, setShowAddPrompt] = useState<number | null>(null);
  const [error, setError] = useState('');

  const subCount = getSubCount(state.events, state.currentSetIndex, team);
  const maxSubs = state.config.maxSubsPerSet;
  const subsRemaining = maxSubs - subCount;

  if (!rotation) return null;

  const lineup = team === 'home' ? rotation.homeLineup : rotation.awayLineup;
  const onCourt = Object.values(lineup);
  const liberoNumbers = new Set(teamData.roster.filter((p) => p.isLibero).map((p) => p.number));
  const benchPlayers = teamData.roster
    .filter((p) => !p.isLibero && !onCourt.includes(p.number))
    .map((p) => p.number);

  // For each court player, find which bench players they can legally swap with
  const legalPairings = useMemo(() => {
    const pairings: Record<number, number[]> = {};
    const courtPlayers = onCourt.filter((n) => !liberoNumbers.has(n));

    for (const out of courtPlayers) {
      const validIns = benchPlayers.filter(
        (inp) => validateSubstitution(state, team, inp, out) === null
      );
      if (validIns.length > 0) {
        pairings[out] = validIns;
      }
    }
    return pairings;
  }, [onCourt, benchPlayers, state, team, liberoNumbers]);

  const eligibleOut = Object.keys(legalPairings).map(Number);
  const eligibleIn = playerOut !== null ? (legalPairings[playerOut] || []) : [];

  function handleSelectOut(num: number) {
    setPlayerOut(num);
    if (playerIn !== null && !(legalPairings[num] || []).includes(playerIn)) {
      setPlayerIn(null);
      setPlayerInInput('');
    }
    setShowAddPrompt(null);
    setError('');
  }

  function handlePlayerInInput(val: string) {
    setPlayerInInput(val);
    setShowAddPrompt(null);
    const num = parseInt(val, 10);
    if (isNaN(num) || val === '') {
      setPlayerIn(null);
      return;
    }
    if (eligibleIn.includes(num)) {
      setPlayerIn(num);
      setError('');
    } else if (playerOut !== null && num > 0) {
      // Not on bench — prompt to add
      setPlayerIn(null);
      setShowAddPrompt(num);
    } else {
      setPlayerIn(null);
    }
  }

  function handleAddNewPlayer(num: number) {
    addPlayerToRoster(team, num);
    setPlayerIn(num);
    setShowAddPrompt(null);
    setPlayerInInput(String(num));
    setError('');
  }

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
        <div className="text-sm text-slate-400 mb-3">
          Subs used: {subCount}/{maxSubs} ({subsRemaining} remaining)
        </div>

        {subsRemaining <= 0 ? (
          <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-3 py-3 mb-4 text-center">
            Maximum substitutions reached for this set
          </div>
        ) : eligibleOut.length === 0 ? (
          <div className="bg-yellow-900/50 border border-yellow-500 text-yellow-200 rounded-lg px-3 py-3 mb-4 text-center">
            No legal substitutions available
          </div>
        ) : (
          <>
            {/* Player Out - hidden when pre-selected from rotation grid */}
            {preSelectedOut != null ? (
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-1">Player OUT</label>
                <span className="text-lg font-bold text-orange-400">#{preSelectedOut}</span>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-2">Player OUT (on court)</label>
                <div className="grid grid-cols-4 gap-2">
                  {eligibleOut.map((num) => (
                    <button
                      key={num}
                      onClick={() => handleSelectOut(num)}
                      className={`py-2 rounded-lg text-base font-bold transition-colors ${
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
            )}

            {/* Player In */}
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">Player IN (from bench)</label>
              {playerOut === null ? (
                <div className="text-slate-500 text-sm py-2">Select a player to sub out first</div>
              ) : (
                <>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Enter jersey #"
                    value={playerInInput}
                    onChange={(e) => handlePlayerInInput(e.target.value)}
                    className={`w-full mb-2 px-3 py-2 rounded-lg bg-slate-700 text-white text-lg font-bold border-2 ${
                      playerIn !== null ? 'border-green-500' : 'border-slate-600'
                    } focus:outline-none focus:border-green-400`}
                  />

                  {/* Add new player prompt */}
                  {showAddPrompt !== null && (
                    <div className="bg-amber-900/50 border border-amber-500 rounded-lg px-3 py-3 mb-2 flex items-center justify-between">
                      <span className="text-amber-200 text-sm">
                        #{showAddPrompt} is not on the roster. Add new player?
                      </span>
                      <div className="flex gap-2 ml-3 shrink-0">
                        <button
                          onClick={() => handleAddNewPlayer(showAddPrompt)}
                          className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded-lg font-semibold"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => { setShowAddPrompt(null); setPlayerInInput(''); }}
                          className="bg-slate-600 hover:bg-slate-500 text-white text-sm px-3 py-1 rounded-lg font-semibold"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}

                  {eligibleIn.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {eligibleIn.map((num) => (
                        <button
                          key={num}
                          onClick={() => { setPlayerIn(num); setPlayerInInput(String(num)); setShowAddPrompt(null); setError(''); }}
                          className={`py-2 rounded-lg text-base font-bold transition-colors ${
                            playerIn === num
                              ? 'bg-green-600 text-white'
                              : 'bg-slate-700 text-white hover:bg-slate-600'
                          }`}
                        >
                          #{num}
                        </button>
                      ))}
                    </div>
                  )}
                  {eligibleIn.length === 0 && showAddPrompt === null && (
                    <div className="text-yellow-400 text-sm py-2">No eligible players to sub in for #{playerOut}. Type a jersey # to add a new player.</div>
                  )}
                </>
              )}
            </div>
          </>
        )}

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
          {subsRemaining > 0 && (
            <button
              onClick={handleConfirm}
              disabled={playerOut === null || playerIn === null}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              Confirm Sub
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
