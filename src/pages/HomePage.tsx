import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import { useDialog } from '@/components/ThemedDialog';

export default function HomePage() {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);
  const navigate = useNavigate();
  const { showConfirm } = useDialog();
  const matchId = useMatchStore((s) => s.id);
  const matchComplete = useMatchStore((s) => s.matchComplete);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);
  const resetMatch = useMatchStore((s) => s.resetMatch);

  const hasActiveMatch = matchId && !matchComplete;
  const hasCompletedMatch = matchId && matchComplete;

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-8 gap-8">
      <h1 className="text-4xl font-bold text-white">Volleyball Scorekeeper</h1>
      <p className="text-slate-400 text-lg text-center max-w-md">
        USAV-compliant scorekeeping. Tap to score, auto-generate official scoresheets.
      </p>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        {hasActiveMatch && (
          <button
            onClick={() => navigate('/scoring')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold py-5 px-8 rounded-xl transition-colors"
          >
            Resume Match
            <span className="block text-sm font-normal text-blue-200 mt-1">
              {homeTeam.name} vs {awayTeam.name}
            </span>
          </button>
        )}

        {hasCompletedMatch && (
          <button
            onClick={() => navigate('/scoresheet')}
            className="bg-green-700 hover:bg-green-800 text-white text-xl font-semibold py-5 px-8 rounded-xl transition-colors"
          >
            View Scoresheet
            <span className="block text-sm font-normal text-green-200 mt-1">
              {homeTeam.name} vs {awayTeam.name}
            </span>
          </button>
        )}

        <button
          onClick={async () => {
            if (hasActiveMatch) {
              const ok = await showConfirm('End Current Match?', 'This will end the current match and start a new one.');
              if (!ok) return;
            }
            resetMatch();
            navigate('/setup');
          }}
          className="bg-slate-700 hover:bg-slate-600 text-white text-xl font-semibold py-5 px-8 rounded-xl transition-colors"
        >
          New Match
        </button>
      </div>
    </div>
  );
}
