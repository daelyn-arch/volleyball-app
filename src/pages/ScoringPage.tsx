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

  const [showSubDialog, setShowSubDialog] = useState<'home' | 'away' | null>(null);
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

      {/* Scores + Serve Indicator */}
      <div data-name="score-row" className="flex items-center justify-center py-3 shrink-0">
        <div data-name="score-group" className="relative flex items-center gap-3">
          <div data-name="home-score" className="bg-blue-900 border-2 border-blue-500 rounded-lg px-5 py-2 min-w-[64px] text-center">
            <span className="text-4xl font-bold text-white tabular-nums">{score.home}</span>
          </div>
          <div data-name="away-score" className="bg-red-900 border-2 border-red-500 rounded-lg px-5 py-2 min-w-[64px] text-center">
            <span className="text-4xl font-bold text-white tabular-nums">{score.away}</span>
          </div>
          {/* Serve indicator positioned absolutely outside the scores */}
          {rotation && homeServing && (
            <div data-name="home-serve-indicator" className="absolute right-full mr-3 flex items-center gap-1.5 text-yellow-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="10" cy="10" r="3" />
              </svg>
              <span className="text-sm font-semibold whitespace-nowrap">#{rotation.serverNumber}</span>
            </div>
          )}
          {rotation && awayServing && (
            <div data-name="away-serve-indicator" className="absolute left-full ml-3 flex items-center gap-1.5 text-yellow-400">
              <span className="text-sm font-semibold whitespace-nowrap">#{rotation.serverNumber}</span>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="10" cy="10" r="3" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Main Area: Two Team Panels Side by Side */}
      <div data-name="panels-container" className="flex-1 flex justify-center gap-4 px-4 pb-3 min-h-0">
        {/* Home Team Panel */}
        <TeamPanel
          teamName={homeTeam.name}
          teamSide="home"
          lineup={rotation?.homeLineup ?? null}
          isServing={homeServing}
          setComplete={setComplete}
          subCount={homeSubCount}
          maxSubs={config.maxSubsPerSet}
          timeoutCount={homeTimeoutCount}
          maxTimeouts={config.maxTimeoutsPerSet}
          hasLibero={hasLiberoHome}
          onPoint={() => awardPoint('home')}
          onDecrement={() => decrementPoint('home')}
          onSub={() => setShowSubDialog('home')}
          onLibero={() => setShowLiberoPanel('home')}
        />

        {/* Away Team Panel */}
        <TeamPanel
          teamName={awayTeam.name}
          teamSide="away"
          lineup={rotation?.awayLineup ?? null}
          isServing={awayServing}
          setComplete={setComplete}
          subCount={awaySubCount}
          maxSubs={config.maxSubsPerSet}
          timeoutCount={awayTimeoutCount}
          maxTimeouts={config.maxTimeoutsPerSet}
          hasLibero={hasLiberoAway}
          onPoint={() => awardPoint('away')}
          onDecrement={() => decrementPoint('away')}
          onSub={() => setShowSubDialog('away')}
          onLibero={() => setShowLiberoPanel('away')}
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
        <SubstitutionDialog team={showSubDialog} onClose={() => setShowSubDialog(null)} />
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
  lineup: Lineup | null;
  isServing: boolean;
  setComplete: boolean;
  subCount: number;
  maxSubs: number;
  timeoutCount: number;
  maxTimeouts: number;
  hasLibero: boolean;
  onPoint: () => void;
  onDecrement: () => void;
  onSub: () => void;
  onLibero: () => void;
}

function TeamPanel({
  teamName,
  teamSide,
  lineup,
  isServing,
  setComplete,
  subCount,
  maxSubs,
  timeoutCount,
  maxTimeouts,
  hasLibero,
  onPoint,
  onDecrement,
  onSub,
  onLibero,
}: TeamPanelProps) {
  const isHome = teamSide === 'home';
  const side = isHome ? 'home' : 'away';
  const borderColor = isHome ? 'border-blue-600' : 'border-red-700';
  const servingBorder = isServing ? 'ring-2 ring-yellow-400' : '';
  const pointBg = isHome
    ? 'bg-blue-700 hover:bg-blue-600 active:bg-blue-500'
    : 'bg-red-700 hover:bg-red-600 active:bg-red-500';
  return (
    <div data-name={`${side}-panel`} className={`flex flex-col border-2 ${borderColor} ${servingBorder} rounded-xl bg-slate-800/50 p-3 gap-3`} style={{ width: '32.5%' }}>
      {/* Team Name */}
      <div data-name={`${side}-team-name`} className="text-center text-sm text-slate-400 font-medium">
        {teamName} {isServing && <span className="text-yellow-400">(Serving)</span>}
      </div>

      {/* Rotation Grid */}
      {lineup && (
        <div data-name={`${side}-rotation-grid`} className="flex-1 flex flex-col justify-center">
          {/* Net-side labels */}
          <div data-name={`${side}-front-labels`} className="grid grid-cols-3 gap-1 text-center">
            <span className="text-xs text-slate-500">IV</span>
            <span className="text-xs text-slate-500">III</span>
            <span className="text-xs text-slate-500">II</span>
          </div>
          {/* Front row */}
          <div data-name={`${side}-front-row`} className="grid grid-cols-3 gap-1">
            <RotCell num={lineup[4]} name={`${side}-pos-IV`} />
            <RotCell num={lineup[3]} name={`${side}-pos-III`} />
            <RotCell num={lineup[2]} name={`${side}-pos-II`} />
          </div>
          {/* Back row */}
          <div data-name={`${side}-back-row`} className="grid grid-cols-3 gap-1 mt-1">
            <RotCell num={lineup[5]} name={`${side}-pos-V`} />
            <RotCell num={lineup[6]} name={`${side}-pos-VI`} />
            <RotCell num={lineup[1]} name={`${side}-pos-I`} serve={isServing} />
          </div>
          {/* Back-side labels */}
          <div data-name={`${side}-back-labels`} className="grid grid-cols-3 gap-1 text-center">
            <span className="text-xs text-slate-500">V</span>
            <span className="text-xs text-slate-500">VI</span>
            <span className="text-xs text-slate-500">I</span>
          </div>
        </div>
      )}

      {/* Point Buttons */}
      {!setComplete && (
        <div data-name={`${side}-point-buttons`} className="flex">
          <button
            data-name={`${side}-plus-btn`}
            onClick={onPoint}
            className={`flex-1 ${pointBg} text-white text-2xl font-bold py-3 rounded-l-lg transition-colors active:scale-95 touch-manipulation`}
          >
            +
          </button>
          <button
            data-name={`${side}-minus-btn`}
            onClick={onDecrement}
            className="flex-1 bg-slate-600 hover:bg-slate-500 active:bg-slate-400 text-white text-2xl font-bold py-3 rounded-r-lg transition-colors active:scale-95 touch-manipulation"
          >
            −
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div data-name={`${side}-action-buttons`} className="flex gap-2 justify-center">
        <TimeoutButton
          team={teamSide}
          count={timeoutCount}
          max={maxTimeouts}
          disabled={setComplete}
        />
        <button
          data-name={`${side}-sub-btn`}
          onClick={onSub}
          disabled={setComplete}
          className="bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          SUB ({subCount}/{maxSubs})
        </button>
        {hasLibero && (
          <button
            data-name={`${side}-libero-btn`}
            onClick={onLibero}
            disabled={setComplete}
            className="bg-teal-700 hover:bg-teal-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Libero
          </button>
        )}
      </div>
    </div>
  );
}

// ── Rotation Cell ────────────────────────────────────────────

function RotCell({ num, serve, name }: { num: number; serve?: boolean; name: string }) {
  return (
    <div
      data-name={name}
      className={`rounded px-2 py-2 text-center text-lg font-bold ${
        serve
          ? 'bg-yellow-600 text-white'
          : 'bg-slate-700 text-white'
      }`}
    >
      {num}
    </div>
  );
}
