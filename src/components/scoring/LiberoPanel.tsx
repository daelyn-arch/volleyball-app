import { useState } from 'react';
import { useMatchStore } from '@/store/matchStore';
import { getCurrentRotation } from '@/store/derived';
import { isBackRow, findPlayerPosition } from '@/utils/rotation';
import type { TeamSide, CourtPosition } from '@/types/match';

interface Props {
  team: TeamSide;
  onClose: () => void;
}

export default function LiberoPanel({ team, onClose }: Props) {
  const state = useMatchStore();
  const { homeTeam, awayTeam, recordLiberoReplacement } = state;
  const teamData = team === 'home' ? homeTeam : awayTeam;
  const rotation = getCurrentRotation(state, state.currentSetIndex);
  const [error, setError] = useState('');

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

  // Find back-row players who can be replaced by libero
  const replaceablePositions: Array<{ position: CourtPosition; playerNumber: number }> = [];
  for (const pos of [1, 5, 6] as CourtPosition[]) {
    const player = lineup[pos];
    if (!liberoNumbers.has(player)) {
      replaceablePositions.push({ position: pos, playerNumber: player });
    }
  }

  function handleLiberoIn(liberoNumber: number, position: CourtPosition, replacedPlayer: number) {
    setError('');
    const result = recordLiberoReplacement(team, liberoNumber, replacedPlayer, position, true);
    if (result) {
      setError(result);
      return;
    }
    onClose();
  }

  function handleLiberoOut(liberoNumber: number, position: CourtPosition, replacedPlayer: number) {
    setError('');
    const result = recordLiberoReplacement(team, liberoNumber, replacedPlayer, position, false);
    if (result) {
      setError(result);
      return;
    }
    onClose();
  }

  const borderColor = team === 'home' ? 'border-blue-500' : 'border-red-500';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`bg-slate-800 rounded-2xl p-6 w-full max-w-md border-2 ${borderColor}`}>
        <h2 className="text-2xl font-bold text-teal-400 mb-4">
          Libero - {teamData.name}
        </h2>

        {/* Libero OUT (if on court) */}
        {liberosOnCourt.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm text-slate-400 mb-2">Remove Libero from Court</h3>
            {liberosOnCourt.map((lc) => (
              <div key={lc.liberoNumber} className="mb-2">
                <p className="text-white text-sm mb-1">
                  Libero #{lc.liberoNumber} at position {lc.position}
                </p>
                {/* Need to choose who comes back in - find the original player for this position */}
                <div className="grid grid-cols-3 gap-2">
                  {teamData.roster
                    .filter((p) => !p.isLibero && !Object.values(lineup).includes(p.number))
                    .map((p) => (
                      <button
                        key={p.number}
                        onClick={() => handleLiberoOut(lc.liberoNumber, lc.position, p.number)}
                        className="bg-orange-700 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-bold"
                      >
                        #{p.number} back
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Libero IN */}
        {replaceablePositions.length > 0 && liberos.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm text-slate-400 mb-2">Put Libero on Court</h3>
            {liberos
              .filter((l) => !liberosOnCourt.some((lc) => lc.liberoNumber === l.number))
              .map((libero) => (
                <div key={libero.number} className="mb-3">
                  <p className="text-teal-300 text-sm font-semibold mb-1">Libero #{libero.number}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {replaceablePositions.map((rp) => (
                      <button
                        key={rp.position}
                        onClick={() => handleLiberoIn(libero.number, rp.position, rp.playerNumber)}
                        className="bg-teal-700 hover:bg-teal-600 text-white py-2 rounded-lg text-sm font-bold"
                      >
                        for #{rp.playerNumber}
                        <span className="block text-xs text-teal-200">pos {rp.position}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-3 py-2 mb-4 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-semibold transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
