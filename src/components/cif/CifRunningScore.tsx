import type { CifPointEntry } from '@/store/cifDerived';

interface Props {
  points: CifPointEntry[];
  maxPoints: number;
  homeTeamName: string;
  awayTeamName: string;
}

export default function CifRunningScore({ points, maxPoints, homeTeamName, awayTeamName }: Props) {
  const homePoints = new Map<number, CifPointEntry>();
  const awayPoints = new Map<number, CifPointEntry>();

  for (const p of points) {
    if (p.scoringTeam === 'home') homePoints.set(p.pointNumber, p);
    else awayPoints.set(p.pointNumber, p);
  }

  const lastHomePoint = homePoints.size;
  const lastAwayPoint = awayPoints.size;

  // Split into two halves if maxPoints > 25
  const mid = Math.ceil(maxPoints / 2);
  const firstHalf = Array.from({ length: mid }, (_, i) => i + 1);
  const secondHalf = Array.from({ length: maxPoints - mid }, (_, i) => mid + i + 1);

  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Running Score</div>
      <div className="flex gap-1">
        {/* First half: Home 1-mid, Away 1-mid */}
        <ScoreColumn
          label={homeTeamName}
          labelColor="text-blue-700"
          numbers={firstHalf}
          pointMap={homePoints}
          lastPoint={lastHomePoint}
        />
        <ScoreColumn
          label={awayTeamName}
          labelColor="text-red-700"
          numbers={firstHalf}
          pointMap={awayPoints}
          lastPoint={lastAwayPoint}
        />
        {secondHalf.length > 0 && (
          <>
            <div className="w-px bg-gray-300 mx-0.5" />
            <ScoreColumn
              label={homeTeamName}
              labelColor="text-blue-700"
              numbers={secondHalf}
              pointMap={homePoints}
              lastPoint={lastHomePoint}
            />
            <ScoreColumn
              label={awayTeamName}
              labelColor="text-red-700"
              numbers={secondHalf}
              pointMap={awayPoints}
              lastPoint={lastAwayPoint}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ScoreColumn({
  label,
  labelColor,
  numbers,
  pointMap,
  lastPoint,
}: {
  label: string;
  labelColor: string;
  numbers: number[];
  pointMap: Map<number, CifPointEntry>;
  lastPoint: number;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className={`text-[8px] font-bold ${labelColor} truncate max-w-[28px] mb-0.5`} title={label}>
        {label.slice(0, 3)}
      </div>
      {numbers.map((num) => {
        const entry = pointMap.get(num);
        const isLast = !!entry && num === lastPoint;
        return <PointCell key={num} number={num} entry={entry} isLast={isLast} />;
      })}
    </div>
  );
}

function PointCell({ number, entry, isLast }: { number: number; entry?: CifPointEntry; isLast?: boolean }) {
  const scored = !!entry;
  const served = entry?.wasServedPoint;
  const libero = entry?.wasLiberoServing && served;

  return (
    <div
      className={`relative w-7 h-7 flex items-center justify-center ${
        isLast ? 'bg-yellow-100 rounded' : ''
      }`}
    >
      <span className={`text-[11px] font-bold z-10 ${scored ? 'text-gray-900' : 'text-gray-300'}`}>
        {number}
      </span>
      {scored && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 28 28">
          {libero ? (
            <polygon
              points="14,3 3,25 25,25"
              fill="none"
              stroke="#0d9488"
              strokeWidth="2"
            />
          ) : served ? (
            <circle cx="14" cy="14" r="11" fill="none" stroke="#1e40af" strokeWidth="1.5" />
          ) : (
            <line x1="5" y1="23" x2="23" y2="5" stroke="#dc2626" strokeWidth="2" />
          )}
        </svg>
      )}
    </div>
  );
}
