import type { SetSummary, MatchState } from '@/types/match';

interface Props {
  summary: SetSummary;
  state: MatchState;
}

export default function ScoresheetSet({ summary, state }: Props) {
  const { setIndex, homeScore, awayScore, winner } = summary;
  const setData = state.sets[setIndex];
  const maxPoints = Math.max(homeScore, awayScore, 25);

  return (
    <div className="mb-8 border-2 border-black rounded-lg overflow-hidden">
      {/* Set Header */}
      <div className="bg-gray-200 px-4 py-2 flex justify-between items-center border-b-2 border-black">
        <span className="font-bold text-lg">Set {setIndex + 1}</span>
        <span className="font-bold">
          {homeScore} - {awayScore}
          {winner && (
            <span className="ml-2 text-sm text-gray-600">
              Won by {winner === 'home' ? state.homeTeam.name : state.awayTeam.name}
            </span>
          )}
        </span>
      </div>

      {/* Lineups */}
      <div className="grid grid-cols-2 border-b border-black">
        <LineupColumn
          teamName={state.homeTeam.name}
          lineup={setData?.homeLineup}
          firstServe={setData?.firstServe === 'home'}
          bg="bg-blue-50"
        />
        <LineupColumn
          teamName={state.awayTeam.name}
          lineup={setData?.awayLineup}
          firstServe={setData?.firstServe === 'away'}
          bg="bg-red-50"
        />
      </div>

      {/* Running Score */}
      <div className="border-b border-black">
        <div className="px-4 py-1 bg-gray-100 text-sm font-bold border-b border-gray-300">
          Running Score
        </div>
        <div className="grid grid-cols-2">
          <RunningScoreColumn
            entries={summary.homeRunningScore}
            maxPoints={maxPoints}
            teamName={state.homeTeam.name}
            bg="bg-blue-50"
          />
          <RunningScoreColumn
            entries={summary.awayRunningScore}
            maxPoints={maxPoints}
            teamName={state.awayTeam.name}
            bg="bg-red-50"
          />
        </div>
      </div>

      {/* Service Rounds */}
      <div className="border-b border-black">
        <div className="px-4 py-1 bg-gray-100 text-sm font-bold border-b border-gray-300">
          Service Rounds
        </div>
        <div className="grid grid-cols-2">
          <ServiceRoundsColumn rounds={summary.homeServiceRounds} bg="bg-blue-50" />
          <ServiceRoundsColumn rounds={summary.awayServiceRounds} bg="bg-red-50" />
        </div>
      </div>

      {/* Substitutions */}
      <div className="border-b border-black">
        <div className="px-4 py-1 bg-gray-100 text-sm font-bold border-b border-gray-300">
          Substitutions
        </div>
        <div className="grid grid-cols-2">
          <SubsColumn subs={summary.homeSubstitutions} bg="bg-blue-50" />
          <SubsColumn subs={summary.awaySubstitutions} bg="bg-red-50" />
        </div>
      </div>

      {/* Timeouts */}
      <div>
        <div className="px-4 py-1 bg-gray-100 text-sm font-bold border-b border-gray-300">
          Timeouts
        </div>
        <div className="grid grid-cols-2">
          <TimeoutsColumn timeouts={summary.homeTimeouts} bg="bg-blue-50" />
          <TimeoutsColumn timeouts={summary.awayTimeouts} bg="bg-red-50" />
        </div>
      </div>
    </div>
  );
}

function LineupColumn({
  teamName,
  lineup,
  firstServe,
  bg,
}: {
  teamName: string;
  lineup: Record<number, number> | null;
  firstServe: boolean;
  bg: string;
}) {
  const positions = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  return (
    <div className={`${bg} p-3 border-r border-gray-300`}>
      <div className="font-bold text-sm mb-1">
        {teamName} {firstServe && '(First Serve)'}
      </div>
      {lineup ? (
        <div className="grid grid-cols-6 gap-1 text-center text-xs">
          {positions.map((label, i) => (
            <div key={label}>
              <div className="text-gray-500">{label}</div>
              <div className="font-bold text-base">{lineup[(i + 1) as keyof typeof lineup]}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-400 text-sm">No lineup</div>
      )}
    </div>
  );
}

function RunningScoreColumn({
  entries,
  maxPoints,
  teamName,
  bg,
}: {
  entries: Array<{ point: number; serverNumber: number }>;
  maxPoints: number;
  teamName: string;
  bg: string;
}) {
  const pointMap = new Map(entries.map((e) => [e.point, e.serverNumber]));
  const points = Array.from({ length: maxPoints }, (_, i) => i + 1);

  return (
    <div className={`${bg} p-2 border-r border-gray-300`}>
      <div className="flex flex-wrap gap-0">
        {points.map((p) => {
          const server = pointMap.get(p);
          const scored = server !== undefined;
          return (
            <div
              key={p}
              className={`w-7 h-7 flex items-center justify-center text-xs border border-gray-300 ${
                scored ? 'bg-white font-bold' : 'bg-gray-100 text-gray-300'
              }`}
              title={scored ? `Point ${p} - Server #${server}` : `${p}`}
            >
              {scored ? (
                <span>
                  <span className="text-[8px] text-gray-500 block leading-none">{server}</span>
                  <span className="leading-none">{p}</span>
                </span>
              ) : (
                p
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ServiceRoundsColumn({
  rounds,
  bg,
}: {
  rounds: Array<{ serverNumber: number; pointsScored: number; startScore: { home: number; away: number }; endScore: { home: number; away: number } | null }>;
  bg: string;
}) {
  return (
    <div className={`${bg} p-2 border-r border-gray-300`}>
      {rounds.length === 0 ? (
        <div className="text-gray-400 text-xs">None</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {rounds.map((r, i) => (
            <div key={i} className="bg-white border border-gray-300 rounded px-2 py-1 text-xs">
              <span className="font-bold">#{r.serverNumber}</span>
              <span className="text-gray-500 ml-1">
                {r.pointsScored}pt{r.pointsScored !== 1 ? 's' : ''}
              </span>
              {r.endScore && (
                <span className="text-gray-400 ml-1">
                  ({r.endScore.home}-{r.endScore.away})
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubsColumn({
  subs,
  bg,
}: {
  subs: Array<{ playerIn: number; playerOut: number; homeScore: number; awayScore: number; subNumber: number }>;
  bg: string;
}) {
  return (
    <div className={`${bg} p-2 border-r border-gray-300`}>
      {subs.length === 0 ? (
        <div className="text-gray-400 text-xs">None</div>
      ) : (
        <div className="space-y-1">
          {subs.map((s) => (
            <div key={s.subNumber} className="text-xs">
              <span className="font-bold">#{s.subNumber}</span>: #{s.playerIn} in for #{s.playerOut}
              <span className="text-gray-500 ml-1">({s.homeScore}-{s.awayScore})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimeoutsColumn({
  timeouts,
  bg,
}: {
  timeouts: Array<{ homeScore: number; awayScore: number; timeoutNumber: number }>;
  bg: string;
}) {
  return (
    <div className={`${bg} p-2 border-r border-gray-300`}>
      {timeouts.length === 0 ? (
        <div className="text-gray-400 text-xs">None</div>
      ) : (
        <div className="space-y-1">
          {timeouts.map((t) => (
            <div key={t.timeoutNumber} className="text-xs">
              T/O #{t.timeoutNumber} at {t.homeScore}-{t.awayScore}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
