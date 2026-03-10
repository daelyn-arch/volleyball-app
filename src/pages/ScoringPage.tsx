import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import { getSetScore, getSetsWon, getCurrentRotation, getSubCount, getTimeoutCount } from '@/store/derived';
import { isSetComplete, getSetWinner, getPointsTarget } from '@/utils/scoring';
import ScoreDisplay from '@/components/scoring/ScoreDisplay';
import PointButtons from '@/components/scoring/PointButtons';
import ServeIndicator from '@/components/scoring/ServeIndicator';
import RotationDisplay from '@/components/scoring/RotationDisplay';
import SubstitutionDialog from '@/components/scoring/SubstitutionDialog';
import TimeoutButton from '@/components/scoring/TimeoutButton';
import UndoButton from '@/components/scoring/UndoButton';
import EventLog from '@/components/scoring/EventLog';
import LiberoPanel from '@/components/scoring/LiberoPanel';

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
    undo,
    advanceToNextSet,
  } = state;

  const [showSubDialog, setShowSubDialog] = useState<'home' | 'away' | null>(null);
  const [showLiberoPanel, setShowLiberoPanel] = useState<'home' | 'away' | null>(null);

  const score = getSetScore(events, currentSetIndex);
  const setsWon = getSetsWon(state);
  const rotation = getCurrentRotation(state, currentSetIndex);
  const setComplete = isSetComplete(score, currentSetIndex, config);
  const setWinner = getSetWinner(score, currentSetIndex, config);
  const target = getPointsTarget(currentSetIndex, config);

  const homeSubCount = getSubCount(events, currentSetIndex, 'home');
  const awaySubCount = getSubCount(events, currentSetIndex, 'away');
  const homeTimeoutCount = getTimeoutCount(events, currentSetIndex, 'home');
  const awayTimeoutCount = getTimeoutCount(events, currentSetIndex, 'away');

  const hasLiberoHome = homeTeam.roster.some((p) => p.isLibero);
  const hasLiberoAway = awayTeam.roster.some((p) => p.isLibero);

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="text-lg font-semibold text-white">
          Sets: {setsWon.home}-{setsWon.away}
        </div>
        <div className="text-xl font-bold text-white">
          SET {currentSetIndex + 1}
          {currentSetIndex === config.bestOf - 1 && (
            <span className="text-yellow-400 text-sm ml-2">(Deciding)</span>
          )}
        </div>
        <div className="flex gap-2">
          <UndoButton onUndo={undo} disabled={events.length === 0} />
          <button
            onClick={() => navigate('/scoresheet')}
            className="bg-slate-600 hover:bg-slate-500 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            Scoresheet
          </button>
        </div>
      </div>

      {/* Main Scoring Area */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Home Team Side */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-3">
          <h2 className="text-2xl font-bold text-blue-400">{homeTeam.name}</h2>
          <ScoreDisplay score={score.home} teamSide="home" />
          {rotation && rotation.servingTeam === 'home' && (
            <ServeIndicator serverNumber={rotation.serverNumber} />
          )}
          {!setComplete && (
            <PointButtons
              teamSide="home"
              teamName={homeTeam.name}
              onPoint={() => awardPoint('home')}
              disabled={setComplete}
            />
          )}
          <div className="flex gap-2 flex-wrap justify-center">
            <TimeoutButton
              team="home"
              count={homeTimeoutCount}
              max={config.maxTimeoutsPerSet}
              disabled={setComplete}
            />
            <button
              onClick={() => setShowSubDialog('home')}
              disabled={setComplete}
              className="bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              SUB ({homeSubCount}/{config.maxSubsPerSet})
            </button>
            {hasLiberoHome && (
              <button
                onClick={() => setShowLiberoPanel('home')}
                disabled={setComplete}
                className="bg-teal-700 hover:bg-teal-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                Libero
              </button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-slate-600 hidden lg:block" />
        <div className="h-px bg-slate-600 lg:hidden" />

        {/* Away Team Side */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-3">
          <h2 className="text-2xl font-bold text-red-400">{awayTeam.name}</h2>
          <ScoreDisplay score={score.away} teamSide="away" />
          {rotation && rotation.servingTeam === 'away' && (
            <ServeIndicator serverNumber={rotation.serverNumber} />
          )}
          {!setComplete && (
            <PointButtons
              teamSide="away"
              teamName={awayTeam.name}
              onPoint={() => awardPoint('away')}
              disabled={setComplete}
            />
          )}
          <div className="flex gap-2 flex-wrap justify-center">
            <TimeoutButton
              team="away"
              count={awayTimeoutCount}
              max={config.maxTimeoutsPerSet}
              disabled={setComplete}
            />
            <button
              onClick={() => setShowSubDialog('away')}
              disabled={setComplete}
              className="bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              SUB ({awaySubCount}/{config.maxSubsPerSet})
            </button>
            {hasLiberoAway && (
              <button
                onClick={() => setShowLiberoPanel('away')}
                disabled={setComplete}
                className="bg-teal-700 hover:bg-teal-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                Libero
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Rotation Display */}
      {rotation && (
        <div className="bg-slate-800 border-t border-slate-700 px-4 py-3 shrink-0">
          <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
            <RotationDisplay
              lineup={rotation.homeLineup}
              teamName={homeTeam.name}
              isServing={rotation.servingTeam === 'home'}
              teamSide="home"
            />
            <RotationDisplay
              lineup={rotation.awayLineup}
              teamName={awayTeam.name}
              isServing={rotation.servingTeam === 'away'}
              teamSide="away"
            />
          </div>
        </div>
      )}

      {/* Set Complete Banner */}
      {setComplete && (
        <div className="bg-yellow-900/80 border-t-2 border-yellow-500 px-4 py-4 text-center shrink-0">
          <p className="text-yellow-200 text-xl font-bold mb-3">
            {matchComplete
              ? `Match Over! ${setWinner === 'home' ? homeTeam.name : awayTeam.name} wins the match ${setsWon.home}-${setsWon.away}`
              : `Set ${currentSetIndex + 1} won by ${setWinner === 'home' ? homeTeam.name : awayTeam.name} (${score.home}-${score.away})`}
          </p>
          {!matchComplete && (
            <button
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
            onClick={() => navigate('/scoresheet')}
            className="ml-4 bg-slate-600 hover:bg-slate-500 text-white text-lg font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            View Scoresheet
          </button>
        </div>
      )}

      {/* Event Log */}
      <EventLog events={events} setIndex={currentSetIndex} homeTeam={homeTeam} awayTeam={awayTeam} />

      {/* Substitution Dialog */}
      {showSubDialog && (
        <SubstitutionDialog
          team={showSubDialog}
          onClose={() => setShowSubDialog(null)}
        />
      )}

      {/* Libero Panel */}
      {showLiberoPanel && (
        <LiberoPanel
          team={showLiberoPanel}
          onClose={() => setShowLiberoPanel(null)}
        />
      )}
    </div>
  );
}
