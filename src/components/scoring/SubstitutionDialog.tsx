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
  const { homeTeam, awayTeam, recordSubstitution, recordExceptionalSubstitution, addPlayerToRoster } = state;
  const teamData = team === 'home' ? homeTeam : awayTeam;
  const rotation = getCurrentRotation(state, state.currentSetIndex);

  const [playerOut, setPlayerOut] = useState<number | null>(preSelectedOut ?? null);
  const [playerIn, setPlayerIn] = useState<number | null>(null);
  const [playerInInput, setPlayerInInput] = useState('');
  const [addingPlayerIn, setAddingPlayerIn] = useState(false);
  const [error, setError] = useState('');

  // Exceptional substitution state (injury bypass)
  const [exceptionalMode, setExceptionalMode] = useState(false);
  const [exceptionalOut, setExceptionalOut] = useState<number | null>(null);
  const [exceptionalIn, setExceptionalIn] = useState<number | null>(null);
  const [exceptionalInInput, setExceptionalInInput] = useState('');
  const [addingExceptionalIn, setAddingExceptionalIn] = useState(false);

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

  // Exceptional sub: all court players and all bench players (no validation)
  const allCourtPlayers = onCourt.filter((n) => !liberoNumbers.has(n));
  const exceptionalBench = teamData.roster
    .filter((p) => !onCourt.includes(p.number))
    .map((p) => p.number);

  function handleExceptionalInInput(val: string) {
    setExceptionalInInput(val);
    const num = parseInt(val, 10);
    if (isNaN(num) || val === '' || num < 1 || num > 99) {
      setExceptionalIn(null);
      return;
    }
    setExceptionalIn(num);
  }

  const exceptionalInNeedsAdd = exceptionalIn !== null && !teamData.roster.some(p => p.number === exceptionalIn);

  function handleExceptionalConfirm() {
    if (exceptionalOut === null || exceptionalIn === null) return;
    if (exceptionalInNeedsAdd) {
      addPlayerToRoster(team, exceptionalIn);
    }
    recordExceptionalSubstitution(team, exceptionalIn, exceptionalOut);
    onClose();
  }

  function handleSelectOut(num: number) {
    setPlayerOut(num);
    if (playerIn !== null && !(legalPairings[num] || []).includes(playerIn)) {
      setPlayerIn(null);
      setPlayerInInput('');
    }
    setError('');
  }

  function handlePlayerInInput(val: string) {
    setPlayerInInput(val);
    const num = parseInt(val, 10);
    if (isNaN(num) || val === '' || num < 1 || num > 99) {
      setPlayerIn(null);
      return;
    }
    setPlayerIn(num);
    setError('');
  }

  // Whether the selected playerIn needs to be added to the roster first
  const playerInNeedsAdd = playerIn !== null && !teamData.roster.some(p => p.number === playerIn);

  function handleConfirm() {
    if (playerOut === null || playerIn === null) {
      setError('Select both players');
      return;
    }
    // Auto-add to roster if new player
    if (playerInNeedsAdd) {
      addPlayerToRoster(team, playerIn);
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2">
      <div className={`bg-slate-800 rounded-2xl p-4 w-full max-w-md max-h-[70vh] overflow-y-auto border-2 ${borderColor}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-2xl font-bold ${teamColor}`}>
            {preSelectedOut != null ? <>Substitution: <span className="text-orange-400">#{preSelectedOut}</span> For</> : 'Substitution'}
          </h2>
          {!exceptionalMode && subsRemaining > 0 && (
            <span className="text-slate-400 text-lg font-bold">{subsRemaining} left</span>
          )}
        </div>

        {exceptionalMode ? (
          <>
            <div className="bg-yellow-900/50 border border-yellow-500 text-yellow-200 rounded-lg px-3 py-2 mb-4 text-sm text-center">
              Exceptional Substitution — Bypasses normal limits
            </div>

            {/* Player Out */}
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">Injured Player (OUT)</label>
              <div className="grid grid-cols-4 gap-2">
                {allCourtPlayers.map((num) => (
                  <button
                    key={num}
                    onClick={() => { setExceptionalOut(num); setExceptionalIn(null); setExceptionalInInput(''); }}
                    className={`py-2 rounded-lg text-base font-bold transition-colors ${
                      exceptionalOut === num
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
            {exceptionalOut !== null && (
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-2">Replacement Player (IN)</label>
                <div className="grid grid-cols-4 gap-2">
                  {exceptionalBench.map((num) => (
                    <button
                      key={num}
                      onClick={() => { setExceptionalIn(num); setExceptionalInInput(String(num)); setAddingExceptionalIn(false); }}
                      className={`py-2 rounded-lg text-base font-bold transition-colors ${
                        exceptionalIn === num
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-700 text-white hover:bg-slate-600'
                      }`}
                    >
                      #{num}
                    </button>
                  ))}
                  {addingExceptionalIn ? (
                    <input
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      placeholder="#"
                      value={exceptionalInInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 2);
                        handleExceptionalInInput(val);
                      }}
                      onBlur={() => { setAddingExceptionalIn(false); }}
                      className="py-2 rounded-lg text-base font-bold bg-slate-700 text-white text-center focus:outline-none focus:ring-2 focus:ring-green-500 border border-dashed border-slate-500"
                      maxLength={2}
                    />
                  ) : (
                    <button
                      onClick={() => { setAddingExceptionalIn(true); setExceptionalInInput(''); }}
                      className="py-2 rounded-lg text-base font-bold bg-slate-700 text-slate-400 hover:bg-slate-600 border border-dashed border-slate-500 transition-colors"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : subsRemaining <= 0 ? (
          <div className="mb-4">
            <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-3 py-3 mb-3 text-center">
              Maximum substitutions reached for this set
            </div>
            <button
              onClick={() => setExceptionalMode(true)}
              className="w-full bg-yellow-700/60 hover:bg-yellow-700 border border-yellow-600 text-yellow-200 py-2.5 rounded-lg font-bold text-sm transition-colors"
            >
              Exceptional Sub (Injury)
            </button>
          </div>
        ) : eligibleOut.length === 0 ? (
          <div className="mb-4">
            <div className="bg-yellow-900/50 border border-yellow-500 text-yellow-200 rounded-lg px-3 py-3 mb-3 text-center">
              No legal substitutions available
            </div>
            <button
              onClick={() => setExceptionalMode(true)}
              className="w-full bg-yellow-700/60 hover:bg-yellow-700 border border-yellow-600 text-yellow-200 py-2.5 rounded-lg font-bold text-sm transition-colors"
            >
              Exceptional Sub (Injury)
            </button>
          </div>
        ) : (
          <>
            {/* Player Out - hidden when pre-selected from rotation grid */}
            {preSelectedOut != null ? (
              <></>
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
              {preSelectedOut == null && <label className="block text-xl text-slate-300 font-semibold mb-2">Player IN</label>}
              {playerOut === null ? (
                <div className="text-slate-500 text-sm py-2">Select a player to sub out first</div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {eligibleIn.map((num) => (
                      <button
                        key={num}
                        onClick={() => { setPlayerIn(num); setPlayerInInput(String(num)); setAddingPlayerIn(false); setError(''); }}
                        className={`py-2 rounded-lg text-base font-bold transition-colors ${
                          playerIn === num
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-700 text-white hover:bg-slate-600'
                        }`}
                      >
                        #{num}
                      </button>
                    ))}
                    {/* Add new player card */}
                    {addingPlayerIn ? (
                      <input
                        autoFocus
                        type="text"
                        inputMode="numeric"
                        placeholder="#"
                        value={playerInInput}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 2);
                          handlePlayerInInput(val);
                        }}
                        onBlur={() => { setAddingPlayerIn(false); }}
                        className="py-2 rounded-lg text-base font-bold bg-slate-700 text-white text-center focus:outline-none focus:ring-2 focus:ring-green-500 border border-dashed border-slate-500"
                        maxLength={2}
                      />
                    ) : (
                      <button
                        onClick={() => { setAddingPlayerIn(true); setPlayerInInput(''); }}
                        className="py-2 rounded-lg text-base font-bold bg-slate-700 text-slate-400 hover:bg-slate-600 border border-dashed border-slate-500 transition-colors"
                      >
                        +
                      </button>
                    )}
                  </div>
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
          {exceptionalMode ? (
            <button
              onClick={handleExceptionalConfirm}
              disabled={exceptionalOut === null || exceptionalIn === null}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              {exceptionalInNeedsAdd ? 'Add & Confirm' : 'Confirm'}
            </button>
          ) : subsRemaining > 0 && (
            <button
              onClick={handleConfirm}
              disabled={playerOut === null || playerIn === null}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              {playerInNeedsAdd ? 'Add & Confirm' : 'Confirm'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
