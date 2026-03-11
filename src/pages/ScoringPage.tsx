import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import { getSetScore, getSetsWon, getCurrentRotation, getSubCount, getTimeoutCount } from '@/store/derived';
import { isSetComplete, getSetWinner } from '@/utils/scoring';
import SubstitutionDialog from '@/components/scoring/SubstitutionDialog';
import TimeoutButton from '@/components/scoring/TimeoutButton';
import UndoButton from '@/components/scoring/UndoButton';
import EventLog from '@/components/scoring/EventLog';
import LiberoPanel from '@/components/scoring/LiberoPanel';
import PdfPreview from '@/components/scoring/PdfPreview';
import type { Lineup, TeamSide } from '@/types/match';

export default function ScoringPage() {
  const navigate = useNavigate();
  const state = useMatchStore();
  const {
    homeTeam,
    awayTeam,
    config,
    events,
    currentSetIndex,
    matchComplete,
    awardPoint,
    decrementPoint,
    undo,
    advanceToNextSet,
  } = state;

  const [showSubDialog, setShowSubDialog] = useState<{ team: TeamSide; playerOut?: number } | null>(null);
  const [showLiberoPanel, setShowLiberoPanel] = useState<'home' | 'away' | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const score = getSetScore(events, currentSetIndex);
  const setsWon = getSetsWon(state);
  const rotation = getCurrentRotation(state, currentSetIndex);
  const setComplete = isSetComplete(score, currentSetIndex, config);
  const setWinner = getSetWinner(score, currentSetIndex, config);

  const homeSubCount = getSubCount(events, currentSetIndex, 'home');
  const awaySubCount = getSubCount(events, currentSetIndex, 'away');
  const homeTimeoutCount = getTimeoutCount(events, currentSetIndex, 'home');
  const awayTimeoutCount = getTimeoutCount(events, currentSetIndex, 'away');

  const hasLiberoHome = homeTeam.roster.some((p) => p.isLibero);
  const hasLiberoAway = awayTeam.roster.some((p) => p.isLibero);
  const homeLiberoNums = new Set(homeTeam.roster.filter((p) => p.isLibero).map((p) => p.number));
  const awayLiberoNums = new Set(awayTeam.roster.filter((p) => p.isLibero).map((p) => p.number));

  const homeServing = rotation?.servingTeam === 'home';
  const awayServing = rotation?.servingTeam === 'away';

  return (
    <div data-name="scoring-page" className="h-full flex flex-col bg-slate-900">
      {/* Top Bar */}
      <div data-name="top-bar" className="bg-slate-800 px-4 py-2 flex items-center justify-between shrink-0">
        <div data-name="set-info" className="text-sm font-semibold text-slate-300">
          Sets: {setsWon.home}-{setsWon.away} | SET {currentSetIndex + 1}
          {currentSetIndex === config.bestOf - 1 && (
            <span className="text-yellow-400 ml-1">(Deciding)</span>
          )}
        </div>
        <div data-name="top-bar-buttons" className="flex gap-2">
          <UndoButton onUndo={undo} disabled={events.length === 0} />
          <button
            data-name="preview-btn"
            onClick={() => setShowPdfPreview(true)}
            className="bg-green-700 hover:bg-green-600 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            Preview
          </button>
          <button
            data-name="scoresheet-btn"
            onClick={() => navigate('/scoresheet')}
            className="bg-slate-600 hover:bg-slate-500 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            Scoresheet
          </button>
        </div>
      </div>

      {/* Main Area: Two Team Panels Side by Side */}
      <div data-name="panels-container" className="flex-1 flex justify-center gap-3 px-3 min-h-0">
        {/* Home Team Panel */}
        <TeamPanel
          teamName={homeTeam.name}
          teamSide="home"
          teamScore={score.home}
          lineup={rotation?.homeLineup ?? null}
          isServing={homeServing}
          setComplete={setComplete}
          timeoutCount={homeTimeoutCount}
          maxTimeouts={config.maxTimeoutsPerSet}
          subCount={homeSubCount}
          maxSubs={config.maxSubsPerSet}
          hasLibero={hasLiberoHome}
          liberoNums={homeLiberoNums}
          onPoint={() => awardPoint('home')}
          onDecrement={() => decrementPoint('home')}
          onLibero={() => setShowLiberoPanel('home')}
          onSubPlayer={(playerOut) => setShowSubDialog({ team: 'home', playerOut })}
        />

        {/* Away Team Panel */}
        <TeamPanel
          teamName={awayTeam.name}
          teamSide="away"
          teamScore={score.away}
          lineup={rotation?.awayLineup ?? null}
          isServing={awayServing}
          setComplete={setComplete}
          timeoutCount={awayTimeoutCount}
          maxTimeouts={config.maxTimeoutsPerSet}
          subCount={awaySubCount}
          maxSubs={config.maxSubsPerSet}
          hasLibero={hasLiberoAway}
          liberoNums={awayLiberoNums}
          onPoint={() => awardPoint('away')}
          onDecrement={() => decrementPoint('away')}
          onLibero={() => setShowLiberoPanel('away')}
          onSubPlayer={(playerOut) => setShowSubDialog({ team: 'away', playerOut })}
        />
      </div>

      {/* Set Complete Banner */}
      {setComplete && (
        <div data-name="set-complete-banner" className="bg-yellow-900/80 border-t-2 border-yellow-500 px-4 py-4 text-center shrink-0">
          <p data-name="set-complete-text" className="text-yellow-200 text-xl font-bold mb-3">
            {matchComplete
              ? `Match Over! ${setWinner === 'home' ? homeTeam.name : awayTeam.name} wins the match ${setsWon.home}-${setsWon.away}`
              : `Set ${currentSetIndex + 1} won by ${setWinner === 'home' ? homeTeam.name : awayTeam.name} (${score.home}-${score.away})`}
          </p>
          {!matchComplete && (
            <button
              data-name="next-set-btn"
              onClick={() => {
                advanceToNextSet();
                navigate(`/lineup/${currentSetIndex + 1}`);
              }}
              className="bg-green-600 hover:bg-green-700 text-white text-lg font-semibold px-8 py-3 rounded-xl transition-colors"
            >
              Start Set {currentSetIndex + 2}
            </button>
          )}
          <button
            data-name="view-scoresheet-btn"
            onClick={() => navigate('/scoresheet')}
            className="ml-4 bg-slate-600 hover:bg-slate-500 text-white text-lg font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            View Scoresheet
          </button>
        </div>
      )}

      {/* Event Log */}
      <EventLog events={events} setIndex={currentSetIndex} homeTeam={homeTeam} awayTeam={awayTeam} />

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
      {showPdfPreview && (
        <PdfPreview onClose={() => setShowPdfPreview(false)} />
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
  timeoutCount: number;
  maxTimeouts: number;
  subCount: number;
  maxSubs: number;
  hasLibero: boolean;
  liberoNums: Set<number>;
  onPoint: () => void;
  onDecrement: () => void;
  onLibero: () => void;
  onSubPlayer: (playerOut: number) => void;
}

function TeamPanel({
  teamName,
  teamSide,
  teamScore,
  lineup,
  isServing,
  setComplete,
  timeoutCount,
  maxTimeouts,
  subCount,
  maxSubs,
  hasLibero,
  liberoNums,
  onPoint,
  onDecrement,
  onLibero,
  onSubPlayer,
}: TeamPanelProps) {
  const isHome = teamSide === 'home';
  const side = isHome ? 'home' : 'away';
  const borderColor = isHome ? 'border-blue-600' : 'border-red-700';
  const servingBorder = '';
  const pointBg = isHome
    ? 'bg-blue-700 hover:bg-blue-600 active:bg-blue-500'
    : 'bg-red-700 hover:bg-red-600 active:bg-red-500';
  return (
    <div data-name={`${side}-panel`} className={`flex flex-col border-2 ${borderColor} ${servingBorder} rounded-xl bg-slate-800/50 p-2 gap-2`} style={{ width: '44%', maxWidth: '220px' }}>
      {/* Header: T/O+SUB left, Name center, Lib right */}
      <div data-name={`${side}-header`} className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <TimeoutButton team={teamSide} count={timeoutCount} max={maxTimeouts} disabled={setComplete} />
          <div data-name={`${side}-sub-label`} className="text-[10px] font-semibold text-white text-center">
            SUB [{maxSubs - subCount}]
          </div>
        </div>
        <div data-name={`${side}-score-name`} className="flex flex-col items-center px-1">
          <div className={`relative ${isHome ? 'bg-blue-900' : 'bg-red-900'} ${isServing ? 'border-yellow-400' : isHome ? 'border-blue-500' : 'border-red-500'} border-2 rounded-lg w-[52px] text-center`}>
            <span className="text-3xl font-bold text-white tabular-nums">{teamScore}</span>
            {isServing && (
              <svg className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-yellow-400 ${isHome ? '-left-5' : '-right-5'}`} fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <circle cx="10" cy="10" r="3.5" />
              </svg>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-medium leading-tight truncate max-w-full mt-0.5">{teamName}</span>
        </div>
        {hasLibero ? (
          <button
            data-name={`${side}-libero-btn`}
            onClick={onLibero}
            disabled={setComplete}
            className="bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white text-xs font-semibold px-2 py-1 rounded-md transition-colors touch-manipulation"
          >
            Lib
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Rotation Grid */}
      {lineup && (
        <div data-name={`${side}-rotation-grid`} className="flex-1 flex flex-col justify-center">
          {/* Net-side labels */}
          <div data-name={`${side}-front-labels`} className="grid grid-cols-3 gap-1 text-center">
            <span className="text-[10px] text-slate-500">IV</span>
            <span className="text-[10px] text-slate-500">III</span>
            <span className="text-[10px] text-slate-500">II</span>
          </div>
          {/* Front row */}
          <div data-name={`${side}-front-row`} className="grid grid-cols-3 gap-1">
            <RotCell num={lineup[4]} name={`${side}-pos-IV`} isLibero={liberoNums.has(lineup[4])} onTap={!setComplete ? onSubPlayer : undefined} />
            <RotCell num={lineup[3]} name={`${side}-pos-III`} isLibero={liberoNums.has(lineup[3])} onTap={!setComplete ? onSubPlayer : undefined} />
            <RotCell num={lineup[2]} name={`${side}-pos-II`} isLibero={liberoNums.has(lineup[2])} onTap={!setComplete ? onSubPlayer : undefined} />
          </div>
          {/* Back row */}
          <div data-name={`${side}-back-row`} className="grid grid-cols-3 gap-1 mt-1">
            <RotCell num={lineup[5]} name={`${side}-pos-V`} isLibero={liberoNums.has(lineup[5])} onTap={!setComplete ? onSubPlayer : undefined} />
            <RotCell num={lineup[6]} name={`${side}-pos-VI`} isLibero={liberoNums.has(lineup[6])} onTap={!setComplete ? onSubPlayer : undefined} />
            <RotCell num={lineup[1]} name={`${side}-pos-I`} serve={isServing} isLibero={liberoNums.has(lineup[1])} onTap={!setComplete ? onSubPlayer : undefined} />
          </div>
          {/* Back-side labels */}
          <div data-name={`${side}-back-labels`} className="grid grid-cols-3 gap-1 text-center">
            <span className="text-[10px] text-slate-500">V</span>
            <span className="text-[10px] text-slate-500">VI</span>
            <span className="text-[10px] text-slate-500">I</span>
          </div>
        </div>
      )}

      {/* Point Buttons */}
      {!setComplete && (
        <div data-name={`${side}-point-buttons`} className="flex">
          <button
            data-name={`${side}-plus-btn`}
            onClick={onPoint}
            className={`flex-1 ${pointBg} text-white text-2xl font-bold py-2 rounded-l-lg transition-colors active:scale-95 touch-manipulation`}
          >
            +
          </button>
          <button
            data-name={`${side}-minus-btn`}
            onClick={onDecrement}
            className="flex-1 bg-slate-600 hover:bg-slate-500 active:bg-slate-400 text-white text-2xl font-bold py-2 rounded-r-lg transition-colors active:scale-95 touch-manipulation"
          >
            −
          </button>
        </div>
      )}
    </div>
  );
}

// ── Rotation Cell ────────────────────────────────────────────

function RotCell({ num, serve, name, isLibero, onTap }: { num: number; serve?: boolean; name: string; isLibero?: boolean; onTap?: (playerNum: number) => void }) {
  return (
    <button
      type="button"
      data-name={name}
      onClick={onTap ? () => onTap(num) : undefined}
      className={`relative overflow-hidden rounded px-1 py-1.5 text-center text-base font-bold transition-colors touch-manipulation bg-slate-700 active:bg-slate-600 ${
        serve ? 'text-yellow-400 ring-1 ring-yellow-400' : 'text-white'
      }`}
    >
      {isLibero && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 40 40" preserveAspectRatio="none">
          <polygon points="0,40 20,4 40,40" fill="#0f766e" opacity="0.7" />
        </svg>
      )}
      <span className="relative z-10">{num}</span>
    </button>
  );
}
