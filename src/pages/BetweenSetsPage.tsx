import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import { getSetsWon } from '@/store/derived';

export default function BetweenSetsPage() {
  const navigate = useNavigate();
  const state = useMatchStore();
  const { currentSetIndex, homeTeam, awayTeam } = state;
  const setsWon = getSetsWon(state);

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8 gap-6">
      <h1 className="text-3xl font-bold text-white">Between Sets</h1>
      <div className="text-xl text-slate-300">
        Sets: {homeTeam.name} {setsWon.home} - {setsWon.away} {awayTeam.name}
      </div>
      <p className="text-slate-400">
        Set {currentSetIndex + 1} is next. Enter new lineups.
      </p>
      <button
        onClick={() => navigate(`/lineup/${currentSetIndex}`)}
        className="bg-green-600 hover:bg-green-700 text-white text-xl font-semibold px-8 py-4 rounded-xl transition-colors"
      >
        Enter Lineups for Set {currentSetIndex + 1}
      </button>
    </div>
  );
}
