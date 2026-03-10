import type { Lineup, TeamSide } from '@/types/match';

interface Props {
  lineup: Lineup;
  teamName: string;
  isServing: boolean;
  teamSide: TeamSide;
}

export default function RotationDisplay({ lineup, teamName, isServing, teamSide }: Props) {
  const borderColor = teamSide === 'home' ? 'border-blue-600' : 'border-red-700';
  const serveBorder = isServing ? 'ring-2 ring-yellow-400' : '';

  return (
    <div className={`${borderColor} border rounded-lg p-2 ${serveBorder}`}>
      <div className="text-xs text-slate-400 mb-1 text-center">
        {teamName} {isServing && '(Serving)'}
      </div>
      {/* Net side */}
      <div className="grid grid-cols-3 gap-1 text-center mb-1">
        <div className="text-xs text-slate-500">IV</div>
        <div className="text-xs text-slate-500">III</div>
        <div className="text-xs text-slate-500">II</div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <Cell num={lineup[4]} />
        <Cell num={lineup[3]} />
        <Cell num={lineup[2]} />
      </div>
      <div className="border-t border-slate-600 my-1" />
      <div className="grid grid-cols-3 gap-1 text-center">
        <Cell num={lineup[5]} />
        <Cell num={lineup[6]} />
        <Cell num={lineup[1]} serve={isServing} />
      </div>
      <div className="grid grid-cols-3 gap-1 text-center mt-1">
        <div className="text-xs text-slate-500">V</div>
        <div className="text-xs text-slate-500">VI</div>
        <div className="text-xs text-slate-500">I</div>
      </div>
    </div>
  );
}

function Cell({ num, serve }: { num: number; serve?: boolean }) {
  return (
    <div
      className={`bg-slate-700 rounded px-2 py-1 text-sm font-bold ${
        serve ? 'text-yellow-400 bg-slate-600' : 'text-white'
      }`}
    >
      {num}
    </div>
  );
}
