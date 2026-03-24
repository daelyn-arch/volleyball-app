import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import { getSetSummary, getSetsWon, getSetScore } from '@/store/derived';
import { isSetComplete } from '@/utils/scoring';
import { getPdfStyle } from '@/utils/pdfStyleSetting';
import ScoresheetSet from '@/components/scoresheet/ScoresheetSet';
import ScoresheetPdfDownload from '@/components/scoresheet-pdf/ScoresheetPdfDownload';

export default function ScoresheetViewPage() {
  const navigate = useNavigate();
  const state = useMatchStore();
  const { homeTeam, awayTeam, config, events, currentSetIndex, matchComplete, advanceToNextSet } = state;
  const setsWon = getSetsWon(state);
  const score = getSetScore(events, currentSetIndex);
  const setComplete = isSetComplete(score, currentSetIndex, config);
  const canStartNextSet = setComplete && !matchComplete;
  const [cifLoading, setCifLoading] = useState(false);

  async function handleCifPdf() {
    setCifLoading(true);
    try {
      if (getPdfStyle() === 'official') {
        const { downloadCifScoresheet } = await import('@/utils/cifPdfFill');
        await downloadCifScoresheet(useMatchStore.getState());
      } else {
        const { downloadCifPdf } = await import('@/components/scoresheet-pdf/generateCifPdf');
        await downloadCifPdf();
      }
    } catch (err: any) {
      if (getPdfStyle() === 'official') {
        try {
          const { downloadCifPdf } = await import('@/components/scoresheet-pdf/generateCifPdf');
          await downloadCifPdf();
          return;
        } catch { /* fallthrough */ }
      }
      console.error('CIF PDF failed:', err);
      alert('PDF generation failed: ' + (err?.message || err));
    } finally {
      setCifLoading(false);
    }
  }

  // Include all sets up to and including the current one
  const setsPlayed: number[] = [];
  for (let i = 0; i <= currentSetIndex; i++) {
    setsPlayed.push(i);
  }

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 flex items-center gap-2 relative">
        <button
          onClick={() => navigate('/scoring')}
          className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-lg font-bold transition-colors whitespace-nowrap shrink-0"
        >
          Back
        </button>
        <h1 className="text-xl font-bold whitespace-nowrap absolute left-1/2 -translate-x-1/2">Scoresheet</h1>
        <button
          onClick={() => navigate('/')}
          className="ml-auto bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-lg font-bold transition-colors whitespace-nowrap shrink-0"
        >
          Home
        </button>
      </div>

      {/* Match Header — only shown when match is complete */}
      {matchComplete && (
        <div className="p-4 border-b border-slate-700">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-2">
              <div className="text-right min-w-0 bg-blue-900/30 border-2 border-blue-600 rounded-lg p-3">
                <div className="font-bold text-lg truncate">{homeTeam.name}</div>
                <div className="text-slate-400 text-lg">(Home)</div>
              </div>
              <div className="text-2xl font-bold whitespace-nowrap">
                {setsWon.home} - {setsWon.away}
              </div>
              <div className="text-left min-w-0 bg-red-900/30 border-2 border-red-700 rounded-lg p-3">
                <div className="font-bold text-lg truncate">{awayTeam.name}</div>
                <div className="text-slate-400 text-lg">(Away)</div>
              </div>
            </div>
            <div className="text-lg text-slate-400 text-center">
              Best of {config.bestOf} | Match Complete
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="max-w-5xl mx-auto px-4 pt-4 flex flex-col gap-2">
        {canStartNextSet && (
          <button
            onClick={() => {
              advanceToNextSet();
              navigate(`/lineup/${currentSetIndex + 1}`);
            }}
            className="w-full animate-gold-pulse text-white px-4 py-3 rounded-lg text-lg font-bold text-center"
          >
            Start Set {currentSetIndex + 2}
          </button>
        )}
        {state.scoresheetType === 'cif' ? (
          <button
            onClick={handleCifPdf}
            disabled={cifLoading}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white px-4 py-3 rounded-lg text-lg font-bold transition-colors"
          >
            {cifLoading ? 'Generating...' : 'CIF Scoresheet PDF'}
          </button>
        ) : (
          <ScoresheetPdfDownload fullWidth label="USAV Scoresheet PDF" />
        )}
        <button
          onClick={() => navigate('/match-log')}
          className="w-full bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-lg font-bold transition-colors"
        >
          Match Log
        </button>
      </div>

      {/* Set navigation buttons */}
      {setsPlayed.length > 1 && (
        <div className="max-w-5xl mx-auto px-4 pt-3 flex gap-2">
          {setsPlayed.map((si) => {
            const sc = getSetScore(events, si);
            return (
              <button
                key={si}
                onClick={() => document.getElementById(`set-${si}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-base font-bold transition-colors"
              >
                Set {si + 1} <span className="text-slate-400 font-normal">({sc.home}-{sc.away})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sets */}
      <div className="max-w-5xl mx-auto p-4">
        {setsPlayed.map((si) => (
          <div key={si} id={`set-${si}`}>
            <ScoresheetSet summary={getSetSummary(state, si)} state={state} />
          </div>
        ))}
      </div>

    </div>
  );
}
