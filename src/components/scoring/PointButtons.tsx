import type { TeamSide } from '@/types/match';

interface Props {
  teamSide: TeamSide;
  teamName: string;
  onPoint: () => void;
  disabled: boolean;
}

export default function PointButtons({ teamSide, teamName, onPoint, disabled }: Props) {
  const bgColor = teamSide === 'home'
    ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-400'
    : 'bg-red-700 hover:bg-red-600 active:bg-red-500';

  return (
    <button
      onClick={onPoint}
      disabled={disabled}
      className={`${bgColor} disabled:bg-slate-700 disabled:text-slate-500 text-white text-2xl font-bold py-5 px-10 rounded-2xl transition-colors min-h-[72px] min-w-[200px] active:scale-95 touch-manipulation`}
    >
      POINT
    </button>
  );
}
