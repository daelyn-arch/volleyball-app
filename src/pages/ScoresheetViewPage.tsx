import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import { getSetSummary, getSetsWon, getSetScore } from '@/store/derived';
import ScoresheetSet from '@/components/scoresheet/ScoresheetSet';
import ScoresheetPdfDownload from '@/components/scoresheet-pdf/ScoresheetPdfDownload';
import PdfPreview from '@/components/scoring/PdfPreview';

export default function ScoresheetViewPage() {
  const navigate = useNavigate();
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const state = useMatchStore();
  const { homeTeam, awayTeam, config, currentSetIndex, matchComplete } = state;
  const setsWon = getSetsWon(state);

  // Include all sets up to and including the current one
  const setsPlayed: number[] = [];
  for (let i = 0; i <= currentSetIndex; i++) {
    setsPlayed.push(i);
  }

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between gap-2">
        <button
          onClick={() => navigate(matchComplete ? '/' : '/scoring')}
          className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap shrink-0"
        >
          {matchComplete ? 'Home' : 'Back to Scoring'}
        </button>
        <h1 className="text-xl font-bold whitespace-nowrap">Scoresheet</h1>
      </div>

      {/* Match Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-2">
            <div className="text-right min-w-0 bg-blue-900/30 border-2 border-blue-600 rounded-lg p-3">
              <div className="font-bold text-lg truncate">{homeTeam.name}</div>
              <div className="text-slate-400 text-sm">(Home)</div>
            </div>
            <div className="text-2xl font-bold whitespace-nowrap">
              {setsWon.home} - {setsWon.away}
            </div>
            <div className="text-left min-w-0 bg-red-900/30 border-2 border-red-700 rounded-lg p-3">
              <div className="font-bold text-lg truncate">{awayTeam.name}</div>
              <div className="text-slate-400 text-sm">(Away)</div>
            </div>
          </div>
          <div className="text-sm text-slate-400 text-center">
            Best of {config.bestOf} | {matchComplete ? 'Match Complete' : 'In Progress'}
          </div>
        </div>
      </div>

      {/* PDF Actions */}
      <div className="max-w-5xl mx-auto px-4 pt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => setShowPdfPreview(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
        >
          Preview PDF
        </button>
        <ScoresheetPdfDownload fullWidth />
      </div>

      {/* Sets */}
      <div className="max-w-5xl mx-auto p-4">
        {setsPlayed.map((si) => (
          <ScoresheetSet key={si} summary={getSetSummary(state, si)} state={state} />
        ))}
      </div>

      {showPdfPreview && (
        <PdfPreview onClose={() => setShowPdfPreview(false)} />
      )}
    </div>
  );
}
