import { useMatchStore } from '@/store/matchStore';
import { useDialog } from '@/components/ThemedDialog';
import type { TeamSide } from '@/types/match';

interface Props {
  team: TeamSide;
  count: number;
  max: number;
  disabled: boolean;
}

export default function TimeoutButton({ team, count, max, disabled }: Props) {
  const recordTimeout = useMatchStore((s) => s.recordTimeout);
  const { showAlert } = useDialog();

  function handleClick() {
    const error = recordTimeout(team);
    if (error) {
      showAlert('Timeout Error', error);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || count >= max}
      className="flex flex-col items-center justify-center bg-slate-700/80 hover:bg-slate-600 disabled:opacity-40 text-white text-xs font-semibold rounded-md transition-colors touch-manipulation"
      style={{ width: '37px', height: '38px' }}
    >
      <span>T/O</span>
      <span className="flex flex-row gap-0.5 mt-0.5">
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
