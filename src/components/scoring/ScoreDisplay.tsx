import type { TeamSide } from '@/types/match';

interface Props {
  score: number;
  teamSide: TeamSide;
}

export default function ScoreDisplay({ score, teamSide }: Props) {
  const bgColor = teamSide === 'home' ? 'bg-blue-900' : 'bg-red-900';
  const borderColor = teamSide === 'home' ? 'border-blue-500' : 'border-red-500';

  return (
    <div
      className={`${bgColor} ${borderColor} border-2 rounded-2xl px-8 py-4 min-w-[120px] flex items-center justify-center`}
    >
      <span className="text-6xl font-bold text-white tabular-nums">{score}</span>
    </div>
  );
}
