import { useRef, useEffect, useState } from 'react';
import type { MatchEvent, Team } from '@/types/match';
import { getSetEvents } from '@/store/derived';
import { useMatchStore } from '@/store/matchStore';

interface Props {
  events: MatchEvent[];
  setIndex: number;
  homeTeam: Team;
  awayTeam: Team;
  actions?: React.ReactNode;
  setCompleteMessage?: string;
}

const SHORT_NAME_THRESHOLD = 6;

export default function EventLog({ events, setIndex, homeTeam, awayTeam, actions, setCompleteMessage }: Props) {
  const allSetEvents = getSetEvents(events, setIndex);
  const totalCount = allSetEvents.length;
  const setEvents = [...allSetEvents].reverse();
  const undo = useMatchStore((s) => s.undo);
  const containerRef = useRef<HTMLDivElement>(null);
  const [useShortNames, setUseShortNames] = useState(false);

  // Check if names are long enough to likely cause wrapping
  useEffect(() => {
    const longest = Math.max(homeTeam.name.length, awayTeam.name.length);
    setUseShortNames(longest > SHORT_NAME_THRESHOLD);
  }, [homeTeam.name, awayTeam.name]);

  if (setEvents.length === 0) {
    return (
      <div className="bg-slate-900 border-t border-slate-900 shrink-0">
        {actions && <div className="px-4 py-2">{actions}</div>}
        <div className="text-slate-500 text-sm text-center pb-2">No events yet</div>
      </div>
    );
  }

  function getTeamName(team: 'home' | 'away') {
    if (useShortNames) return team === 'home' ? 'Left Team' : 'Right Team';
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
        return <><span className="text-orange-400">Sub</span> <span className={teamColor(e.team)}>{getTeamName(e.team)}</span>: <span className="text-orange-400">#{e.playerIn}</span> in for <span className="text-orange-400">#{e.playerOut}</span> <span className="text-blue-300">({e.homeScore}</span>-<span className="text-red-300">{e.awayScore})</span></>;
      case 'timeout':
        return <>Timeout <span className={teamColor(e.team)}>{getTeamName(e.team)}</span> <span className={teamColor(e.team)}>#{e.timeoutNumber}</span> <span className="text-blue-300">({e.homeScore}</span>-<span className="text-red-300">{e.awayScore})</span></>;
      case 'liberoReplacement':
        if (e.isLiberoEntering) {
          return <><span className="text-teal-400">Libero</span> <span className={teamColor(e.team)}>#{e.liberoNumber}</span> in for <span className={teamColor(e.team)}>#{e.replacedPlayer}</span> <span className={teamColor(e.team)}>({getTeamName(e.team)})</span></>;
        }
        return <><span className="text-teal-400">Libero</span> <span className={teamColor(e.team)}>#{e.liberoNumber}</span> out, <span className={teamColor(e.team)}>#{e.replacedPlayer}</span> back <span className={teamColor(e.team)}>({getTeamName(e.team)})</span></>;
      case 'sanction': {
        const labels: Record<string, string> = {
          'warning': 'Yellow Card',
          'penalty': 'Red Card',
          'delay-warning': 'Delay Warning',
          'delay-penalty': 'Delay Penalty',
          'expulsion': 'Expulsion',
          'disqualification': 'Disqualification',
        };
        const label = labels[e.sanctionType] || e.sanctionType;
        return <><span className="text-yellow-400">{label}</span> <span className={teamColor(e.team)}>{getTeamName(e.team)}</span>{e.playerNumber ? <> <span className={teamColor(e.team)}>#{e.playerNumber}</span></> : ''} <span className="text-blue-300">({e.homeScore}</span>-<span className="text-red-300">{e.awayScore})</span></>;
      }
      default:
        return 'Unknown event';
    }
  }

  return (
    <div className="bg-slate-900 border-t border-slate-900 shrink-0">
      {actions && <div className="px-4 py-2">{actions}</div>}
      <div ref={containerRef} className="px-4 pb-2 max-h-[468px] overflow-y-auto">
        {setCompleteMessage && (
          <div className="text-yellow-400 text-lg font-bold py-1 text-center">
            {setCompleteMessage}
          </div>
        )}
        {setEvents.map((e, i) => (
          <div key={e.id}>
            {isLatestAutoSwap(e) && (
              <div
                onClick={() => handleKeepLiberoIn(e)}
                className="text-teal-400 text-sm cursor-pointer hover:text-teal-300 touch-manipulation pl-8 py-0.5"
              >
                (Click to Keep Libero In)
              </div>
            )}
            <div className="text-lg text-white py-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
              <span className="text-slate-500 inline-block w-6 text-right font-mono">{totalCount - i}</span><span className="text-slate-500 mx-1">|</span>{formatEvent(e)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
