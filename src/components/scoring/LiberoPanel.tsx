import { useState } from 'react';
import { useMatchStore } from '@/store/matchStore';
import { getCurrentRotation } from '@/store/derived';
import type { TeamSide, CourtPosition } from '@/types/match';

interface Props {
  team: TeamSide;
  onClose: () => void;
}

const GRID: Array<{ pos: CourtPosition; label: string; row: number; col: number }> = [
  { pos: 4, label: 'IV',  row: 1, col: 1 },
  { pos: 3, label: 'III', row: 1, col: 2 },
  { pos: 2, label: 'II',  row: 1, col: 3 },
  { pos: 5, label: 'V',   row: 2, col: 1 },
  { pos: 6, label: 'VI',  row: 2, col: 2 },
  { pos: 1, label: 'I',   row: 2, col: 3 },
];

const BACK_ROW: CourtPosition[] = [5, 6, 1];

export default function LiberoPanel({ team, onClose }: Props) {
  const state = useMatchStore();
  const { homeTeam, awayTeam, recordLiberoReplacement, swapLiberos, redesignateLibero, addPlayerToRoster } = state;
  const teamData = team === 'home' ? homeTeam : awayTeam;
  const rotation = getCurrentRotation(state, state.currentSetIndex);
  const [error, setError] = useState('');
  const [selectedLibero, setSelectedLibero] = useState<number | null>(null);
  const [redesignating, setRedesignating] = useState<number | null>(null);
  const [redesignateSelection, setRedesignateSelection] = useState<number | null>(null);
  const [addingRedesignate, setAddingRedesignate] = useState(false);
  const [redesignateInput, setRedesignateInput] = useState('');

  if (!rotation) return null;

  const lineup = team === 'home' ? rotation.homeLineup : rotation.awayLineup;
  const liberos = teamData.roster.filter((p) => p.isLibero);
  const liberoNumbers = new Set(liberos.map((p) => p.number));

  // Find liberos currently on court
  const liberosOnCourt: Array<{ liberoNumber: number; position: CourtPosition }> = [];
  for (let pos = 1; pos <= 6; pos++) {
    if (liberoNumbers.has(lineup[pos as CourtPosition])) {
      liberosOnCourt.push({ liberoNumber: lineup[pos as CourtPosition], position: pos as CourtPosition });
    }
  }

  const liberosOffCourt = liberos.filter((l) => !liberosOnCourt.some((lc) => lc.liberoNumber === l.number));

  // Eligible players for redesignation
  const onCourt = new Set(Object.values(lineup));
  const eligibleForRedesignation = teamData.roster.filter(
    (p) => !p.isLibero && !onCourt.has(p.number)
  );

  const servingKey = `${state.currentSetIndex}-${team}`;
  const servingLock = state.liberoServingPositions[servingKey];

  function handleLiberoIn(liberoNumber: number, position: CourtPosition, replacedPlayer: number) {
    setError('');
    const result = recordLiberoReplacement(team, liberoNumber, replacedPlayer, position, true);
    if (result) { setError(result); return; }
    onClose();
  }

  function handleLiberoOut(liberoNumber: number, position: CourtPosition, replacedPlayer: number) {
    setError('');
    const result = recordLiberoReplacement(team, liberoNumber, replacedPlayer, position, false);
    if (result) { setError(result); return; }
    onClose();
  }

  function handleSwapLiberos(enteringLibero: number, exitingLibero: number, position: CourtPosition) {
    setError('');
    const result = swapLiberos(team, enteringLibero, exitingLibero, position);
    if (result) { setError(result); return; }
    onClose();
  }


  const borderColor = team === 'home' ? 'border-blue-500' : 'border-red-500';
  const teamColor = team === 'home' ? 'text-blue-400' : 'text-red-400';

  const redesignateNeedsAdd = redesignateSelection !== null && !teamData.roster.some(p => p.number === redesignateSelection);

  function handleRedesignateInput(val: string) {
    setRedesignateInput(val);
    const num = parseInt(val, 10);
    if (isNaN(num) || val === '' || num < 1 || num > 99) {
      setRedesignateSelection(null);
      return;
    }
    setRedesignateSelection(num);
  }

  function handleConfirmRedesignate() {
    if (!redesignating || redesignateSelection === null) return;
    if (redesignateNeedsAdd) {
      addPlayerToRoster(team, redesignateSelection);
    }
    redesignateLibero(team, redesignating, redesignateSelection);
    setRedesignating(null);
    onClose();
  }

  // Redesignation flow
  if (redesignating !== null) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2">
        <div className={`bg-slate-800 rounded-2xl p-4 w-full max-w-md max-h-[70vh] overflow-y-auto border-2 ${borderColor}`}>
          <h2 className="text-2xl font-bold text-amber-400 mb-3">Redesignate Libero #{redesignating}</h2>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {eligibleForRedesignation.map((p) => (
              <button key={p.number}
                onClick={() => { setRedesignateSelection(p.number); setAddingRedesignate(false); setRedesignateInput(''); }}
                className={`py-2 rounded-lg text-base font-bold transition-colors ${
                  redesignateSelection === p.number
                    ? 'bg-green-600 text-white'
                    : 'bg-teal-700 hover:bg-teal-600 text-white'
                }`}>
                #{p.number}
              </button>
            ))}
            {/* + card for new player */}
            {addingRedesignate ? (
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                placeholder="#"
                value={redesignateInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 2);
                  handleRedesignateInput(val);
                }}
                onBlur={() => setAddingRedesignate(false)}
                className="py-2 rounded-lg text-base font-bold bg-slate-700 text-white text-center focus:outline-none focus:ring-2 focus:ring-green-500 border border-dashed border-slate-500"
                maxLength={2}
              />
            ) : (
              <button
                onClick={() => { setAddingRedesignate(true); setRedesignateInput(''); setRedesignateSelection(null); }}
                className="py-2 rounded-lg text-base font-bold bg-slate-700 text-slate-400 hover:bg-slate-600 border border-dashed border-slate-500 transition-colors">
                +
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setRedesignating(null); setRedesignateSelection(null); setAddingRedesignate(false); setRedesignateInput(''); }}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-semibold transition-colors">
              Cancel
            </button>
            <button
              onClick={handleConfirmRedesignate}
              disabled={redesignateSelection === null}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-semibold transition-colors">
              {redesignateNeedsAdd ? 'Add & Confirm' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: If 2 liberos and none selected yet, show libero picker
  if (liberos.length > 1 && selectedLibero === null) {
    // Check if a libero is on court — if so, selecting them means "take out"
    const isOnCourt = (num: number) => liberosOnCourt.some(lc => lc.liberoNumber === num);

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2">
        <div className={`bg-slate-800 rounded-2xl p-4 w-full max-w-md max-h-[70vh] overflow-y-auto border-2 ${borderColor}`}>
          <h2 className={`text-2xl font-bold ${teamColor} mb-3`}>Libero - {teamData.name}</h2>

          <label className="block text-sm text-slate-400 mb-2">Select Libero</label>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {liberos.map((l) => (
              <button key={l.number} onClick={() => setSelectedLibero(l.number)}
                className={`py-4 rounded-lg text-xl font-bold transition-colors ${
                  isOnCourt(l.number)
                    ? 'bg-teal-600 hover:bg-teal-500 text-white ring-2 ring-teal-400'
                    : 'bg-teal-700 hover:bg-teal-600 text-white'
                }`}>
                #{l.number}
                {isOnCourt(l.number) && <span className="block text-xs text-teal-200 mt-0.5">On Court</span>}
              </button>
            ))}
          </div>

          {/* Redesignation */}
          <div className="mb-4 border-t border-slate-700 pt-3">
            <div className="flex gap-2">
              {liberos.map((l) => (
                <button key={l.number}
                  onClick={() => {
                    if (isOnCourt(l.number)) { setError('Remove libero from court before redesignating'); return; }
                    setRedesignating(l.number);
                  }}
                  className="flex-1 bg-amber-800 hover:bg-amber-700 text-white py-2 rounded-lg text-xs font-bold transition-colors">
                  Redesignate #{l.number}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>
          )}

          <button onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-semibold transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // If only 1 libero, auto-select
  const activeLibero = selectedLibero ?? liberos[0]?.number;
  if (!activeLibero) return null;

  const isLiberoOnCourt = liberosOnCourt.some(lc => lc.liberoNumber === activeLibero);
  const liberoCourtEntry = liberosOnCourt.find(lc => lc.liberoNumber === activeLibero);

  // For libero OUT: find the original player who was replaced (must be the same player)
  let originalPlayer: number | null = null;
  if (isLiberoOnCourt) {
    for (let i = state.events.length - 1; i >= 0; i--) {
      const e = state.events[i];
      if (e.setIndex !== state.currentSetIndex) continue;
      if (e.type === 'liberoReplacement' && e.team === team && e.liberoNumber === activeLibero && e.isLiberoEntering) {
        originalPlayer = e.replacedPlayer;
        break;
      }
    }
  }

  // Check if another libero is already on court (only one libero allowed at a time)
  const anotherLiberoOnCourt = liberosOnCourt.find(lc => lc.liberoNumber !== activeLibero);

  // For libero swap: other liberos off court
  const otherLiberosOff = liberosOffCourt.filter(l => l.number !== activeLibero);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2">
      <div className={`bg-slate-800 rounded-2xl p-4 w-full max-w-md max-h-[70vh] overflow-y-auto border-2 ${borderColor}`}>
        <h2 className={`text-2xl font-bold ${teamColor} mb-3`}>
          Libero <span className="text-teal-400">#{activeLibero}</span> For:
        </h2>

        {servingLock && (
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 mb-3 text-xs text-slate-300">
            Serve locked: L#{servingLock.liberoNumber} for #{servingLock.replacedPlayer}
          </div>
        )}

        {isLiberoOnCourt && liberoCourtEntry ? (
          <>
            {/* Libero is on court — return original player */}
            {originalPlayer !== null && (
              <div className="mb-3">
                <button
                  onClick={() => handleLiberoOut(activeLibero, liberoCourtEntry.position, originalPlayer!)}
                  className="w-full bg-orange-700 hover:bg-orange-600 text-white py-4 rounded-lg text-lg font-bold transition-colors">
                  Return #{originalPlayer}
                </button>
              </div>
            )}

            {/* Swap with other libero */}
            {otherLiberosOff.length > 0 && (
              <div className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">Or swap with:</label>
                <div className="grid grid-cols-4 gap-2">
                  {otherLiberosOff.map((otherLib) => (
                    <button key={otherLib.number}
                      onClick={() => handleSwapLiberos(otherLib.number, activeLibero, liberoCourtEntry.position)}
                      className="bg-purple-700 hover:bg-purple-600 text-white py-2 rounded-lg text-base font-bold transition-colors">
                      L#{otherLib.number}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {anotherLiberoOnCourt ? (
              <div className="mb-3">
                <button
                  onClick={() => handleSwapLiberos(activeLibero, anotherLiberoOnCourt.liberoNumber, anotherLiberoOnCourt.position)}
                  className="w-full bg-purple-700 hover:bg-purple-600 text-white py-4 rounded-lg text-lg font-bold transition-colors">
                  Swap for L#{anotherLiberoOnCourt.liberoNumber} (pos {GRID.find(g => g.pos === anotherLiberoOnCourt.position)?.label})
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {BACK_ROW.map((pos) => {
                  const g = GRID.find(g => g.pos === pos)!;
                  const playerNum = lineup[pos];
                  const isLiberoInPos = liberoNumbers.has(playerNum);
                  const canReplace = !isLiberoInPos;

                  return (
                    <button
                      key={pos}
                      disabled={!canReplace}
                      onClick={canReplace ? () => handleLiberoIn(activeLibero, pos, playerNum) : undefined}
                      className={`py-3 rounded-lg text-base font-bold transition-colors ${
                        canReplace
                          ? 'bg-teal-700 hover:bg-teal-600 text-white'
                          : 'bg-teal-900/50 text-teal-400 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {isLiberoInPos ? `L${playerNum}` : `#${playerNum}`}
                      <span className="block text-[10px] text-slate-400">{g.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>
        )}

        {/* Redesignation — only if single libero (2-libero redesignation is on picker screen) */}
        {liberos.length === 1 && (
          <div className="mb-4 border-t border-slate-700 pt-3">
            <button
              onClick={() => {
                if (isLiberoOnCourt) { setError('Remove libero from court before redesignating'); return; }
                setRedesignating(activeLibero);
              }}
              className="w-full bg-amber-800 hover:bg-amber-700 text-white py-2 rounded-lg text-xs font-bold transition-colors">
              Redesignate #{activeLibero}
            </button>
          </div>
        )}

        <div className="flex gap-3">
          {liberos.length > 1 && (
            <button onClick={() => { setSelectedLibero(null); setError(''); }}
              className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-3 rounded-xl font-semibold transition-colors">
              Back
            </button>
          )}
          <button onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-semibold transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
