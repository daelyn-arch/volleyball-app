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
    <div className="min-h-full bg-white text-black">
      {/* Header */}
      <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between gap-2">
        <button
          onClick={() => navigate(matchComplete ? '/' : '/scoring')}
          className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap shrink-0"
        >
          {matchComplete ? 'Home' : 'Back to Scoring'}
        </button>
        <h1 className="text-xl font-bold whitespace-nowrap">Scoresheet</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPdfPreview(true)}
            className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap"
          >
            Preview
          </button>
          <ScoresheetPdfDownload />
        </div>
      </div>

      {/* Match Header */}
      <div className="p-4 border-b-2 border-black">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-2">
            <div className="text-right min-w-0">
              <div className="font-bold text-lg truncate">{homeTeam.name}</div>
              <div className="text-gray-500 text-sm">(Home)</div>
            </div>
            <div className="text-2xl font-bold whitespace-nowrap">
              {setsWon.home} - {setsWon.away}
            </div>
            <div className="text-left min-w-0">
              <div className="font-bold text-lg truncate">{awayTeam.name}</div>
              <div className="text-gray-500 text-sm">(Away)</div>
            </div>
          </div>
          <div className="text-sm text-gray-500 text-center">
            Best of {config.bestOf} | {matchComplete ? 'Match Complete' : 'In Progress'}
          </div>
        </div>
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
