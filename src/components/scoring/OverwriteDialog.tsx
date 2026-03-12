import { useState } from 'react';
import { useMatchStore } from '@/store/matchStore';
import { getSetScore, getCurrentRotation } from '@/store/derived';
import { rotateLineup } from '@/utils/rotation';
import type { Lineup, CourtPosition, TeamSide } from '@/types/match';

function rotateCounterClockwise(lineup: Lineup): Lineup {
  return { 1: lineup[6], 2: lineup[1], 3: lineup[2], 4: lineup[3], 5: lineup[4], 6: lineup[5] } as Lineup;
}

interface Props {
  onClose: () => void;
}

const POSITIONS: { pos: CourtPosition; label: string }[] = [
  { pos: 4, label: 'IV' },
  { pos: 3, label: 'III' },
  { pos: 2, label: 'II' },
  { pos: 5, label: 'V' },
  { pos: 6, label: 'VI' },
  { pos: 1, label: 'I' },
];

export default function OverwriteDialog({ onClose }: Props) {
  const state = useMatchStore();
  const { homeTeam, awayTeam, events, currentSetIndex, applyCorrection, cancelWrongServerPoints } = state;
  const rotation = getCurrentRotation(state, currentSetIndex);
  const score = getSetScore(events, currentSetIndex);

  const [homeScore, setHomeScore] = useState(score.home);
  const [awayScore, setAwayScore] = useState(score.away);

  // Wrong server flow: select team → pick count → confirm
  const [wrongServerTeam, setWrongServerTeam] = useState<TeamSide | null>(null);
  const [wrongServerCount, setWrongServerCount] = useState(0);
  const [wrongServerMax, setWrongServerMax] = useState(0);
  const [wrongServerResult, setWrongServerResult] = useState<string | null>(null);

  function handleSelectWrongServerTeam(team: TeamSide) {
    const max = state.getWrongServerPointCount(team);
    if (max === 0) {
      setWrongServerResult('No points to remove (team has no points in current service run)');
      return;
    }
    setWrongServerTeam(team);
    setWrongServerMax(max);
    setWrongServerCount(max);
  }

  function handleConfirmWrongServer() {
    if (!wrongServerTeam || wrongServerCount <= 0) return;
    const removed = cancelWrongServerPoints(wrongServerTeam, wrongServerCount);
    const teamName = wrongServerTeam === 'home' ? homeTeam.name : awayTeam.name;
    setWrongServerResult(`${removed} point${removed > 1 ? 's' : ''} removed from ${teamName}`);
    setWrongServerTeam(null);
  }
  const [homeLineup, setHomeLineup] = useState<Lineup>(
    rotation?.homeLineup ? { ...rotation.homeLineup } : { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Lineup
  );
  const [awayLineup, setAwayLineup] = useState<Lineup>(
    rotation?.awayLineup ? { ...rotation.awayLineup } : { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Lineup
  );
  const [servingTeam, setServingTeam] = useState<TeamSide>(rotation?.servingTeam ?? 'home');

  const homeRoster = homeTeam.roster.map((p) => p.number);
  const awayRoster = awayTeam.roster.map((p) => p.number);

  function updateLineup(team: 'home' | 'away', pos: CourtPosition, playerNum: number) {
    if (team === 'home') {
      setHomeLineup((prev) => ({ ...prev, [pos]: playerNum }));
    } else {
      setAwayLineup((prev) => ({ ...prev, [pos]: playerNum }));
    }
  }

  function handleApply() {
    applyCorrection(homeScore, awayScore, homeLineup, awayLineup, servingTeam);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 z-10">
          <h2 className="text-white font-bold text-lg">Overwrite State</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Wrong Server */}
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Wrong Server</h3>
            {wrongServerResult ? (
              <div className="bg-amber-900/50 border border-amber-500 text-amber-200 rounded-lg px-3 py-2 text-sm text-center">
                {wrongServerResult}
              </div>
            ) : wrongServerTeam ? (
              <div className="flex flex-col gap-2">
                <p className="text-slate-300 text-xs text-center">
                  Points to remove from {wrongServerTeam === 'home' ? homeTeam.name : awayTeam.name}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setWrongServerCount(Math.max(1, wrongServerCount - 1))}
                    className="bg-slate-700 text-white w-9 h-9 rounded font-bold text-lg"
                  >
                    -
                  </button>
                  <span className="text-white text-2xl font-bold w-10 text-center tabular-nums">{wrongServerCount}</span>
                  <button
                    onClick={() => setWrongServerCount(Math.min(wrongServerMax, wrongServerCount + 1))}
                    className="bg-slate-700 text-white w-9 h-9 rounded font-bold text-lg"
                  >
                    +
                  </button>
                  <span className="text-slate-500 text-xs">/ {wrongServerMax}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setWrongServerTeam(null)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg font-bold text-sm transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmWrongServer}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg font-bold text-sm transition-colors"
                  >
                    Remove {wrongServerCount} pt{wrongServerCount > 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSelectWrongServerTeam('home')}
                  className="flex-1 bg-blue-700/50 hover:bg-blue-600/50 border border-blue-500 text-blue-200 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                  {homeTeam.name || 'Home'}
                </button>
                <button
                  onClick={() => handleSelectWrongServerTeam('away')}
                  className="flex-1 bg-red-700/50 hover:bg-red-600/50 border border-red-500 text-red-200 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                  {awayTeam.name || 'Away'}
                </button>
              </div>
            )}
          </div>

          {/* Score */}
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Score</h3>
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <span className="text-blue-400 text-xs font-bold">{homeTeam.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setHomeScore(Math.max(0, homeScore - 1))} className="bg-slate-700 text-white w-8 h-8 rounded font-bold text-lg">-</button>
                  <span className="text-white text-2xl font-bold w-10 text-center tabular-nums">{homeScore}</span>
                  <button onClick={() => setHomeScore(homeScore + 1)} className="bg-slate-700 text-white w-8 h-8 rounded font-bold text-lg">+</button>
                </div>
              </div>
              <span className="text-slate-500 text-lg font-bold">:</span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-red-400 text-xs font-bold">{awayTeam.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAwayScore(Math.max(0, awayScore - 1))} className="bg-slate-700 text-white w-8 h-8 rounded font-bold text-lg">-</button>
                  <span className="text-white text-2xl font-bold w-10 text-center tabular-nums">{awayScore}</span>
                  <button onClick={() => setAwayScore(awayScore + 1)} className="bg-slate-700 text-white w-8 h-8 rounded font-bold text-lg">+</button>
                </div>
              </div>
            </div>
          </div>

          {/* Server */}
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Serving Team</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setServingTeam('home')}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${servingTeam === 'home' ? 'bg-blue-600 text-white ring-2 ring-yellow-400' : 'bg-slate-700 text-slate-400'}`}
              >
                {homeTeam.name}
              </button>
              <button
                onClick={() => setServingTeam('away')}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${servingTeam === 'away' ? 'bg-red-600 text-white ring-2 ring-yellow-400' : 'bg-slate-700 text-slate-400'}`}
              >
                {awayTeam.name}
              </button>
            </div>
          </div>

          {/* Rotations */}
          <div className="flex gap-3">
            {/* Home Rotation */}
            <div className="flex-1">
              <div className="flex items-center justify-center gap-1 mb-2">
                <button
                  onClick={() => setHomeLineup(prev => rotateCounterClockwise(prev))}
                  className="text-slate-400 hover:text-blue-300 active:text-blue-200 text-sm w-6 h-6 flex items-center justify-center rounded border border-slate-600 transition-colors"
                  title="Rotate counter-clockwise"
                >&#x21BA;</button>
                <h3 className="text-blue-400 text-xs font-bold uppercase">{homeTeam.name}</h3>
                <button
                  onClick={() => setHomeLineup(rotateLineup)}
                  className="text-slate-400 hover:text-blue-300 active:text-blue-200 text-sm w-6 h-6 flex items-center justify-center rounded border border-slate-600 transition-colors"
                  title="Rotate clockwise"
                >&#x21BB;</button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {POSITIONS.map(({ pos, label }) => (
                  <div key={pos} className="flex flex-col items-center">
                    <span className="text-[9px] text-slate-500">{label}{pos === 1 && servingTeam === 'home' ? ' *' : ''}</span>
                    <select
                      value={homeLineup[pos]}
                      onChange={(e) => updateLineup('home', pos, Number(e.target.value))}
                      className="w-full bg-slate-700 text-white text-sm font-bold rounded px-1 py-1.5 text-center appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {homeRoster.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Away Rotation */}
            <div className="flex-1">
              <div className="flex items-center justify-center gap-1 mb-2">
                <button
                  onClick={() => setAwayLineup(prev => rotateCounterClockwise(prev))}
                  className="text-slate-400 hover:text-red-300 active:text-red-200 text-sm w-6 h-6 flex items-center justify-center rounded border border-slate-600 transition-colors"
                  title="Rotate counter-clockwise"
                >&#x21BA;</button>
                <h3 className="text-red-400 text-xs font-bold uppercase">{awayTeam.name}</h3>
                <button
                  onClick={() => setAwayLineup(rotateLineup)}
                  className="text-slate-400 hover:text-red-300 active:text-red-200 text-sm w-6 h-6 flex items-center justify-center rounded border border-slate-600 transition-colors"
                  title="Rotate clockwise"
                >&#x21BB;</button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {POSITIONS.map(({ pos, label }) => (
                  <div key={pos} className="flex flex-col items-center">
                    <span className="text-[9px] text-slate-500">{label}{pos === 1 && servingTeam === 'away' ? ' *' : ''}</span>
                    <select
                      value={awayLineup[pos]}
                      onChange={(e) => updateLineup('away', pos, Number(e.target.value))}
                      className="w-full bg-slate-700 text-white text-sm font-bold rounded px-1 py-1.5 text-center appearance-none focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      {awayRoster.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-1">
            <button onClick={onClose} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-3 rounded-lg font-bold text-sm transition-colors">
              Cancel
            </button>
            <button onClick={handleApply} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-lg font-bold text-sm transition-colors">
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
