import type { SubstitutionRecord, TimeoutRecord } from '@/types/match';

interface Props {
  substitutions: SubstitutionRecord[];
  timeouts: TimeoutRecord[];
  maxSubs: number;
  side: 'home' | 'away';
}

export default function CifSubsTimeouts({ substitutions, timeouts, maxSubs, side }: Props) {
  const isHome = side === 'home';
  const borderColor = isHome ? 'border-blue-300' : 'border-red-300';

  return (
    <div className="flex flex-col gap-1">
      {/* Timeouts */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-bold text-gray-500 w-6 shrink-0">T/O</span>
        {[1, 2].map((n) => {
          const to = timeouts.find(t => t.timeoutNumber === n);
          return (
            <div
              key={n}
              className={`w-12 h-6 border ${borderColor} rounded text-[10px] font-bold flex items-center justify-center ${
                to ? 'bg-orange-50 text-orange-700' : 'text-gray-300'
              }`}
            >
              {to ? `${to.homeScore}-${to.awayScore}` : n}
            </div>
          );
        })}
      </div>

      {/* Substitutions */}
      <div>
        <div className="text-[10px] font-bold text-gray-500 mb-0.5">SUBS ({substitutions.length}/{maxSubs})</div>
        <div className="grid grid-cols-3 gap-px">
          {Array.from({ length: Math.min(maxSubs, 18) }, (_, i) => {
            const sub = substitutions[i];
            return (
              <div
                key={i}
                className={`h-5 border ${borderColor} rounded text-[9px] flex items-center justify-center ${
                  sub ? 'bg-purple-50 text-purple-800 font-bold' : 'text-gray-200'
                }`}
              >
                {sub ? `${sub.playerIn}/${sub.playerOut}` : i + 1}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
