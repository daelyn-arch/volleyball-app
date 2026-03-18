import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import type { Team, MatchMetadata, Lineup, TeamSide } from '@/types/match';

const USAV_REGIONS = [
  { code: 'AH', name: 'Aloha' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'BG', name: 'Badger' }, { code: 'BY', name: 'Bayou' }, { code: 'CE', name: 'Columbia Empire' },
  { code: 'CH', name: 'Chesapeake' }, { code: 'CR', name: 'Carolina' }, { code: 'DE', name: 'Delta' },
  { code: 'EV', name: 'Evergreen' }, { code: 'FL', name: 'Florida' }, { code: 'GC', name: 'Gulf Coast' },
  { code: 'GE', name: 'Grand East' }, { code: 'GL', name: 'Great Lakes' }, { code: 'GP', name: 'Great Plains' },
  { code: 'GW', name: 'Gateway' }, { code: 'HA', name: 'Heart of America' }, { code: 'HO', name: 'Hoosier' },
  { code: 'IA', name: 'Iowa' }, { code: 'IM', name: 'Intermountain' }, { code: 'KE', name: 'Keystone' },
  { code: 'LK', name: 'Lakeshore' }, { code: 'LS', name: 'Lone Star' }, { code: 'MK', name: 'Moku O Keawe' },
  { code: 'NC', name: 'Northern California' }, { code: 'NE', name: 'New England' }, { code: 'NO', name: 'North Country' },
  { code: 'NT', name: 'North Texas' }, { code: 'OD', name: 'Old Dominion' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OV', name: 'Ohio Valley' }, { code: 'PM', name: 'Palmetto' }, { code: 'PR', name: 'Pioneer' },
  { code: 'PS', name: 'Puget Sound' }, { code: 'RM', name: 'Rocky Mountain' }, { code: 'SC', name: 'Southern California' },
  { code: 'SO', name: 'Southern' }, { code: 'SU', name: 'Sun Country' }, { code: 'WE', name: 'Western Empire' },
  { code: 'XL', name: 'Excel' },
];

export default function SetupPage() {
  const navigate = useNavigate();
  const createMatch = useMatchStore((s) => s.createMatch);

  const [homeName, setHomeName] = useState('');
  const [awayName, setAwayName] = useState('');
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [devTaps, setDevTaps] = useState(0);
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
  const [workTeam, setWorkTeam] = useState('');
  const [region, setRegion] = useState('');
  const [regionSearch, setRegionSearch] = useState('');
  const [regionOpen, setRegionOpen] = useState(false);

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
      workTeam: workTeam.trim(),
      region,
    });
    navigate('/lineup/0');
  }

  const inputClass = 'w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-[17px] focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-full p-6 max-w-2xl mx-auto">
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate('/')}
          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-lg font-bold transition-colors shrink-0"
        >
          &larr;
        </button>
        <h1 className="text-3xl font-bold text-white flex-1 text-center mr-12">Match Setup</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Match format */}
        <div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setBestOf(3); setDevTaps(n => n + 1); }}
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
              onClick={() => { setBestOf(5); setDevTaps(0); }}
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
            <h2 className="text-xl font-bold text-blue-400 mb-3">Left Side</h2>
            <input
              type="text"
              placeholder="Team Name"
              value={homeName}
              onChange={(e) => setHomeName(e.target.value)}
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-slate-800 rounded-xl p-4 border-2 border-red-700">
            <h2 className="text-xl font-bold text-red-400 mb-3">Right Side</h2>
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
            <span className="text-[17px] font-medium">Match Details (optional)</span>
            <span className="text-lg">{showDetails ? '\u25B2' : '\u25BC'}</span>
          </button>

          {showDetails && (
            <div className="px-4 pb-4 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[15px] text-slate-400 mb-1">Competition</label>
                <input type="text" placeholder="Name of the Competition" value={competition} onChange={(e) => setCompetition(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[15px] text-slate-400 mb-1">City, State</label>
                <input type="text" placeholder="City, State" value={cityState} onChange={(e) => setCityState(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[15px] text-slate-400 mb-1">Hall</label>
                <input type="text" placeholder="Hall / Venue" value={hall} onChange={(e) => setHall(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[15px] text-slate-400 mb-1">Match #</label>
                <input type="text" placeholder="Match Number" value={matchNumber} onChange={(e) => setMatchNumber(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[15px] text-slate-400 mb-1">Court</label>
                <input type="text" placeholder="Court" value={court} onChange={(e) => setCourt(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[15px] text-slate-400 mb-1">Level</label>
                <input type="text" placeholder="Level" value={level} onChange={(e) => setLevel(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[15px] text-slate-400 mb-1">Pool / Phase</label>
                <input type="text" placeholder="Pool Phase" value={poolPhase} onChange={(e) => setPoolPhase(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[15px] text-slate-400 mb-1">Division</label>
                <div className="flex gap-2">
                  {(['Men', 'Women', 'CoEd'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDivision(division === d ? '' : d)}
                      className={`flex-1 py-2 rounded-lg text-[15px] font-semibold transition-colors ${
                        division === d ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[15px] text-slate-400 mb-1">Category</label>
                <div className="flex gap-2">
                  {(['Adult', 'Junior'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(category === c ? '' : c)}
                      className={`flex-1 py-2 rounded-lg text-[15px] font-semibold transition-colors ${
                        category === c ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-2 border-t border-slate-700 pt-3 mt-1">
                <label className="block text-[15px] text-slate-400 mb-2 font-medium">Officials</label>
              </div>
              <div>
                <label className="block text-[15px] text-slate-400 mb-1">Scorer</label>
                <input type="text" placeholder="Match Scorer" value={scorer} onChange={(e) => setScorer(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[15px] text-slate-400 mb-1">1st Referee</label>
                <input type="text" placeholder="1st Referee" value={referee} onChange={(e) => setReferee(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[15px] text-slate-400 mb-1">Down Referee</label>
                <input type="text" placeholder="Down Ref" value={downRef} onChange={(e) => setDownRef(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[15px] text-slate-400 mb-1">Work Team</label>
                <input type="text" placeholder="Work Team" value={workTeam} onChange={(e) => setWorkTeam(e.target.value)} className={inputClass} />
              </div>
              <div className="relative">
                <label className="block text-[15px] text-slate-400 mb-1">Region</label>
                <input
                  type="text"
                  placeholder="Search region..."
                  value={regionOpen ? regionSearch : (region ? `${region} — ${USAV_REGIONS.find(r => r.code === region)?.name || ''}` : '')}
                  onChange={(e) => { setRegionSearch(e.target.value); setRegionOpen(true); }}
                  onFocus={() => setRegionOpen(true)}
                  className={inputClass}
                />
                {regionOpen && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-slate-700 border border-slate-600 rounded-lg shadow-lg">
                    {USAV_REGIONS
                      .filter(r => {
                        const q = regionSearch.toLowerCase();
                        return !q || r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
                      })
                      .map(r => (
                        <button
                          key={r.code}
                          type="button"
                          onClick={() => { setRegion(r.code); setRegionSearch(''); setRegionOpen(false); }}
                          className="w-full text-left px-3 py-2 text-[17px] text-white hover:bg-slate-600 transition-colors"
                        >
                          <span className="font-bold">{r.code}</span> — {r.name}
                        </button>
                      ))
                    }
                  </div>
                )}
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

        {devTaps >= 5 && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDemo}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium py-3 rounded-xl transition-colors"
            >
              Demo Match
            </button>
            <button
              type="button"
              onClick={handleRandomGame}
              className="flex-1 bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium py-3 rounded-xl transition-colors"
            >
              Random Game
            </button>
          </div>
        )}
      </form>
    </div>
  );

  function handleRandomGame() {
    // Set up the demo match inline (don't call handleDemo which navigates)
    const homeTeam: Team = {
      name: 'CSUSM',
      roster: [
        { number: 1, isCaptain: true }, { number: 2 }, { number: 3 },
        { number: 4 }, { number: 5 }, { number: 6 },
        { number: 7 }, { number: 8 }, { number: 9 },
        { number: 10, isLibero: true },
      ],
    };
    const awayTeam: Team = {
      name: 'SDSU',
      roster: [
        { number: 11, isCaptain: true }, { number: 12 }, { number: 13 },
        { number: 14 }, { number: 15 }, { number: 16 },
        { number: 17 }, { number: 18 }, { number: 19 },
        { number: 20, isLibero: true },
      ],
    };
    const store = useMatchStore.getState();
    store.createMatch(homeTeam, awayTeam, { bestOf: 3 }, {
      competition: 'CCAA Conference', cityState: 'San Marcos, CA',
      hall: 'The Sports Center', matchNumber: '101', level: 'D2',
      division: 'Women', category: 'Adult', poolPhase: 'Pool A',
      court: '1', scorer: 'Jane Smith', referee: 'John Doe', downRef: 'Mike Lee', workTeam: 'WT1', region: 'SC',
    });
    const homeLineup0: Lineup = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
    const awayLineup0: Lineup = { 1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16 };
    store.setLineup(0, 'home', homeLineup0);
    store.setLineup(0, 'away', awayLineup0);
    store.setFirstServe(0, 'home');

    // Now simulate random gameplay
    const bestOf = 3;
    const setsToPlay = Math.random() < 0.5 ? 2 : 3; // 2 sets (sweep) or 3 sets

    for (let setNum = 0; setNum < setsToPlay; setNum++) {
      if (setNum > 0) {
        // Advance to next set and set lineups
        store.advanceToNextSet();
        const homeLineup: Lineup = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
        const awayLineup: Lineup = { 1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16 };
        store.setLineup(setNum, 'home', homeLineup);
        store.setLineup(setNum, 'away', awayLineup);
        store.setFirstServe(setNum, setNum % 2 === 0 ? 'home' : 'away');
      }

      // Determine target scores for this set
      const isDeciding = setNum === 2;
      const maxPts = isDeciding ? 15 : 25;
      let homeTarget: number, awayTarget: number;

      if (setNum < 2) {
        // First two sets: alternate winner or random
        const homeWins = setNum === 0 ? Math.random() < 0.6 : (setsToPlay === 3 ? !true : Math.random() < 0.6);
        if (setsToPlay === 2) {
          // Sweep: same team wins both
          homeTarget = maxPts;
          awayTarget = Math.floor(Math.random() * 10) + 15; // 15-24
        } else {
          // 3 sets: each team wins one of the first two
          if (setNum === 0) {
            homeTarget = maxPts;
            awayTarget = Math.floor(Math.random() * 10) + 15;
          } else {
            awayTarget = maxPts;
            homeTarget = Math.floor(Math.random() * 10) + 15;
          }
        }
      } else {
        // Deciding set
        const homeWinsDecider = Math.random() < 0.5;
        if (homeWinsDecider) {
          homeTarget = maxPts;
          awayTarget = Math.floor(Math.random() * 5) + 10; // 10-14
        } else {
          awayTarget = maxPts;
          homeTarget = Math.floor(Math.random() * 5) + 10;
        }
      }

      // Ensure at least 2-point lead if close
      if (Math.abs(homeTarget - awayTarget) < 2 && (homeTarget >= maxPts || awayTarget >= maxPts)) {
        if (homeTarget > awayTarget) awayTarget = homeTarget - 2;
        else homeTarget = awayTarget - 2;
      }

      // Simulate points in random order, with occasional subs/timeouts
      const totalPoints = homeTarget + awayTarget;
      let homeScored = 0;
      let awayScored = 0;
      const subsDone: Record<string, number> = { home: 0, away: 0 };
      const tosDone: Record<string, number> = { home: 0, away: 0 };

      // Create a shuffled sequence of which team scores each point
      const sequence: TeamSide[] = [];
      for (let i = 0; i < homeTarget; i++) sequence.push('home');
      for (let i = 0; i < awayTarget; i++) sequence.push('away');
      // Shuffle all but the last point (winner must score last)
      const lastPoint = sequence[sequence.length - 1];
      const rest = sequence.slice(0, -1);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      rest.push(lastPoint);

      const sanctionsDone: Record<string, number> = { home: 0, away: 0 };
      const sanctionTypes: Array<'warning' | 'penalty' | 'delay-warning' | 'delay-penalty'> = ['warning', 'penalty', 'delay-warning', 'delay-penalty'];
      const sanctionRecipients: Array<'player' | 'coach' | 'asstCoach'> = ['player', 'player', 'player', 'coach', 'asstCoach'];

      for (const team of rest) {
        // Random timeout (~5% chance, max 2 per team)
        const toTeam: TeamSide = Math.random() < 0.5 ? 'home' : 'away';
        if (Math.random() < 0.05 && tosDone[toTeam] < 2) {
          store.recordTimeout(toTeam);
          tosDone[toTeam]++;
        }

        // Random substitution (~8% chance, max a few per set)
        if (Math.random() < 0.08 && subsDone.home < 4) {
          const benchPlayers = [7, 8, 9];
          const available = benchPlayers.filter(n => {
            // Check not already on court by just trying
            return true;
          });
          if (available.length > 0) {
            const pin = available[Math.floor(Math.random() * available.length)];
            const courtPlayers = [1, 2, 3, 4, 5, 6];
            const pout = courtPlayers[Math.floor(Math.random() * courtPlayers.length)];
            store.recordSubstitution('home', pin, pout);
            subsDone.home++;
          }
        }

        // Random sanction (~3% chance, max 2 per team per set)
        const sanctionTeam: TeamSide = Math.random() < 0.5 ? 'home' : 'away';
        if (Math.random() < 0.03 && sanctionsDone[sanctionTeam] < 2) {
          const sType = sanctionTypes[Math.floor(Math.random() * sanctionTypes.length)];
          // Warnings and penalties always target a player
          const isPlayerSanction = sType === 'warning' || sType === 'penalty';
          const recipient = isPlayerSanction ? 'player' : sanctionRecipients[Math.floor(Math.random() * sanctionRecipients.length)];
          const playerNum = recipient === 'player'
            ? (sanctionTeam === 'home' ? Math.floor(Math.random() * 6) + 1 : Math.floor(Math.random() * 6) + 11)
            : undefined;
          store.recordSanction(sanctionTeam, sType, playerNum, recipient);
          sanctionsDone[sanctionTeam]++;
        }

        store.awardPoint(team);
      }
    }

    navigate('/scoring');
  }

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

    const demoStore = useMatchStore.getState();
    demoStore.createMatch(homeTeam, awayTeam, { bestOf: 3 }, {
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
      workTeam: 'WT1',
      region: 'SC',
    });

    const homeLineup: Lineup = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
    const awayLineup: Lineup = { 1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16 };

    demoStore.setLineup(0, 'home', homeLineup);
    demoStore.setLineup(0, 'away', awayLineup);
    demoStore.setFirstServe(0, 'home');

    navigate('/lineup/0');
  }
}
