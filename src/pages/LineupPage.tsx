import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import { getSetScore } from '@/store/derived';
import { getSetWinner } from '@/utils/scoring';
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
// Counter-clockwise DOM order for tab navigation, with CSS grid placement
const GRID: Array<{ pos: CourtPosition; label: string; row: number; col: number }> = [
  { pos: 1, label: 'I',   row: 2, col: 3 },
  { pos: 2, label: 'II',  row: 1, col: 3 },
  { pos: 3, label: 'III', row: 1, col: 2 },
  { pos: 4, label: 'IV',  row: 1, col: 1 },
  { pos: 5, label: 'V',   row: 2, col: 1 },
  { pos: 6, label: 'VI',  row: 2, col: 2 },
];

function parseNumber(val: string): number | null {
  const n = parseInt(val.trim(), 10);
  return !isNaN(n) && n > 0 ? n : null;
}

export default function LineupPage() {
  const navigate = useNavigate();
  const { setIndex: setIndexParam } = useParams();
  const setIndex = parseInt(setIndexParam || '0', 10);

  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);
  const config = useMatchStore((s) => s.config);
  const events = useMatchStore((s) => s.events);
  const setLineup = useMatchStore((s) => s.setLineup);
  const setFirstServe = useMatchStore((s) => s.setFirstServe);

  // Direct number inputs for each position (as strings for controlled inputs)
  const [homeInputs, setHomeInputs] = useState<Record<CourtPosition, string>>({
    1: '', 2: '', 3: '', 4: '', 5: '', 6: '',
  });
  const [awayInputs, setAwayInputs] = useState<Record<CourtPosition, string>>({
    1: '', 2: '', 3: '', 4: '', 5: '', 6: '',
  });

  // Bench, libero, captain as arrays/numbers
  const [homeBenchPlayers, setHomeBenchPlayers] = useState<number[]>([]);
  const [awayBenchPlayers, setAwayBenchPlayers] = useState<number[]>([]);
  const [homeLiberoPlayers, setHomeLiberoPlayers] = useState<number[]>([]);
  const [awayLiberoPlayers, setAwayLiberoPlayers] = useState<number[]>([]);
  const [homeCaptainNum, setHomeCaptainNum] = useState<number | null>(null);
  const [awayCaptainNum, setAwayCaptainNum] = useState<number | null>(null);
  const [homeActingCaptain, setHomeActingCaptain] = useState('');
  const [awayActingCaptain, setAwayActingCaptain] = useState('');
  const [firstServeTeam, setFirstServeTeam] = useState<TeamSide>('home');
  const [error, setError] = useState('');

  // Adding mode state
  const [addingField, setAddingField] = useState<string | null>(null);
  const [addingInput, setAddingInput] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  const cancellingRef = useRef(false);
  const addedRef = useRef(false);

  useEffect(() => {
    if (addingField && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [addingField]);

  // Check if captain is in the lineup
  function isCaptainInLineup(inputs: Record<CourtPosition, string>, captainNum: number | null): boolean {
    if (!captainNum) return true;
    const lineupNums = Object.values(inputs).map(v => parseNumber(v)).filter(Boolean);
    return lineupNums.includes(captainNum);
  }

  const homeCaptainInLineup = isCaptainInLineup(homeInputs, homeCaptainNum);
  const awayCaptainInLineup = isCaptainInLineup(awayInputs, awayCaptainNum);

  function updateInput(
    team: 'home' | 'away',
    pos: CourtPosition,
    value: string
  ) {
    const cleaned = value.replace(/\D/g, '');
    const setter = team === 'home' ? setHomeInputs : setAwayInputs;
    setter((prev) => {
      const updated = { ...prev, [pos]: cleaned };
      // Clear any other position that has the same number
      if (cleaned) {
        for (const p of [1, 2, 3, 4, 5, 6] as CourtPosition[]) {
          if (p !== pos && updated[p] === cleaned) {
            updated[p] = '';
          }
        }
      }
      return updated;
    });
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
    benchPlayers: number[],
    liberoPlayers: number[],
    captainNum: number | null,
    actingCaptainNum: number | null,
  ): Player[] {
    const liberoNums = new Set(liberoPlayers);
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
    for (const num of benchPlayers) {
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

  function startAdding(field: string) {
    addedRef.current = false;
    setAddingField(field);
    setAddingInput('');
  }

  function cancelAdding() {
    cancellingRef.current = true;
    setAddingField(null);
    setAddingInput('');
    setTimeout(() => { cancellingRef.current = false; }, 100);
  }

  function confirmAdd(field: string) {
    // Guard against double-add from blur + click firing together on iOS
    if (addedRef.current) return;
    addedRef.current = true;

    const num = parseNumber(addingInput);
    setAddingInput('');
    setAddingField(null);
    if (!num) return;

    if (field === 'home-bench') {
      if (!homeBenchPlayers.includes(num)) setHomeBenchPlayers(prev => [...prev, num]);
    } else if (field === 'away-bench') {
      if (!awayBenchPlayers.includes(num)) setAwayBenchPlayers(prev => [...prev, num]);
    } else if (field === 'home-libero') {
      if (!homeLiberoPlayers.includes(num)) setHomeLiberoPlayers(prev => [...prev, num]);
    } else if (field === 'away-libero') {
      if (!awayLiberoPlayers.includes(num)) setAwayLiberoPlayers(prev => [...prev, num]);
    } else if (field === 'home-captain') {
      setHomeCaptainNum(num);
      setHomeActingCaptain('');
    } else if (field === 'away-captain') {
      setAwayCaptainNum(num);
      setAwayActingCaptain('');
    }
  }

  function handleBlur(field: string) {
    // Delay to let Cancel button's mousedown/touchstart register first
    setTimeout(() => {
      if (!cancellingRef.current) {
        confirmAdd(field);
      }
    }, 150);
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
    if (homeCaptainNum && !homeCaptainInLineup && !homeActingCaptain) {
      setError(homeTeam.name + ': captain #' + homeCaptainNum + ' is not in the lineup — select an acting captain');
      return;
    }
    if (awayCaptainNum && !awayCaptainInLineup && !awayActingCaptain) {
      setError(awayTeam.name + ': captain #' + awayCaptainNum + ' is not in the lineup — select an acting captain');
      return;
    }

    const homeActingNum = parseNumber(homeActingCaptain);
    const awayActingNum = parseNumber(awayActingCaptain);

    // Build rosters
    const homeRoster = buildRoster(homeLineup, homeBenchPlayers, homeLiberoPlayers, homeCaptainNum, homeActingNum);
    const awayRoster = buildRoster(awayLineup, awayBenchPlayers, awayLiberoPlayers, awayCaptainNum, awayActingNum);

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

  function renderAddSection(
    field: string,
    label: string,
    buttonLabel: string,
    items: number[],
    onRemove: (num: number) => void,
    accentColor: string,
  ) {
    return (
      <div className="mt-3">
        <label className="block text-xs text-slate-400 mb-1">{label}</label>
        {/* Cards */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {items.map(num => (
              <div key={num} className={`flex items-center ${accentColor} rounded-lg px-3 py-1.5`}>
                <span className="text-white font-bold text-sm">#{num}</span>
                <button
                  type="button"
                  onClick={() => onRemove(num)}
                  className="ml-2 text-slate-300 hover:text-red-400 font-bold text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Add button / input */}
        {addingField === field ? (
          <div className="relative">
            <input
              ref={addInputRef}
              type="text"
              inputMode="numeric"
              value={addingInput}
              onChange={(e) => setAddingInput(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); confirmAdd(field); }
                if (e.key === 'Escape') cancelAdding();
              }}
              onBlur={() => handleBlur(field)}
              placeholder="#"
              className="w-full bg-slate-700 text-white text-lg font-bold rounded-lg pl-3 pr-28 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={3}
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
              <button
                type="button"
                onMouseDown={() => { cancellingRef.current = false; }}
                onClick={() => confirmAdd(field)}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md font-semibold text-sm transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onMouseDown={() => { cancellingRef.current = true; }}
                onTouchStart={() => { cancellingRef.current = true; }}
                onClick={cancelAdding}
                className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1 rounded-md font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => startAdding(field)}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm font-semibold transition-colors border border-dashed border-slate-500"
          >
            + {buttonLabel}
          </button>
        )}
      </div>
    );
  }

  function renderCaptainSection(team: TeamSide) {
    const captainNum = team === 'home' ? homeCaptainNum : awayCaptainNum;
    const setCaptain = team === 'home' ? setHomeCaptainNum : setAwayCaptainNum;
    const setActing = team === 'home' ? setHomeActingCaptain : setAwayActingCaptain;
    const captainInLineup = team === 'home' ? homeCaptainInLineup : awayCaptainInLineup;
    const actingCaptain = team === 'home' ? homeActingCaptain : awayActingCaptain;
    const inputs = team === 'home' ? homeInputs : awayInputs;
    const field = `${team}-captain`;

    return (
      <>
        <div className="mt-3">
          <label className="block text-xs text-slate-400 mb-1">Captain</label>
          {/* Captain card */}
          {captainNum !== null && (
            <div className="flex flex-wrap gap-2 mb-2">
              <div className="flex items-center bg-yellow-700 rounded-lg px-3 py-1.5">
                <span className="text-white font-bold text-sm">#{captainNum}</span>
                <button
                  type="button"
                  onClick={() => { setCaptain(null); setActing(''); }}
                  className="ml-2 text-slate-300 hover:text-red-400 font-bold text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>
          )}
          {/* Add button / input */}
          {captainNum === null && (
            addingField === field ? (
              <div className="relative">
                <input
                  ref={addInputRef}
                  type="text"
                  inputMode="numeric"
                  value={addingInput}
                  onChange={(e) => setAddingInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); confirmAdd(field); }
                    if (e.key === 'Escape') cancelAdding();
                  }}
                  onBlur={() => handleBlur(field)}
                  placeholder="#"
                  className="w-full bg-slate-700 text-white text-lg font-bold rounded-lg pl-3 pr-28 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={3}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    type="button"
                    onMouseDown={() => { cancellingRef.current = false; }}
                    onClick={() => confirmAdd(field)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md font-semibold text-sm transition-colors"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onMouseDown={() => { cancellingRef.current = true; }}
                    onTouchStart={() => { cancellingRef.current = true; }}
                    onClick={cancelAdding}
                    className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1 rounded-md font-semibold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startAdding(field)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm font-semibold transition-colors border border-dashed border-slate-500"
              >
                + Set Captain
              </button>
            )
          )}
        </div>

        {/* Acting Captain - shown when captain is not in lineup */}
        {captainNum !== null && !captainInLineup && (
          <div className="mt-2">
            <label className="block text-xs text-yellow-400 mb-1">
              Choose an Acting Captain (#{captainNum} not on court)
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.values(inputs)
                .map(v => parseNumber(v))
                .filter((n): n is number => n !== null)
                .map(num => (
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
        )}
      </>
    );
  }

  function renderLineupCard(team: TeamSide, borderColor: string, teamColor: string) {
    const inputs = team === 'home' ? homeInputs : awayInputs;
    const teamData = team === 'home' ? homeTeam : awayTeam;
    const benchPlayers = team === 'home' ? homeBenchPlayers : awayBenchPlayers;
    const setBench = team === 'home' ? setHomeBenchPlayers : setAwayBenchPlayers;
    const liberoPlayers = team === 'home' ? homeLiberoPlayers : awayLiberoPlayers;
    const setLiberos = team === 'home' ? setHomeLiberoPlayers : setAwayLiberoPlayers;

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
            <div key={g.pos} className="flex flex-col items-center" style={{ gridRow: g.row, gridColumn: g.col }}>
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
        {renderAddSection(
          `${team}-bench`,
          'Bench Players',
          'Add Player',
          benchPlayers,
          (num) => setBench(prev => prev.filter(n => n !== num)),
          'bg-slate-600',
        )}

        {/* Libero */}
        {renderAddSection(
          `${team}-libero`,
          'Libero(s)',
          'Add Libero',
          liberoPlayers,
          (num) => setLiberos(prev => prev.filter(n => n !== num)),
          'bg-teal-700',
        )}

        {/* Captain */}
        {renderCaptainSection(team)}
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 max-w-3xl mx-auto">
      {/* Set Progress Bar */}
      <div className="flex rounded-lg overflow-hidden mb-4">
        {Array.from({ length: config.bestOf }, (_, i) => {
          const score = getSetScore(events, i);
          const winner = getSetWinner(score, i, config);
          const isCurrent = i === setIndex;
          let bg = 'bg-slate-700';
          if (winner === 'home') bg = 'bg-blue-600';
          else if (winner === 'away') bg = 'bg-red-700';
          return (
            <div
              key={i}
              className={`flex-1 py-1.5 text-center text-sm font-bold text-white ${bg} ${isCurrent ? 'ring-2 ring-yellow-400 ring-inset' : ''} ${i > 0 ? 'border-l border-slate-600' : ''}`}
            >
              Set {i + 1}
            </div>
          );
        })}
      </div>

      <h1 className="text-3xl font-bold text-white mb-2 text-center">
        Set {setIndex + 1} Lineups
      </h1>

      {/* First serve selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-yellow-400 mb-2 text-center">First Serve ◉</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setFirstServeTeam('home')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
              firstServeTeam === 'home'
                ? 'bg-blue-600 text-white border-2 border-yellow-400'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border-2 border-transparent'
            }`}
          >
            {homeTeam.name || 'Home'}
          </button>
          <button
            type="button"
            onClick={() => setFirstServeTeam('away')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
              firstServeTeam === 'away'
                ? 'bg-red-700 text-white border-2 border-yellow-400'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border-2 border-transparent'
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
