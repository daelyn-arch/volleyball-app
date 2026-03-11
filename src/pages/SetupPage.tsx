import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import type { Team, MatchMetadata, Lineup } from '@/types/match';

export default function SetupPage() {
  const navigate = useNavigate();
  const createMatch = useMatchStore((s) => s.createMatch);

  const [homeName, setHomeName] = useState('');
  const [awayName, setAwayName] = useState('');
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const [competition, setCompetition] = useState('');
  const [cityState, setCityState] = useState('');
  const [hall, setHall] = useState('');
  const [matchNumber, setMatchNumber] = useState('');
  const [level, setLevel] = useState('');
  const [division, setDivision] = useState<MatchMetadata['division']>('');
  const [category, setCategory] = useState<MatchMetadata['category']>('');
  const [poolPhase, setPoolPhase] = useState('');
  const [court, setCourt] = useState('');
  const [scorer, setScorer] = useState('');
  const [referee, setReferee] = useState('');
  const [downRef, setDownRef] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!homeName.trim() || !awayName.trim()) {
      setError('Both team names are required');
      return;
    }

    const homeTeam: Team = { name: homeName.trim(), roster: [] };
    const awayTeam: Team = { name: awayName.trim(), roster: [] };

    createMatch(homeTeam, awayTeam, { bestOf }, {
      competition: competition.trim(),
      cityState: cityState.trim(),
      hall: hall.trim(),
      matchNumber: matchNumber.trim(),
      level: level.trim(),
      division,
      category,
      poolPhase: poolPhase.trim(),
      court: court.trim(),
      scorer: scorer.trim(),
      referee: referee.trim(),
      downRef: downRef.trim(),
    });
    navigate('/lineup/0');
  }

  const inputClass = 'w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-full p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-6">Match Setup</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Match format */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Match Format</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setBestOf(3)}
              className={`flex-1 py-3 rounded-lg font-semibold text-lg transition-colors ${
                bestOf === 3
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Best of 3
            </button>
            <button
              type="button"
              onClick={() => setBestOf(5)}
              className={`flex-1 py-3 rounded-lg font-semibold text-lg transition-colors ${
                bestOf === 5
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Best of 5
            </button>
          </div>
        </div>

        {/* Team names */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-xl p-4 border-2 border-blue-600">
            <h2 className="text-xl font-bold text-blue-400 mb-3">Home Team</h2>
            <input
              type="text"
              placeholder="Team Name"
              value={homeName}
              onChange={(e) => setHomeName(e.target.value)}
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-slate-800 rounded-xl p-4 border-2 border-red-700">
            <h2 className="text-xl font-bold text-red-400 mb-3">Away Team</h2>
            <input
              type="text"
              placeholder="Team Name"
              value={awayName}
              onChange={(e) => setAwayName(e.target.value)}
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Match Details (optional, collapsible) */}
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:text-white transition-colors"
          >
            <span className="text-sm font-medium">Match Details (optional)</span>
            <span className="text-lg">{showDetails ? '\u25B2' : '\u25BC'}</span>
          </button>

          {showDetails && (
            <div className="px-4 pb-4 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Competition</label>
                <input type="text" placeholder="Name of the Competition" value={competition} onChange={(e) => setCompetition(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">City, State</label>
                <input type="text" placeholder="City, State" value={cityState} onChange={(e) => setCityState(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Hall</label>
                <input type="text" placeholder="Hall / Venue" value={hall} onChange={(e) => setHall(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Match #</label>
                <input type="text" placeholder="Match Number" value={matchNumber} onChange={(e) => setMatchNumber(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Court</label>
                <input type="text" placeholder="Court" value={court} onChange={(e) => setCourt(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Level</label>
                <input type="text" placeholder="Level" value={level} onChange={(e) => setLevel(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Pool / Phase</label>
                <input type="text" placeholder="Pool Phase" value={poolPhase} onChange={(e) => setPoolPhase(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Division</label>
                <div className="flex gap-2">
                  {(['Men', 'Women', 'CoEd'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDivision(division === d ? '' : d)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        division === d ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Category</label>
                <div className="flex gap-2">
                  {(['Adult', 'Junior'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(category === c ? '' : c)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        category === c ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-2 border-t border-slate-700 pt-3 mt-1">
                <label className="block text-xs text-slate-400 mb-2 font-medium">Officials</label>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Scorer</label>
                <input type="text" placeholder="Match Scorer" value={scorer} onChange={(e) => setScorer(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">1st Referee</label>
                <input type="text" placeholder="1st Referee" value={referee} onChange={(e) => setReferee(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Down Referee</label>
                <input type="text" placeholder="Down Ref" value={downRef} onChange={(e) => setDownRef(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white text-xl font-semibold py-4 rounded-xl transition-colors"
        >
          Set Lineups
        </button>

        <button
          type="button"
          onClick={handleDemo}
          className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium py-3 rounded-xl transition-colors"
        >
          Demo Match
        </button>
      </form>
    </div>
  );

  function handleDemo() {
    const homeTeam: Team = {
      name: 'CSUSM',
      roster: [
        { number: 1, isCaptain: true },
        { number: 2 },
        { number: 3 },
        { number: 4 },
        { number: 5 },
        { number: 6 },
        { number: 7 },
        { number: 8 },
        { number: 9 },
        { number: 10, isLibero: true },
      ],
    };
    const awayTeam: Team = {
      name: 'SDSU',
      roster: [
        { number: 11, isCaptain: true },
        { number: 12 },
        { number: 13 },
        { number: 14 },
        { number: 15 },
        { number: 16 },
        { number: 17 },
        { number: 18 },
        { number: 19 },
        { number: 20, isLibero: true },
      ],
    };

    const store = useMatchStore.getState();
    store.createMatch(homeTeam, awayTeam, { bestOf: 3 }, {
      competition: 'CCAA Conference',
      cityState: 'San Marcos, CA',
      hall: 'The Sports Center',
      matchNumber: '101',
      level: 'D2',
      division: 'Women',
      category: 'Adult',
      poolPhase: 'Pool A',
      court: '1',
      scorer: 'Jane Smith',
      referee: 'John Doe',
      downRef: 'Mike Lee',
    });

    const homeLineup: Lineup = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
    const awayLineup: Lineup = { 1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16 };

    store.setLineup(0, 'home', homeLineup);
    store.setLineup(0, 'away', awayLineup);
    store.setFirstServe(0, 'home');

    navigate('/scoring');
  }
}
