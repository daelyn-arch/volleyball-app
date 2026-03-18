import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import { useMatchHistory } from '@/store/matchHistory';
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
  const sets = useMatchStore((s) => s.sets);
  const syncedAt = useMatchStore((s) => s.syncedAt);
  const triggerSync = useMatchStore((s) => s.triggerSync);
  const resetMatch = useMatchStore((s) => s.resetMatch);

  const archiveMatch = useMatchHistory((s) => s.archiveMatch);
  const historyCount = useMatchHistory((s) => s.matches.length);
  const [syncing, setSyncing] = useState(false);

  // Archive completed matches
  const fullState = useMatchStore.getState();
  useEffect(() => {
    if (matchId && matchComplete) {
      archiveMatch(fullState);
    }
  }, [matchId, matchComplete]);

  // If a match was created but lineups were never set, discard it
  const firstSetHasLineups = sets[0]?.homeLineup && sets[0]?.awayLineup;
  useEffect(() => {
    if (matchId && !firstSetHasLineups) {
      resetMatch();
    }
  }, [matchId, firstSetHasLineups, resetMatch]);

  const hasActiveMatch = matchId && !matchComplete && firstSetHasLineups;
  const hasCompletedMatch = matchId && matchComplete;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-dvh p-8 gap-8">
      <h1 className="text-4xl font-bold tracking-[0.045em]"><span className="text-blue-500">S C O R E </span><span className="text-red-500">D A S H</span></h1>
      <p className="text-slate-400 text-lg text-center max-w-md">
        USAV-compliant scorekeeping. Tap to score, auto-generate official scoresheets.
      </p>

      <div className="flex flex-col gap-4 w-full max-w-sm mx-auto">
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

        <button
          onClick={async () => {
            if (hasActiveMatch) {
              const ok = await showConfirm('End Current Match?', 'This will end the current match and start a new one.');
              if (!ok) return;
            }
            resetMatch();
            navigate('/setup');
          }}
          className="bg-blue-700 hover:bg-blue-600 text-white text-xl font-semibold py-5 px-8 rounded-xl transition-colors"
        >
          New Match
        </button>

        <button
          onClick={() => navigate('/history')}
          className="bg-slate-800 hover:bg-slate-700 border border-green-500 text-white text-xl font-semibold py-5 px-8 rounded-xl transition-colors"
        >
          Scoresheets
          {historyCount > 0 && (
            <span className="block text-sm font-normal text-slate-400 mt-1">
              {historyCount} match{historyCount !== 1 ? 'es' : ''}
            </span>
          )}
          {hasCompletedMatch && (
            syncedAt ? (
              <span className="flex items-center justify-center gap-1.5 text-green-400 text-sm font-normal mt-1">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                Saved to Cloud
              </span>
            ) : (
              <span
                onClick={(e) => { e.stopPropagation(); handleSync(); }}
                className="block text-amber-400 text-sm font-normal mt-1"
              >
                {syncing ? 'Syncing...' : 'Not synced — tap to sync'}
              </span>
            )
          )}
        </button>
      </div>
    </div>
  );
}
