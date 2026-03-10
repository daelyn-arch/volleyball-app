import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import type { Team } from '@/types/match';

export default function SetupPage() {
  const navigate = useNavigate();
  const createMatch = useMatchStore((s) => s.createMatch);

  const [homeName, setHomeName] = useState('');
  const [awayName, setAwayName] = useState('');
  const [bestOf, setBestOf] = useState<3 | 5>(5);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!homeName.trim() || !awayName.trim()) {
      setError('Both team names are required');
      return;
    }

    const homeTeam: Team = { name: homeName.trim(), roster: [] };
    const awayTeam: Team = { name: awayName.trim(), roster: [] };

    createMatch(homeTeam, awayTeam, { bestOf });
    navigate('/lineup/0');
  }

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
      </form>
    </div>
  );
}
