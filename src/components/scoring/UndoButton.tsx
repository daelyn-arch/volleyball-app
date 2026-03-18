import { useState } from 'react';
import type { MatchEvent } from '@/types/match';

interface Props {
  onUndo: () => void;
  disabled: boolean;
  lastEvent?: MatchEvent;
}

function getEventLabel(event: MatchEvent): string {
  switch (event.type) {
    case 'point':
      return `Point (${event.scoringTeam === 'home' ? 'left' : 'right'} side, ${event.homeScore}-${event.awayScore})`;
    case 'substitution':
      return `Substitution (#${event.playerIn} in for #${event.playerOut})`;
    case 'timeout':
      return `Timeout (${event.team === 'home' ? 'left' : 'right'} side, #${event.timeoutNumber})`;
    case 'liberoReplacement':
      return event.isLiberoEntering
        ? `Libero In (#${event.liberoNumber} for #${event.replacedPlayer})`
        : `Libero Out (#${event.replacedPlayer} for #${event.liberoNumber})`;
    case 'sanction': {
      const labels: Record<string, string> = {
        'warning': 'Yellow Card',
        'penalty': 'Red Card',
        'delay-warning': 'Delay Warning',
        'delay-penalty': 'Delay Penalty',
        'expulsion': 'Expulsion',
        'disqualification': 'Disqualification',
      };
      return `${labels[event.sanctionType] || event.sanctionType}${event.playerNumber ? ` #${event.playerNumber}` : ''}`;
    }
    default:
      return 'Action';
  }
}

export default function UndoButton({ onUndo, disabled, lastEvent }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);

  function handleClick() {
    setShowConfirm(true);
  }

  function handleConfirm() {
    setShowConfirm(false);
    onUndo();
  }

  function handleCancel() {
    setShowConfirm(false);
  }

  const label = lastEvent ? getEventLabel(lastEvent) : 'Action';

  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled}
        className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[14px] font-bold rounded-md transition-colors touch-manipulation"
        style={{ width: 60, height: 30 }}
      >
        Undo
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm border border-slate-600">
            <h3 className="text-lg font-bold text-white mb-2 text-center">Undo {label}?</h3>
            <p className="text-slate-400 text-sm text-center mb-4">This cannot be redone.</p>
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                Undo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
