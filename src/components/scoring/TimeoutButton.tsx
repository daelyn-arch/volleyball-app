import { useMatchStore } from '@/store/matchStore';
import type { TeamSide } from '@/types/match';

interface Props {
  team: TeamSide;
  count: number;
  max: number;
  disabled: boolean;
}

export default function TimeoutButton({ team, count, max, disabled }: Props) {
  const recordTimeout = useMatchStore((s) => s.recordTimeout);

  function handleClick() {
    const error = recordTimeout(team);
    if (error) {
      alert(error);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || count >= max}
      className="flex items-center gap-1 bg-slate-700/80 hover:bg-slate-600 disabled:opacity-40 text-white text-xs font-semibold px-2 py-1 rounded-md transition-colors touch-manipulation"
    >
      <span>T/O</span>
      <span className="flex flex-col gap-0.5">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            style={{ width: '5px', height: '5px' }}
            className={`block rounded-full ${
              i < count ? 'bg-slate-500' : 'bg-yellow-400'
            }`}
          />
        ))}
      </span>
    </button>
  );
}
