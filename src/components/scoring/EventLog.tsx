import type { MatchEvent, Team } from '@/types/match';
import { getSetEvents } from '@/store/derived';

interface Props {
  events: MatchEvent[];
  setIndex: number;
  homeTeam: Team;
  awayTeam: Team;
}

export default function EventLog({ events, setIndex, homeTeam, awayTeam }: Props) {
  const setEvents = getSetEvents(events, setIndex).slice(-8).reverse();

  if (setEvents.length === 0) {
    return (
      <div className="bg-slate-900 border-t border-slate-700 px-4 py-2 text-slate-500 text-sm text-center shrink-0">
        No events yet
      </div>
    );
  }

  function getTeamName(team: 'home' | 'away') {
    return team === 'home' ? homeTeam.name : awayTeam.name;
  }

  function formatEvent(e: MatchEvent): string {
    switch (e.type) {
      case 'point':
        return `Point ${getTeamName(e.scoringTeam)} (${e.homeScore}-${e.awayScore}) | Server #${e.serverNumber}`;
      case 'substitution':
        return `Sub ${getTeamName(e.team)}: #${e.playerIn} in for #${e.playerOut} (${e.homeScore}-${e.awayScore})`;
      case 'timeout':
        return `Timeout ${getTeamName(e.team)} #${e.timeoutNumber} (${e.homeScore}-${e.awayScore})`;
      case 'liberoReplacement':
        return e.isLiberoEntering
          ? `Libero #${e.liberoNumber} in for #${e.replacedPlayer} (${getTeamName(e.team)})`
          : `Libero #${e.liberoNumber} out, #${e.replacedPlayer} back (${getTeamName(e.team)})`;
      case 'sanction':
        return `${e.sanctionType} - ${getTeamName(e.team)}${e.playerNumber ? ` #${e.playerNumber}` : ''}`;
      default:
        return 'Unknown event';
    }
  }

  function getEventColor(e: MatchEvent): string {
    switch (e.type) {
      case 'point':
        return e.scoringTeam === 'home' ? 'text-blue-300' : 'text-red-300';
      case 'substitution':
        return 'text-indigo-300';
      case 'timeout':
        return 'text-amber-300';
      case 'liberoReplacement':
        return 'text-teal-300';
      case 'sanction':
        return 'text-orange-300';
      default:
        return 'text-slate-300';
    }
  }

  return (
    <div className="bg-slate-900 border-t border-slate-700 px-4 py-2 shrink-0 max-h-40 overflow-y-auto">
      <div className="text-xs text-slate-500 mb-1">Event Log</div>
      {setEvents.map((e) => (
        <div key={e.id} className={`text-sm ${getEventColor(e)} py-0.5`}>
          {formatEvent(e)}
        </div>
      ))}
    </div>
  );
}
