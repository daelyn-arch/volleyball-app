import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import { useDialog } from '@/components/ThemedDialog';
import { getSetScore, getSetsWon, getCurrentRotation, getSubCount, getTimeoutCount } from '@/store/derived';
import { isSetComplete, getSetWinner } from '@/utils/scoring';
import { validateSubstitution } from '@/store/validators';
import SubstitutionDialog from '@/components/scoring/SubstitutionDialog';
import TimeoutButton from '@/components/scoring/TimeoutButton';
import UndoButton from '@/components/scoring/UndoButton';
import LiberoPanel from '@/components/scoring/LiberoPanel';
import SanctionDialog from '@/components/scoring/SanctionDialog';
import OverwriteDialog from '@/components/scoring/OverwriteDialog';
import type { Lineup, TeamSide, CourtPosition } from '@/types/match';

export default function ScoringPage() {
  const navigate = useNavigate();
  const state = useMatchStore();
  const {
    homeTeam,
    awayTeam,
    config,
    events,
    sets,
    currentSetIndex,
    matchComplete,
    awardPoint,
    decrementPoint,
    undo,
    advanceToNextSet,
    addRemark,
    recordLiberoReplacement,
    recordSubstitution,
  } = state;

  // If no lineups are set, redirect to home (e.g. app reopened mid-setup)
  const resetMatch = useMatchStore((s) => s.resetMatch);
  useEffect(() => {
    const currentSet = sets[currentSetIndex];
    if (!currentSet?.homeLineup || !currentSet?.awayLineup) {
      resetMatch();
      navigate('/', { replace: true });
    }
  }, []);

  const { showConfirm } = useDialog();
  const [showSubDialog, setShowSubDialog] = useState<{ team: TeamSide; playerOut?: number } | null>(null);
  const [showLiberoPanel, setShowLiberoPanel] = useState<'home' | 'away' | null>(null);
  const [showSanctionDialog, setShowSanctionDialog] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [subHint, setSubHint] = useState(0);
  const [dismissedHints, setDismissedHints] = useState<Set<string>>(new Set());

  const score = getSetScore(events, currentSetIndex);
  const setsWon = getSetsWon(state);
  const rotation = getCurrentRotation(state, currentSetIndex);
  const setComplete = isSetComplete(score, currentSetIndex, config);
  const setWinner = getSetWinner(score, currentSetIndex, config);

  // Deciding set side switch notification
  const switchScore = sets[currentSetIndex]?.sidesSwitchedAtScore;
  const justSwitched = switchScore && score.home === switchScore.home && score.away === switchScore.away && !setComplete;

  const homeSubCount = getSubCount(events, currentSetIndex, 'home');
  const awaySubCount = getSubCount(events, currentSetIndex, 'away');
  const homeTimeoutCount = getTimeoutCount(events, currentSetIndex, 'home');
  const awayTimeoutCount = getTimeoutCount(events, currentSetIndex, 'away');

  const hasLiberoHome = homeTeam.roster.some((p) => p.isLibero);
  const hasLiberoAway = awayTeam.roster.some((p) => p.isLibero);
  const homeLiberoNums = new Set(homeTeam.roster.filter((p) => p.isLibero).map((p) => p.number));
  const awayLiberoNums = new Set(awayTeam.roster.filter((p) => p.isLibero).map((p) => p.number));

  // Compute expelled/disqualified players in the current set (need mandatory sub)
  const expelledHome = new Set<number>();
  const expelledAway = new Set<number>();
  for (const e of events) {
    if (e.setIndex !== currentSetIndex) continue;
    if (e.type === 'sanction' && (e.sanctionType === 'expulsion' || e.sanctionType === 'disqualification') && e.sanctionRecipient === 'player' && e.playerNumber) {
      if (e.team === 'home') expelledHome.add(e.playerNumber);
      else expelledAway.add(e.playerNumber);
    }
    // If a sub replaced the expelled player, remove them from the set
    if (e.type === 'substitution') {
      if (e.team === 'home') expelledHome.delete(e.playerOut);
      else expelledAway.delete(e.playerOut);
    }
  }

  const hasExpelled = expelledHome.size > 0 || expelledAway.size > 0;

  const homeServing = rotation?.servingTeam === 'home';
  const awayServing = rotation?.servingTeam === 'away';

  // Detect if a libero should swap in for the server
  const liberoSwapHint = (() => {
    if (!rotation || setComplete) return null;
    const servingTeam = rotation.servingTeam;
    const lineup = servingTeam === 'home' ? rotation.homeLineup : rotation.awayLineup;
    const serverNum = lineup[1]; // position I = server
    const teamData = servingTeam === 'home' ? homeTeam : awayTeam;
    const liberoNums = new Set(teamData.roster.filter(p => p.isLibero).map(p => p.number));

    // If server is already a libero, no hint needed
    if (liberoNums.has(serverNum)) return null;

    // Check if there's a serving lock for this team
    const key = `${currentSetIndex}-${servingTeam}`;
    const lock = state.liberoServingPositions[key];
    if (lock && lock.replacedPlayer === serverNum) {
      // The player the libero previously served for is now at position 1
      // Check that the libero is currently off court
      const libOnCourt = Object.values(lineup).some(n => liberoNums.has(n));
      if (!libOnCourt) {
        return { team: servingTeam, liberoNumber: lock.liberoNumber, serverNumber: serverNum };
      }
    }
    return null;
  })();

  // Detect recurring substitution patterns (e.g., 6-2 setter/opposite swap)
  // Only considers subs made at rotation boundaries (before any rally points)
  // Groups subs at the same boundary so paired subs (double-sub in 6-2) show together
  const subPatternHints = (() => {
    if (!rotation || setComplete) return [];
    const hints: Array<{ team: TeamSide; playerOut: number; playerIn: number }> = [];
    const seen = new Set<string>();

    for (const team of ['home', 'away'] as TeamSide[]) {
      const lineup = team === 'home' ? rotation.homeLineup : rotation.awayLineup;
      const onCourt = new Set(Object.values(lineup));
      const teamData = team === 'home' ? homeTeam : awayTeam;
      const liberoNums = new Set(teamData.roster.filter(p => p.isLibero).map(p => p.number));

      // Count sideouts (rotations) for this team since each sub involving a player pair
      // A sideout for a team = that team scored while receiving (they rotate)
      const lastSubIndex = new Map<string, number>(); // pairKey → event index of last sub
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.setIndex !== currentSetIndex) continue;
        if (e.type === 'substitution' && e.team === team) {
          const pairKey = [e.playerIn, e.playerOut].sort().join('-');
          lastSubIndex.set(pairKey, i);
        }
      }

      // Count rotations for this team since a given event index
      function rotationsSince(eventIdx: number): number {
        let count = 0;
        for (let i = eventIdx + 1; i < events.length; i++) {
          const e = events[i];
          if (e.setIndex !== currentSetIndex) continue;
          if (e.type === 'point' && e.scoringTeam === team && e.scoringTeam !== e.servingTeam) {
            count++;
          }
        }
        return count;
      }

      // Collect all subs for this team in this set
      const teamSubs: Array<{ playerIn: number; playerOut: number; idx: number }> = [];
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.setIndex === currentSetIndex && e.type === 'substitution' && e.team === team) {
          teamSubs.push({ playerIn: e.playerIn, playerOut: e.playerOut, idx: i });
        }
      }

      for (const sub of teamSubs) {
        const pairKey = [sub.playerIn, sub.playerOut].sort().join('-');
        const lastIdx = lastSubIndex.get(pairKey) || 0;

        // Only suggest if 3+ rotations have happened for this team since the last sub of this pair
        if (rotationsSince(lastIdx) < 3) continue;

        // Case 1: playerIn is on court → suggest reverse
        if (onCourt.has(sub.playerIn) && !liberoNums.has(sub.playerIn)) {
          if (!onCourt.has(sub.playerOut) && !liberoNums.has(sub.playerOut)
            && teamData.roster.some(p => p.number === sub.playerOut)
            && validateSubstitution(state, team, sub.playerOut, sub.playerIn) === null) {
            const key = `${team}-${sub.playerIn}-${sub.playerOut}`;
            if (!seen.has(key)) {
              seen.add(key);
              hints.push({ team, playerOut: sub.playerIn, playerIn: sub.playerOut });
            }
          }
        }

        // Case 2: playerOut is on court → suggest same sub
        if (onCourt.has(sub.playerOut) && !liberoNums.has(sub.playerOut)) {
          if (!onCourt.has(sub.playerIn) && !liberoNums.has(sub.playerIn)
            && teamData.roster.some(p => p.number === sub.playerIn)
            && validateSubstitution(state, team, sub.playerIn, sub.playerOut) === null) {
            const key = `${team}-${sub.playerOut}-${sub.playerIn}`;
            if (!seen.has(key)) {
              seen.add(key);
              hints.push({ team, playerOut: sub.playerOut, playerIn: sub.playerIn });
            }
          }
        }
      }
    }

    return hints;
  })();

  // Lock body scroll on this page only
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  // Reset dismissed hints only when the actual hint patterns change
  const hintKey = subPatternHints.map(h => `${h.team}-${h.playerOut}-${h.playerIn}`).join('|');
  useEffect(() => {
    setDismissedHints(new Set());
  }, [hintKey]);

  return (
    <div data-name="scoring-page" className="h-dvh flex flex-col bg-slate-900 overflow-hidden pb-8">
      {/* Top Bar */}
      <div data-name="top-bar" className="bg-slate-900 px-4 py-[8px] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <div data-name="set-info" className="text-white text-[14px] font-bold whitespace-nowrap shrink-0">
            SET {currentSetIndex + 1}
          </div>
          {/* Sub pattern hints — landscape only, fill available space */}
          {subPatternHints.length > 0 && !hasExpelled && subHint === 0 && !setComplete && (() => {
            const all = subPatternHints.slice(0, 2);
            const anyVisible = all.some(h => !dismissedHints.has(`${h.team}-${h.playerOut}-${h.playerIn}`));
            return anyVisible && all.map((hint) => {
              const key = `${hint.team}-${hint.playerOut}-${hint.playerIn}`;
              const isDismissed = dismissedHints.has(key);
              if (isDismissed) return <div key={key} className="hidden landscape:block flex-1" style={{ height: 30 }} />;
              const isHome = hint.team === 'home';
              return (
                <div key={key} className="hidden landscape:flex flex-1 rounded-md overflow-hidden" style={{ height: 30 }}>
                  <button
                    type="button"
                    onClick={() => recordSubstitution(hint.team, hint.playerIn, hint.playerOut)}
                    className={`flex-1 flex items-center justify-center gap-1 ${isHome ? 'bg-blue-800 text-blue-200' : 'bg-red-800 text-red-200'} text-[14px] font-bold whitespace-nowrap touch-manipulation`}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    #{hint.playerIn}↔#{hint.playerOut}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissedHints(prev => new Set(prev).add(key))}
                    className="bg-slate-600 hover:bg-slate-500 text-slate-300 px-1.5 flex items-center touch-manipulation"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              );
            });
          })()}
          {/* Sub indicators — landscape only */}
          {!setComplete && !matchComplete && (
            <>
              <button type="button" onClick={() => setSubHint(n => n + 1)} className={`hidden landscape:flex shrink-0 bg-blue-700 text-white text-[14px] font-bold px-2 items-center rounded-md whitespace-nowrap`} style={{ height: 30 }}>Subs&nbsp;(<span className="text-white">{config.maxSubsPerSet - homeSubCount}</span>)</button>
              <button type="button" onClick={() => setSubHint(n => n + 1)} className={`hidden landscape:flex shrink-0 bg-red-700 text-white text-[14px] font-bold px-2 items-center rounded-md whitespace-nowrap`} style={{ height: 30 }}>Subs&nbsp;(<span className="text-white">{config.maxSubsPerSet - awaySubCount}</span>)</button>
            </>
          )}
          {/* Status messages — landscape only, in top bar */}
          <div className="hidden landscape:block min-w-0 truncate">
            {justSwitched && (
              <span className="text-amber-400 text-[14px] font-bold animate-pulse">Switch Sides! ({score.home}-{score.away})</span>
            )}
            {setComplete && !justSwitched && (
              <span className="text-yellow-400 text-[14px] font-bold">
                {matchComplete
                  ? `Match Over! ${setWinner === 'home' ? homeTeam.name : awayTeam.name} wins ${setsWon.home}-${setsWon.away}`
                  : `Set ${currentSetIndex + 1} won by ${setWinner === 'home' ? homeTeam.name : awayTeam.name} (${score.home}-${score.away})`}
              </span>
            )}
            {hasExpelled && !setComplete && (
              <span className="text-red-400 text-[14px] font-bold">Sub needed for {[...expelledHome, ...expelledAway].map(n => `#${n}`).join(', ')}</span>
            )}
            {subHint > 0 && !setComplete && !hasExpelled && (
              <span className="text-yellow-400 text-[14px] font-bold">Select a Player Number to sub</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <UndoButton onUndo={undo} disabled={events.length === 0} lastEvent={events[events.length - 1]} />
          <button
            onClick={() => {
              const note = window.prompt('Add a note to the scoresheet remarks:');
              if (note && note.trim()) {
                const score = getSetScore(events, currentSetIndex);
                addRemark(`Set ${currentSetIndex + 1} (${score.home}:${score.away}): ${note.trim()}`);
              }
            }}
            className="bg-slate-700 hover:bg-slate-600 text-white text-[14px] font-bold rounded-md transition-colors touch-manipulation"
            style={{ width: 60, height: 30 }}
          >
            Note
          </button>
          <button
            onClick={() => setShowOverwriteDialog(true)}
            className="bg-amber-700 hover:bg-amber-600 text-white text-[14px] font-bold rounded-md transition-colors touch-manipulation"
            style={{ width: 60, height: 30 }}
          >
            OVR
          </button>
          <button
            data-name="ref-btn"
            onClick={() => { setSubHint(0); setShowSanctionDialog(true); }}
            disabled={setComplete}
            className={`bg-yellow-700 hover:bg-yellow-600 text-white text-[14px] font-bold rounded-md transition-colors touch-manipulation ${setComplete ? 'opacity-40 pointer-events-none' : ''}`}
            style={{ width: 60, height: 30 }}
          >
            Card
          </button>
        </div>
      </div>

      {/* Content wrapper */}
      <div className="flex-1 flex flex-col min-h-0">

      {/* Main Area: Two Team Panels Side by Side */}
      <div data-name="panels-container" className="flex flex-1 justify-center gap-3 px-3 min-w-0 max-h-[82%]">
        {/* Home Team Panel */}
        <TeamPanel
          teamName={homeTeam.name}
          teamSide="home"
          teamScore={score.home}
          lineup={rotation?.homeLineup ?? null}
          isServing={homeServing}
          setComplete={setComplete}
          isWinner={setWinner === 'home'}
          timeoutCount={homeTimeoutCount}
          maxTimeouts={config.maxTimeoutsPerSet}
          hasLibero={hasLiberoHome}
          liberoNums={homeLiberoNums}
          expelledPlayers={expelledHome}
          pointsBlocked={hasExpelled}
          onPoint={() => { setSubHint(0); awardPoint('home'); }}
          onDecrement={() => { setSubHint(0); decrementPoint('home'); }}
          onLibero={() => { setSubHint(0); setShowLiberoPanel('home'); }}
          onSubPlayer={(playerOut) => { setSubHint(0); setShowSubDialog({ team: 'home', playerOut }); }}
          highlightSub={subHint > 0 ? 1 : undefined}
        />

        {/* Away Team Panel */}
        <TeamPanel
          teamName={awayTeam.name}
          teamSide="away"
          teamScore={score.away}
          lineup={rotation?.awayLineup ?? null}
          isServing={awayServing}
          setComplete={setComplete}
          isWinner={setWinner === 'away'}
          timeoutCount={awayTimeoutCount}
          maxTimeouts={config.maxTimeoutsPerSet}
          hasLibero={hasLiberoAway}
          liberoNums={awayLiberoNums}
          expelledPlayers={expelledAway}
          pointsBlocked={hasExpelled}
          onPoint={() => { setSubHint(0); awardPoint('away'); }}
          onDecrement={() => { setSubHint(0); decrementPoint('away'); }}
          onLibero={() => { setSubHint(0); setShowLiberoPanel('away'); }}
          onSubPlayer={(playerOut) => { setSubHint(0); setShowSubDialog({ team: 'away', playerOut }); }}
          highlightSub={subHint > 0 ? 1 : undefined}
        />
      </div>

      {/* Status messages + sub hints — portrait: fixed-height reserved space; landscape: hidden */}
      <div className="landscape:hidden shrink-0 mt-[8px] flex flex-col" style={{ height: 40 }}>
        {/* Text messages */}
        <div className="flex items-center justify-center">
          {justSwitched && (
            <span className="text-amber-400 text-lg font-bold text-center animate-pulse">
              Switch Sides! ({score.home}-{score.away})
            </span>
          )}
          {setComplete && !justSwitched && (
            <span className="text-yellow-400 text-lg font-bold text-center">
              {matchComplete
                ? `Match Over! ${setWinner === 'home' ? homeTeam.name : awayTeam.name} wins ${setsWon.home}-${setsWon.away}`
                : `Set ${currentSetIndex + 1} won by ${setWinner === 'home' ? homeTeam.name : awayTeam.name} (${score.home}-${score.away})`}
            </span>
          )}
          {hasExpelled && !setComplete && (
            <span className="text-red-400 text-sm font-bold text-center">
              A player must be subbed in for {[...expelledHome, ...expelledAway].map(n => `#${n}`).join(', ')}
            </span>
          )}
          {subHint > 0 && !setComplete && !hasExpelled && (
            <span className="text-yellow-400 text-lg font-bold text-center">Select a Player Number to sub</span>
          )}
          {liberoSwapHint && !hasExpelled && subHint === 0 && !setComplete && !justSwitched && (
            <span
              onClick={() => {
                recordLiberoReplacement(
                  liberoSwapHint.team,
                  liberoSwapHint.liberoNumber,
                  liberoSwapHint.serverNumber,
                  1 as CourtPosition,
                  true
                );
              }}
              className="text-teal-400 text-lg font-bold text-center cursor-pointer hover:text-teal-300 touch-manipulation"
            >
              (Libero #{liberoSwapHint.liberoNumber} Swap for Server #{liberoSwapHint.serverNumber}?)
            </span>
          )}
        </div>
        {/* Sub pattern hint buttons */}
        <div className="flex-1 flex items-center">
          {subPatternHints.length > 0 && !hasExpelled && subHint === 0 && !setComplete && (() => {
            const all = subPatternHints.slice(0, 2);
            const cols = all.length >= 2 ? 2 : 1;
            const anyVisible = all.some(h => !dismissedHints.has(`${h.team}-${h.playerOut}-${h.playerIn}`));
            return anyVisible && (
              <div className={`flex-1 grid gap-1.5 px-3 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {all.map((hint) => {
                  const key = `${hint.team}-${hint.playerOut}-${hint.playerIn}`;
                  const isDismissed = dismissedHints.has(key);
                  if (isDismissed) return <div key={key} />;
                  const isHome = hint.team === 'home';
                  return (
                    <div key={key} className="flex rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => recordSubstitution(hint.team, hint.playerIn, hint.playerOut)}
                        className={`flex-1 flex items-center justify-center gap-1.5 ${isHome ? 'bg-blue-800 text-blue-200' : 'bg-red-800 text-red-200'} text-sm font-bold py-1.5 touch-manipulation transition-colors`}
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        Sub #{hint.playerIn} for #{hint.playerOut}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDismissedHints(prev => new Set(prev).add(key))}
                        className="bg-slate-600 hover:bg-slate-500 text-slate-300 px-2.5 flex items-center touch-manipulation transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-3 mt-2">
        <div className="flex flex-col gap-1.5 w-full">
          <div className="flex gap-1.5 items-center w-full">
                <button type="button" onClick={() => setSubHint(n => n + 1)} className={`flex-1 bg-blue-700 text-white text-[14px] font-bold px-2 py-1 rounded-lg text-center whitespace-nowrap landscape:hidden ${setComplete ? 'opacity-40 pointer-events-none' : ''}`}>Subs&nbsp;(<span className="text-white">{config.maxSubsPerSet - homeSubCount}</span>)</button>
                <button type="button" onClick={() => setSubHint(n => n + 1)} className={`flex-1 bg-red-700 text-white text-[14px] font-bold px-2 py-1 rounded-lg text-center whitespace-nowrap landscape:hidden ${setComplete ? 'opacity-40 pointer-events-none' : ''}`}>Subs&nbsp;(<span className="text-white">{config.maxSubsPerSet - awaySubCount}</span>)</button>
          </div>
          <button data-name="scoresheet-btn" onClick={() => { setSubHint(0); navigate('/scoresheet'); }} className={`w-full text-white text-[20px] font-bold py-5 rounded-lg transition-colors text-center ${setComplete ? 'animate-gold-pulse' : 'bg-slate-600 hover:bg-slate-500'}`}>Scoresheet</button>
        </div>
      </div>


      </div>{/* end content wrapper */}

      {/* Dialogs */}
      {showSubDialog && (
        <SubstitutionDialog
          team={showSubDialog.team}
          preSelectedOut={showSubDialog.playerOut}
          onClose={() => setShowSubDialog(null)}
        />
      )}
      {showLiberoPanel && (
        <LiberoPanel team={showLiberoPanel} onClose={() => setShowLiberoPanel(null)} />
      )}
      {showSanctionDialog && (
        <SanctionDialog onClose={() => setShowSanctionDialog(false)} />
      )}
      {showOverwriteDialog && (
        <OverwriteDialog onClose={() => setShowOverwriteDialog(false)} />
      )}
    </div>
  );
}

// ── Team Panel ───────────────────────────────────────────────

interface TeamPanelProps {
  teamName: string;
  teamSide: TeamSide;
  teamScore: number;
  lineup: Lineup | null;
  isServing: boolean;
  setComplete: boolean;
  isWinner: boolean;
  timeoutCount: number;
  maxTimeouts: number;
  hasLibero: boolean;
  liberoNums: Set<number>;
  expelledPlayers: Set<number>;
  pointsBlocked: boolean;
  onPoint: () => void;
  onDecrement: () => void;
  onLibero: () => void;
  onSubPlayer: (playerOut: number) => void;
  highlightSub?: number;
}

function TeamPanel({
  teamName,
  teamSide,
  teamScore,
  lineup,
  isServing,
  setComplete,
  isWinner,
  timeoutCount,
  maxTimeouts,
  hasLibero,
  liberoNums,
  expelledPlayers,
  pointsBlocked,
  onPoint,
  onDecrement,
  onLibero,
  onSubPlayer,
  highlightSub,
}: TeamPanelProps) {
  const isHome = teamSide === 'home';
  const side = isHome ? 'home' : 'away';
  const borderColor = isHome ? 'border-blue-600' : 'border-red-700';
  const servingBorder = '';
  const pointBg = isHome
    ? 'bg-blue-700 hover:bg-blue-600 active:bg-blue-500'
    : 'bg-red-700 hover:bg-red-600 active:bg-red-500';
  return (
    <div data-name={`${side}-panel`} className={`flex-1 flex flex-col border-2 ${borderColor} ${servingBorder} rounded-xl bg-slate-800/50 p-2 gap-2 max-w-[380px] min-w-0 overflow-hidden ${setComplete ? 'border-opacity-40' : ''}`} style={setComplete ? { borderColor: isHome ? 'rgba(37,99,235,0.4)' : 'rgba(185,28,28,0.4)' } : undefined}>
      {/* Header: T/O left, Score+Name center, Lib right */}
      <div data-name={`${side}-header`} className="flex items-start">
        <div className={`shrink-0 ${setComplete ? 'opacity-40' : ''}`}>
          <TimeoutButton team={teamSide} count={timeoutCount} max={maxTimeouts} disabled={setComplete} />
        </div>
        <div data-name={`${side}-score-name`} className="flex-1 flex flex-col items-center min-w-0">
          <div className={`relative ${isHome ? 'bg-blue-900' : 'bg-red-900'} ${isServing ? 'border-yellow-400' : isHome ? 'border-blue-500' : 'border-red-500'} border-2 rounded-lg w-[52px] text-center ${setComplete && !isWinner ? 'opacity-40' : ''}`}>
            <span className="text-3xl font-bold text-white tabular-nums">{teamScore}</span>
          </div>
          <span className={`text-[14px] text-white font-medium leading-tight truncate max-w-full mt-0.5 ${setComplete ? 'opacity-40' : ''}`}>{teamName}</span>
        </div>
        <div className={`ml-auto shrink-0 flex justify-center ${setComplete ? 'opacity-40' : ''}`}>
          {hasLibero ? (
            <button
              data-name={`${side}-libero-btn`}
              onClick={onLibero}
              disabled={setComplete}
              className="bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white text-[14px] font-semibold rounded-md transition-colors touch-manipulation"
              style={{ width: '37px', height: '38px' }}
            >
              LIB
            </button>
          ) : (
            <div className="w-[37px]" />
          )}
        </div>
      </div>

      {/* Rotation Grid */}
      {lineup && (
        <div data-name={`${side}-rotation-grid`} className={`flex-[0.6] flex flex-col justify-center ${setComplete ? 'opacity-40' : ''}`}>
          {/* Net-side labels */}
          <div data-name={`${side}-front-labels`} className="grid grid-cols-3 gap-1 text-center">
            <span className="text-[13px] text-white">IV</span>
            <span className="text-[13px] text-white">III</span>
            <span className="text-[13px] text-white">II</span>
          </div>
          {/* Front row */}
          <div data-name={`${side}-front-row`} className="grid grid-cols-3 gap-1 flex-1">
            <RotCell num={lineup[4]} name={`${side}-pos-IV`} isLibero={liberoNums.has(lineup[4])} expelled={expelledPlayers.has(lineup[4])} onTap={!setComplete ? onSubPlayer : undefined} highlight={highlightSub} />
            <RotCell num={lineup[3]} name={`${side}-pos-III`} isLibero={liberoNums.has(lineup[3])} expelled={expelledPlayers.has(lineup[3])} onTap={!setComplete ? onSubPlayer : undefined} highlight={highlightSub} />
            <RotCell num={lineup[2]} name={`${side}-pos-II`} isLibero={liberoNums.has(lineup[2])} expelled={expelledPlayers.has(lineup[2])} onTap={!setComplete ? onSubPlayer : undefined} highlight={highlightSub} />
          </div>
          {/* Back row */}
          <div data-name={`${side}-back-row`} className="grid grid-cols-3 gap-1 mt-1 flex-1">
            <RotCell num={lineup[5]} name={`${side}-pos-V`} isLibero={liberoNums.has(lineup[5])} expelled={expelledPlayers.has(lineup[5])} onTap={!setComplete ? onSubPlayer : undefined} highlight={highlightSub} />
            <RotCell num={lineup[6]} name={`${side}-pos-VI`} isLibero={liberoNums.has(lineup[6])} expelled={expelledPlayers.has(lineup[6])} onTap={!setComplete ? onSubPlayer : undefined} highlight={highlightSub} />
            <RotCell num={lineup[1]} name={`${side}-pos-I`} serve={isServing} isLibero={liberoNums.has(lineup[1])} expelled={expelledPlayers.has(lineup[1])} onTap={!setComplete ? onSubPlayer : undefined} highlight={highlightSub} />
          </div>
          {/* Back-side labels */}
          <div data-name={`${side}-back-labels`} className="grid grid-cols-3 gap-1 text-center">
            <span className="text-[13px] text-white">V</span>
            <span className="text-[13px] text-white">VI</span>
            <span className="text-[13px] text-white">I</span>
          </div>
        </div>
      )}

      {/* Point Buttons */}
      <div data-name={`${side}-point-buttons`} className={`flex flex-1 ${setComplete || pointsBlocked ? 'opacity-40 pointer-events-none' : ''}`}>
        <button
          data-name={`${side}-plus-btn`}
          onClick={onPoint}
          disabled={setComplete || pointsBlocked}
          className={`flex-1 ${pointBg} text-white text-2xl font-bold py-2 rounded-l-lg transition-colors active:scale-95 touch-manipulation`}
        >
          +
        </button>
        <button
          data-name={`${side}-minus-btn`}
          onClick={onDecrement}
          disabled={setComplete || pointsBlocked}
          className="flex-1 bg-slate-600 hover:bg-slate-500 active:bg-slate-400 text-white text-2xl font-bold py-2 rounded-r-lg transition-colors active:scale-95 touch-manipulation"
        >
          −
        </button>
      </div>
    </div>
  );
}

// ── Rotation Cell ────────────────────────────────────────────

function RotCell({ num, serve, name, isLibero, expelled, onTap, highlight }: { num: number; serve?: boolean; name: string; isLibero?: boolean; expelled?: boolean; onTap?: (playerNum: number) => void; highlight?: number }) {
  return (
    <button
      type="button"
      data-name={name}
      onClick={onTap ? () => onTap(num) : undefined}
      className={`relative overflow-hidden rounded px-1 py-1.5 text-center text-[20px] font-bold transition-colors touch-manipulation h-full ${expelled ? 'bg-red-900/60 ring-2 ring-red-500 animate-pulse' : 'bg-slate-700 active:bg-slate-600'} ${
        serve ? 'text-yellow-400 ring-1 ring-yellow-400' : expelled ? 'text-red-400' : 'text-white'
      } ${highlight ? (serve ? 'animate-sub-pulse-server' : 'animate-sub-pulse') : ''}`}
    >
      {isLibero && !expelled && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 40 40" preserveAspectRatio="none">
          <polygon points="0,40 20,4 40,40" fill="#0f766e" opacity="0.7" />
        </svg>
      )}
      <span className="relative z-10">{expelled ? '!' : num}</span>
      {serve && !expelled && (
        <svg className="absolute top-1/2 -translate-y-1/2 right-0.5 w-3 h-3 text-yellow-400 z-10" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="10" cy="10" r="3.5" />
        </svg>
      )}
    </button>
  );
}
