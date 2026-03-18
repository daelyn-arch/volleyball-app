import type { SetSummary, MatchState, RotationState, TeamSide } from '@/types/match';
import { getCurrentRotation, getSubCount } from '@/store/derived';

interface Props {
  summary: SetSummary;
  state: MatchState;
}

export default function ScoresheetSet({ summary, state }: Props) {
  const { setIndex, homeScore, awayScore, winner } = summary;
  const setData = state.sets[setIndex];
  const maxPoints = Math.max(homeScore, awayScore, 25);

  // Get current rotation for active (non-completed) set
  const isActiveSet = setIndex === state.currentSetIndex && !winner;
  const rotation = isActiveSet ? getCurrentRotation(state, setIndex) : null;

  return (
    <div className="mb-8 rounded-lg p-[2px] overflow-hidden" style={{ background: 'linear-gradient(to right, #2563eb 50%, #b91c1c 50%)' }}>
    <div className="rounded-lg overflow-hidden bg-slate-900">
      {/* Set Header */}
      <div className="bg-slate-800 px-4 py-2 border-b border-slate-600">
        <div className="font-bold text-lg whitespace-nowrap">
          Set {setIndex + 1}
          {setData?.firstServe && (
            <span className="ml-2 text-lg font-normal text-slate-400">
              ({setData.firstServe === 'home' ? state.homeTeam.name : state.awayTeam.name} served first)
            </span>
          )}
        </div>
      </div>

      {/* Lineups */}
      <div className="grid grid-cols-2 border-b border-slate-600">
        <LineupColumn
          teamName={state.homeTeam.name}
          lineup={setData?.homeLineup}
          firstServe={setData?.firstServe === 'home'}
          bg="bg-blue-900/30"
          currentServerNumber={rotation?.servingTeam === 'home' ? rotation.serverNumber : undefined}
          currentLineup={rotation?.homeLineup}
        />
        <LineupColumn
          teamName={state.awayTeam.name}
          lineup={setData?.awayLineup}
          firstServe={setData?.firstServe === 'away'}
          bg="bg-red-900/30"
          currentServerNumber={rotation?.servingTeam === 'away' ? rotation.serverNumber : undefined}
          currentLineup={rotation?.awayLineup}
        />
      </div>

      {/* Current & Next Server */}
      {rotation && (
        <div className="grid grid-cols-2 border-b border-slate-600">
          <ServerInfoCard
            team="home"
            rotation={rotation}
            teamName={state.homeTeam.name}
            bg="bg-blue-900/30"
            accentBg="bg-blue-700"
          />
          <ServerInfoCard
            team="away"
            rotation={rotation}
            teamName={state.awayTeam.name}
            bg="bg-red-900/30"
            accentBg="bg-red-700"
          />
        </div>
      )}

      {/* Running Score */}
      <div className="border-b border-slate-600">
        <div className="px-4 py-1 bg-slate-700 text-lg font-bold border-b border-slate-600">
          Running Score
        </div>
        <div className="grid grid-cols-2">
          <RunningScoreColumn
            entries={summary.homeRunningScore}
            maxPoints={maxPoints}
            teamName={state.homeTeam.name}
            bg="bg-blue-900/30"
            scoredBg="bg-blue-700"
            unscoredBg="bg-slate-800"
          />
          <RunningScoreColumn
            entries={summary.awayRunningScore}
            maxPoints={maxPoints}
            teamName={state.awayTeam.name}
            bg="bg-red-900/30"
            scoredBg="bg-red-700"
            unscoredBg="bg-slate-800"
          />
        </div>
      </div>

      {/* Service Rounds */}
      <div className="border-b border-slate-600">
        <div className="px-4 py-1 bg-slate-700 text-lg font-bold border-b border-slate-600">
          Service Rounds
        </div>
        <div className="grid grid-cols-2">
          <ServiceRoundsColumn rounds={summary.homeServiceRounds} bg="bg-blue-900/30" boxBg="bg-blue-700" />
          <ServiceRoundsColumn rounds={summary.awayServiceRounds} bg="bg-red-900/30" boxBg="bg-red-700" />
        </div>
      </div>

      {/* Substitutions */}
      <div className="border-b border-slate-600">
        <div className="px-4 py-1 bg-slate-700 text-lg font-bold border-b border-slate-600">
          Substitutions
          {isActiveSet && (
            <span className="ml-2 font-normal text-slate-400">
              ({state.config.maxSubsPerSet - getSubCount(state.events, setIndex, 'home')} / {state.config.maxSubsPerSet - getSubCount(state.events, setIndex, 'away')} remaining)
            </span>
          )}
        </div>
        <div className="grid grid-cols-2">
          <SubsColumn subs={summary.homeSubstitutions} bg="bg-blue-900/30" boxBg="bg-blue-700" subsRemaining={isActiveSet ? state.config.maxSubsPerSet - getSubCount(state.events, setIndex, 'home') : undefined} />
          <SubsColumn subs={summary.awaySubstitutions} bg="bg-red-900/30" boxBg="bg-red-700" subsRemaining={isActiveSet ? state.config.maxSubsPerSet - getSubCount(state.events, setIndex, 'away') : undefined} />
        </div>
      </div>

      {/* Timeouts */}
      <div>
        <div className="px-4 py-1 bg-slate-700 text-lg font-bold border-b border-slate-600">
          Timeouts
        </div>
        <div className="grid grid-cols-2">
          <TimeoutsColumn timeouts={summary.homeTimeouts} bg="bg-blue-900/30" boxBg="bg-blue-700" />
          <TimeoutsColumn timeouts={summary.awayTimeouts} bg="bg-red-900/30" boxBg="bg-red-700" />
        </div>
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
  currentServerNumber,
  currentLineup,
}: {
  teamName: string;
  lineup: Record<number, number> | null;
  firstServe: boolean;
  bg: string;
  currentServerNumber?: number;
  currentLineup?: Record<number, number>;
}) {
  const positions = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  // If we have current rotation data, use it to show current positions
  const displayLineup = currentLineup || lineup;
  return (
    <div className={`${bg} p-3 border-r border-slate-600 min-w-0`}>
      <div className="font-bold text-lg mb-1 truncate">
        {teamName}
      </div>
      {displayLineup ? (
        <div className="grid grid-cols-6 gap-1 text-center text-base">
          {positions.map((label, i) => {
            const playerNum = displayLineup[(i + 1) as keyof typeof displayLineup];
            const isServer = currentServerNumber !== undefined && playerNum === currentServerNumber && i === 0;
            return (
              <div key={label}>
                <div className="text-slate-400">{label}</div>
                <div className={`font-bold text-base ${isServer ? 'border-2 border-yellow-400 rounded bg-yellow-400/10' : ''}`}>
                  {playerNum}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-slate-500 text-base">No lineup</div>
      )}
    </div>
  );
}

function ServerInfoCard({
  team,
  rotation,
  teamName,
  bg,
  accentBg,
}: {
  team: TeamSide;
  rotation: RotationState;
  teamName: string;
  bg: string;
  accentBg: string;
}) {
  const isServing = rotation.servingTeam === team;
  const lineup = team === 'home' ? rotation.homeLineup : rotation.awayLineup;
  const currentServer = lineup[1]; // Position I
  const nextServer = lineup[2]; // Position II (rotates into I on next rotation)

  return (
    <div className={`${bg} px-3 py-2 border-r border-slate-600`}>
      {isServing ? (
        <div className="flex items-center gap-2">
          <div className={`${accentBg} border-2 border-yellow-400 rounded px-2 py-1 text-center`}>
            <div className="text-[10px] text-yellow-300 font-bold leading-none">SERVING</div>
            <div className="text-lg font-bold leading-tight">#{currentServer}</div>
          </div>
          <div className="text-slate-400 text-base">
            Next: <span className="text-white font-bold">#{nextServer}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col justify-center h-full">
          <div className="text-slate-400 text-base">Receiving</div>
          <div className="text-slate-400 text-base">
            Next server: <span className="text-white font-bold">#{currentServer}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function RunningScoreColumn({
  entries,
  maxPoints,
  teamName,
  bg,
  scoredBg,
  unscoredBg,
}: {
  entries: Array<{ point: number; serverNumber: number }>;
  maxPoints: number;
  teamName: string;
  bg: string;
  scoredBg: string;
  unscoredBg: string;
}) {
  const pointMap = new Map(entries.map((e) => [e.point, e.serverNumber]));
  const points = Array.from({ length: maxPoints }, (_, i) => i + 1);

  return (
    <div className={`${bg} p-2 border-r border-slate-600`}>
      <div className="flex flex-wrap justify-center gap-0">
        {points.map((p) => {
          const server = pointMap.get(p);
          const scored = server !== undefined;
          return (
            <div
              key={p}
              className={`w-[32px] h-[32px] flex items-center justify-center text-base border border-slate-600 ${
                scored ? `${scoredBg} font-bold text-white` : `${unscoredBg} text-slate-500`
              }`}
              title={scored ? `Point ${p} - Server #${server}` : `${p}`}
            >
              {scored ? (
                <span className="flex flex-col items-center">
                  <span className="text-[8px] text-slate-300 block leading-none">{server}</span>
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
  boxBg,
}: {
  rounds: Array<{ serverNumber: number; pointsScored: number; startScore: { home: number; away: number }; endScore: { home: number; away: number } | null }>;
  bg: string;
  boxBg: string;
}) {
  return (
    <div className={`${bg} p-2 border-r border-slate-600`}>
      {rounds.length === 0 ? (
        <div className="text-slate-400 text-base">None</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {rounds.map((r, i) => (
            <div key={i} className={`${boxBg} border border-slate-500 rounded px-2 py-1 text-base text-white`}>
              <span className="font-bold">#{r.serverNumber}</span>
              <span className="text-slate-300 ml-1">
                {r.pointsScored}pt{r.pointsScored !== 1 ? 's' : ''}
              </span>
              {r.endScore && (
                <span className="text-slate-400 ml-1">
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
  boxBg,
  subsRemaining,
}: {
  subs: Array<{ playerIn: number; playerOut: number; homeScore: number; awayScore: number; subNumber: number }>;
  bg: string;
  boxBg: string;
  subsRemaining?: number;
}) {
  return (
    <div className={`${bg} p-2 border-r border-slate-600`}>
      {subsRemaining !== undefined && (
        <div className={`text-base font-bold mb-1 ${subsRemaining <= 2 ? 'text-amber-400' : 'text-slate-400'}`}>
          {subsRemaining} remaining
        </div>
      )}
      {subs.length === 0 ? (
        <div className="text-slate-400 text-base">None</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {subs.map((s) => (
            <div key={s.subNumber} className={`${boxBg} border border-slate-500 rounded px-2 py-1 text-base text-white`}>
              <span className="font-bold">#{s.subNumber}</span>: #{s.playerIn} in for #{s.playerOut}
              <span className="text-slate-300 ml-1">({s.homeScore}-{s.awayScore})</span>
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
  boxBg,
}: {
  timeouts: Array<{ homeScore: number; awayScore: number; timeoutNumber: number }>;
  bg: string;
  boxBg: string;
}) {
  return (
    <div className={`${bg} p-2 border-r border-slate-600`}>
      {timeouts.length === 0 ? (
        <div className="text-slate-400 text-base">None</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {timeouts.map((t) => (
            <div key={t.timeoutNumber} className={`${boxBg} border border-slate-500 rounded px-2 py-1 text-base text-white`}>
              T/O #{t.timeoutNumber} at {t.homeScore}-{t.awayScore}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
