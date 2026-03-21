import type { CourtPosition, Lineup } from '@/types/match';
import type { CifServiceTerm } from '@/store/cifDerived';
import CifIndividualRow from './CifIndividualRow';

interface Props {
  teamName: string;
  side: 'home' | 'away';
  startingLineup: Lineup | null;
  positionRows: Record<CourtPosition, CifServiceTerm[]>;
  isServingFirst: boolean;
}

export default function CifTeamSection({ teamName, side, startingLineup, positionRows, isServingFirst }: Props) {
  const isHome = side === 'home';
  const headerBg = isHome ? 'bg-blue-700' : 'bg-red-700';

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className={`${headerBg} text-white text-xs font-bold px-2 py-1 rounded-t flex items-center justify-between`}>
        <span className="truncate">{teamName}</span>
        {isServingFirst && (
          <span className="text-yellow-300 text-[10px] ml-1 shrink-0">1st Serve</span>
        )}
      </div>

      {/* Individual scoring rows */}
      <div className="bg-white border border-gray-300 border-t-0 rounded-b">
        {([1, 2, 3, 4, 5, 6] as CourtPosition[]).map((pos) => (
          <CifIndividualRow
            key={pos}
            position={pos}
            terms={positionRows[pos]}
            startingPlayer={startingLineup ? startingLineup[pos] : 0}
          />
        ))}
      </div>
    </div>
  );
}
