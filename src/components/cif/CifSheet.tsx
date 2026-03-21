import { useMemo } from 'react';
import type { MatchState } from '@/types/match';
import { getCifSetData } from '@/store/cifDerived';
import CifRunningScore from './CifRunningScore';
import CifTeamSection from './CifTeamSection';
import CifSubsTimeouts from './CifSubsTimeouts';
import CifScoringKeys from './CifScoringKeys';

interface Props {
  state: MatchState;
  setIndex: number;
}

export default function CifSheet({ state, setIndex }: Props) {
  const cifData = useMemo(
    () => getCifSetData(state, setIndex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.events.length, setIndex]
  );

  const isDecidingSet = setIndex === state.config.bestOf - 1;
  const maxPoints = isDecidingSet ? state.config.decidingSetPoints : state.config.pointsToWin;
  // Extend if score exceeds standard max (deuce)
  const actualMax = Math.max(
    maxPoints,
    ...cifData.points
      .filter(p => p.scoringTeam === 'home')
      .map(p => p.pointNumber),
    ...cifData.points
      .filter(p => p.scoringTeam === 'away')
      .map(p => p.pointNumber),
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-3 inline-block" style={{ minWidth: 900 }}>
      {/* Set header */}
      <div className="text-center text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-1">
        SET {setIndex + 1}
      </div>

      {/* Grid layout — top and bottom rows share column widths */}
      <div className="grid gap-x-3 gap-y-0 items-start" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
        {/* Row 1: Team sections + running score */}
        <CifTeamSection
          teamName={state.homeTeam.name}
          side="home"
          startingLineup={cifData.homeStartingLineup}
          positionRows={cifData.homePositionRows}
          isServingFirst={cifData.firstServe === 'home'}
        />
        <CifRunningScore
          points={cifData.points}
          maxPoints={actualMax}
          homeTeamName={state.homeTeam.name}
          awayTeamName={state.awayTeam.name}
        />
        <CifTeamSection
          teamName={state.awayTeam.name}
          side="away"
          startingLineup={cifData.awayStartingLineup}
          positionRows={cifData.awayPositionRows}
          isServingFirst={cifData.firstServe === 'away'}
        />

        {/* Row 2: Subs/timeouts + legend */}
        <div className="pt-2 mt-3 border-t border-gray-200">
          <CifSubsTimeouts
            substitutions={cifData.homeSubstitutions}
            timeouts={cifData.homeTimeouts}
            maxSubs={state.config.maxSubsPerSet}
            side="home"
          />
        </div>
        <div className="pt-2 mt-3 border-t border-gray-200">
          <CifScoringKeys />
        </div>
        <div className="pt-2 mt-3 border-t border-gray-200">
          <CifSubsTimeouts
            substitutions={cifData.awaySubstitutions}
            timeouts={cifData.awayTimeouts}
            maxSubs={state.config.maxSubsPerSet}
            side="away"
          />
        </div>
      </div>
    </div>
  );
}
