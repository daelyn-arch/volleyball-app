import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import { getSetSummary, getSetsWon, getSetScore } from '@/store/derived';
import ScoresheetSet from '@/components/scoresheet/ScoresheetSet';
import ScoresheetPdfDownload from '@/components/scoresheet-pdf/ScoresheetPdfDownload';

export default function ScoresheetViewPage() {
  const navigate = useNavigate();
  const state = useMatchStore();
  const { homeTeam, awayTeam, config, currentSetIndex, matchComplete } = state;
  const setsWon = getSetsWon(state);

  // Determine how many sets have been played
  const setsPlayed: number[] = [];
  for (let i = 0; i <= currentSetIndex; i++) {
    const score = getSetScore(state.events, i);
    if (score.home > 0 || score.away > 0) {
      setsPlayed.push(i);
    }
  }

  return (
    <div className="min-h-full bg-white text-black">
      {/* Header */}
      <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(matchComplete ? '/' : '/scoring')}
          className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          {matchComplete ? 'Home' : 'Back to Scoring'}
        </button>
        <h1 className="text-xl font-bold">Scoresheet</h1>
        <ScoresheetPdfDownload />
      </div>

      {/* Match Header */}
      <div className="p-4 border-b-2 border-black">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="font-bold text-lg">{homeTeam.name}</span>
              <span className="text-gray-500 ml-2">(Home)</span>
            </div>
            <div className="text-2xl font-bold">
              {setsWon.home} - {setsWon.away}
            </div>
            <div>
              <span className="font-bold text-lg">{awayTeam.name}</span>
              <span className="text-gray-500 ml-2">(Away)</span>
            </div>
          </div>
          <div className="text-sm text-gray-500 text-center">
            Best of {config.bestOf} | {matchComplete ? 'Match Complete' : 'In Progress'}
          </div>
        </div>
      </div>

      {/* Sets */}
      <div className="max-w-5xl mx-auto p-4">
        {setsPlayed.map((si) => (
          <ScoresheetSet key={si} summary={getSetSummary(state, si)} state={state} />
        ))}
      </div>
    </div>
  );
}
