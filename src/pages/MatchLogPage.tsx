import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import EventLog from '@/components/scoring/EventLog';

export default function MatchLogPage() {
  const navigate = useNavigate();
  const { events, currentSetIndex, homeTeam, awayTeam } = useMatchStore();

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between gap-2">
        <button
          onClick={() => navigate(-1)}
          className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap shrink-0"
        >
          Back
        </button>
        <h1 className="text-xl font-bold whitespace-nowrap">Match Log</h1>
      </div>

      {/* Full-height scrollable log */}
      <div className="flex-1 overflow-y-auto">
        <EventLog events={events} setIndex={currentSetIndex} homeTeam={homeTeam} awayTeam={awayTeam} />
      </div>
    </div>
  );
}
