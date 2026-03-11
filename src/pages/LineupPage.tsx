import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import type { CourtPosition, Lineup, TeamSide, Player } from '@/types/match';

/**
 * 2x3 grid layout matching a real volleyball lineup card:
 *
 *  ┌─────────────────────┐
 *  │       (NET)         │
 *  ├──────┬──────┬───────┤
 *  │  IV  │ III  │  II   │  ← Front row
 *  ├──────┼──────┼───────┤
 *  │  V   │  VI  │  I    │  ← Back row (I = server)
 *  └──────┴──────┴───────┘
 */
const GRID: Array<{ pos: CourtPosition; label: string }> = [
  { pos: 4, label: 'IV' },
  { pos: 3, label: 'III' },
  { pos: 2, label: 'II' },
  { pos: 5, label: 'V' },
  { pos: 6, label: 'VI' },
  { pos: 1, label: 'I' },
];

function parseNumber(val: string): number | null {
  const n = parseInt(val.trim(), 10);
  return !isNaN(n) && n > 0 ? n : null;
}

function parseNumberList(input: string): number[] {
  return input
    .split(/[\s,]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
}

export default function LineupPage() {
  const navigate = useNavigate();
  const { setIndex: setIndexParam } = useParams();
  const setIndex = parseInt(setIndexParam || '0', 10);

  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);
  const setLineup = useMatchStore((s) => s.setLineup);
  const setFirstServe = useMatchStore((s) => s.setFirstServe);

  // Direct number inputs for each position (as strings for controlled inputs)
  const [homeInputs, setHomeInputs] = useState<Record<CourtPosition, string>>({
    1: '', 2: '', 3: '', 4: '', 5: '', 6: '',
  });
  const [awayInputs, setAwayInputs] = useState<Record<CourtPosition, string>>({
    1: '', 2: '', 3: '', 4: '', 5: '', 6: '',
  });
  const [homeBench, setHomeBench] = useState('');
  const [awayBench, setAwayBench] = useState('');
  const [homeLiberos, setHomeLiberos] = useState('');
  const [awayLiberos, setAwayLiberos] = useState('');
  const [homeCaptain, setHomeCaptain] = useState('');
  const [awayCaptain, setAwayCaptain] = useState('');
  const [homeActingCaptain, setHomeActingCaptain] = useState('');
  const [awayActingCaptain, setAwayActingCaptain] = useState('');
  const [firstServeTeam, setFirstServeTeam] = useState<TeamSide>('home');
  const [error, setError] = useState('');

  // Check if captain is in the lineup
  function isCaptainInLineup(inputs: Record<CourtPosition, string>, captainStr: string): boolean {
    const capNum = parseNumber(captainStr.trim());
    if (!capNum) return true; // no captain entered, no issue
    const lineupNums = Object.values(inputs).map(v => parseNumber(v)).filter(Boolean);
    return lineupNums.includes(capNum);
  }

  const homeCaptainInLineup = isCaptainInLineup(homeInputs, homeCaptain);
  const awayCaptainInLineup = isCaptainInLineup(awayInputs, awayCaptain);

  function updateInput(
    team: 'home' | 'away',
    pos: CourtPosition,
    value: string
  ) {
    // Allow only digits
    const cleaned = value.replace(/\D/g, '');
    if (team === 'home') {
      setHomeInputs((prev) => ({ ...prev, [pos]: cleaned }));
    } else {
      setAwayInputs((prev) => ({ ...prev, [pos]: cleaned }));
    }
  }

  function buildLineup(inputs: Record<CourtPosition, string>): Lineup | null {
    const lineup: Partial<Lineup> = {};
    for (const g of GRID) {
      const num = parseNumber(inputs[g.pos]);
      if (!num) return null;
      lineup[g.pos] = num;
    }
    return lineup as Lineup;
  }

  function buildRoster(
    lineup: Lineup,
    benchStr: string,
    liberoStr: string,
    captainStr: string,
    actingCaptainStr: string
  ): Player[] {
    const liberoNums = new Set(parseNumberList(liberoStr));
    const captainNum = parseNumber(captainStr.trim());
    const actingCaptainNum = parseNumber(actingCaptainStr.trim());
    const benchNums = parseNumberList(benchStr);
    const allNums = new Set<number>();
    const roster: Player[] = [];

    // Add starters
    for (let pos = 1; pos <= 6; pos++) {
      const num = lineup[pos as CourtPosition];
      if (!allNums.has(num)) {
        allNums.add(num);
        roster.push({
          number: num,
          isLibero: liberoNums.has(num),
          isCaptain: num === captainNum,
          isActingCaptain: num === actingCaptainNum,
        });
      }
    }

    // Add bench players
    for (const num of benchNums) {
      if (!allNums.has(num)) {
        allNums.add(num);
        roster.push({
          number: num,
          isLibero: liberoNums.has(num),
          isCaptain: num === captainNum,
          isActingCaptain: num === actingCaptainNum,
        });
      }
    }

    // Add liberos not already included
    for (const num of liberoNums) {
      if (!allNums.has(num)) {
        allNums.add(num);
        roster.push({ number: num, isLibero: true, isCaptain: num === captainNum });
      }
    }

    return roster;
  }

  function handleSubmit() {
    setError('');

    const homeLineup = buildLineup(homeInputs);
    const awayLineup = buildLineup(awayInputs);

    if (!homeLineup) {
      setError('Fill in all 6 positions for ' + homeTeam.name);
      return;
    }
    if (!awayLineup) {
      setError('Fill in all 6 positions for ' + awayTeam.name);
      return;
    }

    // Check for duplicates within a lineup
    const homeNums = Object.values(homeLineup);
    if (new Set(homeNums).size !== 6) {
      setError(homeTeam.name + ': each position needs a different player number');
      return;
    }
    const awayNums = Object.values(awayLineup);
    if (new Set(awayNums).size !== 6) {
      setError(awayTeam.name + ': each position needs a different player number');
      return;
    }

    // Validate acting captain if captain is not in lineup
    if (homeCaptain && !homeCaptainInLineup && !homeActingCaptain) {
      setError(homeTeam.name + ': captain #' + homeCaptain + ' is not in the lineup — select an acting captain');
      return;
    }
    if (awayCaptain && !awayCaptainInLineup && !awayActingCaptain) {
      setError(awayTeam.name + ': captain #' + awayCaptain + ' is not in the lineup — select an acting captain');
      return;
    }

    // Build rosters from lineup + bench + liberos + captain
    const homeRoster = buildRoster(homeLineup, homeBench, homeLiberos, homeCaptain, homeActingCaptain);
    const awayRoster = buildRoster(awayLineup, awayBench, awayLiberos, awayCaptain, awayActingCaptain);

    // Update team rosters in store
    useMatchStore.setState({
      homeTeam: { ...homeTeam, roster: homeRoster },
      awayTeam: { ...awayTeam, roster: awayRoster },
    });

    setLineup(setIndex, 'home', homeLineup);
    setLineup(setIndex, 'away', awayLineup);
    setFirstServe(setIndex, firstServeTeam);
    navigate('/scoring');
  }

  function renderLineupCard(team: TeamSide, borderColor: string, teamColor: string) {
    const inputs = team === 'home' ? homeInputs : awayInputs;
    const teamData = team === 'home' ? homeTeam : awayTeam;

    return (
      <div className={`bg-slate-800 rounded-xl p-4 border-2 ${borderColor}`}>
        <h2 className={`text-xl font-bold ${teamColor} mb-3 text-center`}>
          {teamData.name}
        </h2>

        {/* Net label */}
        <div className="text-center text-xs text-slate-500 mb-2 border-b border-slate-600 pb-1">
          NET
        </div>

        {/* 2x3 grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {GRID.map((g) => (
            <div key={g.pos} className="flex flex-col items-center">
              <label className="text-xs text-slate-400 mb-1">{g.label}</label>
              <input
                type="text"
                inputMode="numeric"
                value={inputs[g.pos]}
                onChange={(e) => updateInput(team, g.pos, e.target.value)}
                placeholder="#"
                className="w-full bg-slate-700 text-white text-center text-2xl font-bold rounded-lg py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                maxLength={3}
              />
              {g.pos === 1 && (
                <span className="text-[10px] text-yellow-500 mt-0.5">Server</span>
              )}
            </div>
          ))}
        </div>

        {/* Bench players */}
        <div className="mt-3">
          <label className="block text-xs text-slate-400 mb-1">
            Bench Players (comma separated)
          </label>
          <input
            type="text"
            placeholder="7, 8, 9..."
            value={team === 'home' ? homeBench : awayBench}
            onChange={(e) =>
              team === 'home' ? setHomeBench(e.target.value) : setAwayBench(e.target.value)
            }
            className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Libero */}
        <div className="mt-2">
          <label className="block text-xs text-slate-400 mb-1">
            Libero(s)
          </label>
          <input
            type="text"
            placeholder="e.g. 12"
            value={team === 'home' ? homeLiberos : awayLiberos}
            onChange={(e) =>
              team === 'home' ? setHomeLiberos(e.target.value) : setAwayLiberos(e.target.value)
            }
            className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Captain */}
        <div className="mt-2">
          <label className="block text-xs text-slate-400 mb-1">
            Captain
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 5"
            value={team === 'home' ? homeCaptain : awayCaptain}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/\D/g, '');
              if (team === 'home') {
                setHomeCaptain(cleaned);
                setHomeActingCaptain('');
              } else {
                setAwayCaptain(cleaned);
                setAwayActingCaptain('');
              }
            }}
            className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={3}
          />
        </div>

        {/* Acting Captain - shown when captain is not in lineup */}
        {(() => {
          const captainStr = team === 'home' ? homeCaptain : awayCaptain;
          const captainInLineup = team === 'home' ? homeCaptainInLineup : awayCaptainInLineup;
          const actingCaptain = team === 'home' ? homeActingCaptain : awayActingCaptain;
          const setActing = team === 'home' ? setHomeActingCaptain : setAwayActingCaptain;

          if (!captainStr || captainInLineup) return null;

          // Get lineup player numbers for selection
          const lineupNums = Object.values(inputs)
            .map(v => parseNumber(v))
            .filter((n): n is number => n !== null);

          return (
            <div className="mt-2">
              <label className="block text-xs text-yellow-400 mb-1">
                Acting Captain (#{captainStr} not in lineup)
              </label>
              <div className="flex flex-wrap gap-2">
                {lineupNums.map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setActing(String(num))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                      actingCaptain === String(num)
                        ? 'bg-yellow-600 text-white ring-2 ring-yellow-400'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    #{num}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">
        Set {setIndex + 1} Lineups
      </h1>
      <p className="text-slate-400 mb-6">Enter jersey numbers in each position</p>

      {/* First serve selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">First Serve</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setFirstServeTeam('home')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
              firstServeTeam === 'home'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {homeTeam.name || 'Home'}
          </button>
          <button
            type="button"
            onClick={() => setFirstServeTeam('away')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
              firstServeTeam === 'away'
                ? 'bg-red-700 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {awayTeam.name || 'Away'}
          </button>
        </div>
      </div>

      {/* Lineup cards side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderLineupCard('home', 'border-blue-600', 'text-blue-400')}
        {renderLineupCard('away', 'border-red-700', 'text-red-400')}
      </div>

      {error && (
        <div className="mt-4 bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white text-xl font-semibold py-4 rounded-xl transition-colors"
      >
        Start Set {setIndex + 1}
      </button>
    </div>
  );
}
