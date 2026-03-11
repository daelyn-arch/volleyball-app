import type { MatchEvent, Team } from '@/types/match';
import { getSetEvents } from '@/store/derived';
import { useMatchStore } from '@/store/matchStore';

interface Props {
  events: MatchEvent[];
  setIndex: number;
  homeTeam: Team;
  awayTeam: Team;
  actions?: React.ReactNode;
}

export default function EventLog({ events, setIndex, homeTeam, awayTeam, actions }: Props) {
  const allSetEvents = getSetEvents(events, setIndex);
  const totalCount = allSetEvents.length;
  const setEvents = [...allSetEvents].reverse();
  const undo = useMatchStore((s) => s.undo);

  if (setEvents.length === 0) {
    return (
      <div className="bg-slate-900 border-t border-slate-700 px-4 py-2 shrink-0">
        {actions && <div className="mb-1">{actions}</div>}
        <div className="text-slate-500 text-sm text-center">No events yet</div>
      </div>
    );
  }

  function getTeamName(team: 'home' | 'away') {
    return team === 'home' ? homeTeam.name : awayTeam.name;
  }

  function teamColor(team: 'home' | 'away') {
    return team === 'home' ? 'text-blue-300' : 'text-red-300';
  }

  // Check if an event is the most recent auto-swap (undoable)
  function isLatestAutoSwap(e: MatchEvent): boolean {
    if (e.type !== 'liberoReplacement' || !e.autoSwap) return false;
    // It's undoable if it's the very last event in the full events array
    return events[events.length - 1]?.id === e.id;
  }

  function handleKeepLiberoIn(e: MatchEvent) {
    if (e.type === 'liberoReplacement' && e.autoSwap) {
      undo(); // Remove the auto-swap event
    }
  }

  function formatEvent(e: MatchEvent): React.ReactNode {
    switch (e.type) {
      case 'point':
        return <>Point <span className={teamColor(e.scoringTeam)}>{getTeamName(e.scoringTeam)}</span> <span className="text-blue-300">({e.homeScore}</span>-<span className="text-red-300">{e.awayScore})</span> | <span className="text-yellow-400">Server</span> <span className={teamColor(e.servingTeam)}>#{e.serverNumber}</span></>;
      case 'substitution':
        return <>Sub <span className={teamColor(e.team)}>{getTeamName(e.team)}</span>: <span className={teamColor(e.team)}>#{e.playerIn}</span> in for <span className={teamColor(e.team)}>#{e.playerOut}</span> <span className="text-blue-300">({e.homeScore}</span>-<span className="text-red-300">{e.awayScore})</span></>;
      case 'timeout':
        return <>Timeout <span className={teamColor(e.team)}>{getTeamName(e.team)}</span> <span className={teamColor(e.team)}>#{e.timeoutNumber}</span> <span className="text-blue-300">({e.homeScore}</span>-<span className="text-red-300">{e.awayScore})</span></>;
      case 'liberoReplacement':
        if (e.isLiberoEntering) {
          return <><span className="text-teal-400">Libero</span> <span className={teamColor(e.team)}>#{e.liberoNumber}</span> in for <span className={teamColor(e.team)}>#{e.replacedPlayer}</span> <span className={teamColor(e.team)}>({getTeamName(e.team)})</span></>;
        }
        return <><span className="text-teal-400">Libero</span> <span className={teamColor(e.team)}>#{e.liberoNumber}</span> out, <span className={teamColor(e.team)}>#{e.replacedPlayer}</span> back <span className={teamColor(e.team)}>({getTeamName(e.team)})</span></>;
      case 'sanction':
        return <>{e.sanctionType} - <span className={teamColor(e.team)}>{getTeamName(e.team)}</span>{e.playerNumber ? <> <span className={teamColor(e.team)}>#{e.playerNumber}</span></> : ''}</>;
      default:
        return 'Unknown event';
    }
  }

  return (
    <div className="bg-slate-900 border-t border-slate-700 px-4 py-2 shrink-0 max-h-[156px] overflow-y-auto">
      {actions && <div className="mb-1">{actions}</div>}
      {setEvents.map((e, i) => (
        <div key={e.id} className="text-lg text-white py-0.5">
          <span className="text-slate-500">{totalCount - i}</span><span className="text-slate-500 mx-1">|</span>{formatEvent(e)}
          {isLatestAutoSwap(e) && (
            <span
              onClick={() => handleKeepLiberoIn(e)}
              className="ml-2 text-teal-400 text-sm cursor-pointer hover:text-teal-300 touch-manipulation"
            >
              (Click to Keep Libero In)
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
