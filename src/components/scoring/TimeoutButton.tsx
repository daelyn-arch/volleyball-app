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
      className="bg-amber-700 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
    >
      T/O ({count}/{max})
    </button>
  );
}
