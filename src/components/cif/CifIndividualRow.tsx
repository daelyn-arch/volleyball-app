import type { CifServiceTerm } from '@/store/cifDerived';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

interface Props {
  position: number; // 1-6
  terms: CifServiceTerm[];
  startingPlayer: number;
}

export default function CifIndividualRow({ position, terms, startingPlayer }: Props) {
  return (
    <div className="flex items-center h-8 border-b border-gray-200 min-w-0">
      {/* Position label */}
      <div className="w-7 text-center text-[11px] font-bold text-gray-500 shrink-0">
        {ROMAN[position - 1]}
      </div>
      {/* Starting player */}
      <div className="w-8 text-center text-[12px] font-bold text-gray-900 shrink-0 border-r border-gray-300 pr-1">
        {startingPlayer}
      </div>
      {/* Service terms */}
      <div className="flex items-center gap-0.5 overflow-x-auto min-w-0 px-1">
        {terms.map((term, i) => (
          <TermBlock
            key={i}
            term={term}
            isActive={i === terms.length - 1 && term.exitScore === null}
          />
        ))}
        {terms.length === 0 && (
          <span className="text-[10px] text-gray-300 px-1">&mdash;</span>
        )}
      </div>
    </div>
  );
}

function TermBlock({ term, isActive }: { term: CifServiceTerm; isActive: boolean }) {
  return (
    <div
      className={`flex items-center gap-px px-1 rounded text-[10px] shrink-0 ${
        isActive
          ? 'bg-yellow-50 border border-yellow-300'
          : 'bg-gray-50 border border-gray-200'
      }`}
    >
      {/* Inline events before points */}
      {term.inlineEvents.map((ev, i) => (
        <span
          key={i}
          className={`font-bold ${
            ev.type === 'timeout' ? 'text-orange-600' : 'text-purple-600'
          }`}
        >
          {ev.type === 'timeout' ? (ev.forServingTeam ? 'T' : 'Tx') : ev.forServingTeam ? 'S' : 'Sx'}
        </span>
      ))}
      {/* Points scored during this term (circled numbers) */}
      {term.servedPoints.map((pt) => (
        <span
          key={pt}
          className="inline-flex items-center justify-center w-[16px] h-[16px] rounded-full border border-gray-500 text-[9px] font-bold text-gray-900 bg-white"
        >
          {pt}
        </span>
      ))}
      {/* Exit score */}
      {term.exitScore !== null ? (
        <span className="font-bold text-red-700 border-l border-gray-300 pl-0.5 ml-0.5">
          {term.exitScore}
        </span>
      ) : isActive ? (
        <span className="text-yellow-600 ml-0.5">&#9654;</span>
      ) : null}
    </div>
  );
}
