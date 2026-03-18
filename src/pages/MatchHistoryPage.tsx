import { useNavigate } from 'react-router-dom';
import { useMatchHistory } from '@/store/matchHistory';
import { useMatchStore } from '@/store/matchStore';
import { getSetsWon, getSetScore } from '@/store/derived';
import type { MatchState } from '@/types/match';

export default function MatchHistoryPage() {
  const navigate = useNavigate();
  const { matches, deleteMatch } = useMatchHistory();
  const loadMatch = useMatchStore((s) => s.loadMatch);
  const handleView = (state: MatchState) => {
    loadMatch(state);
    navigate('/scoresheet');
  };

  return (
    <div className="min-h-full">
      <div className="bg-slate-800 px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => navigate('/')}
          className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-lg font-bold transition-colors"
        >
          &larr;
        </button>
        <h1 className="text-white text-lg font-bold">Scoresheets</h1>
      </div>

      <div className="p-4 space-y-3">
        {matches.length === 0 && (
          <p className="text-slate-400 text-center py-12">
            No scoresheets yet. Completed matches will appear here.
          </p>
        )}

        {matches.map((entry) => {
          const setsWon = getSetsWon(entry.state);
          const setScores: string[] = [];
          for (let i = 0; i <= entry.state.currentSetIndex; i++) {
            const s = getSetScore(entry.state.events, i);
            setScores.push(`${s.home}-${s.away}`);
          }
          const date = new Date(entry.createdAt);
          const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          const timeStr = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          });

          return (
            <div
              key={entry.id}
              className="bg-slate-800 border border-slate-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">{dateStr} {timeStr}</span>
                <span className="text-sm font-bold text-slate-200">
                  {setsWon.home}-{setsWon.away}
                </span>
              </div>
              <div className="text-white font-semibold mb-2">
                {entry.homeTeamName} vs {entry.awayTeamName}
              </div>
              <div className="flex gap-2 mb-3">
                {setScores.map((score, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-300"
                  >
                    {score}
                  </span>
                ))}
              </div>
              <button
                onClick={() => handleView(entry.state)}
                className="w-full bg-green-700 hover:bg-green-600 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                View Scoresheet
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
