import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import { getSetsWon, getSetScore } from '@/store/derived';
import { isSetComplete } from '@/utils/scoring';
import { getPdfStyle } from '@/utils/pdfStyleSetting';
import CifSheet from '@/components/cif/CifSheet';

export default function CifScoresheetViewPage() {
  const navigate = useNavigate();
  const state = useMatchStore();
  const { homeTeam, awayTeam, config, events, currentSetIndex, matchComplete, advanceToNextSet } = state;
  const setsWon = getSetsWon(state);
  const score = getSetScore(events, currentSetIndex);
  const setComplete = isSetComplete(score, currentSetIndex, config);
  const canStartNextSet = setComplete && !matchComplete;
  const printRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const setsPlayed: number[] = [];
  for (let i = 0; i <= currentSetIndex; i++) {
    setsPlayed.push(i);
  }

  async function handleDownloadPdf() {
    setPdfLoading(true);
    try {
      if (getPdfStyle() === 'official') {
        const { downloadCifScoresheet } = await import('@/utils/cifPdfFill');
        await downloadCifScoresheet(useMatchStore.getState());
      } else {
        const { downloadCifPdf } = await import('@/components/scoresheet-pdf/generateCifPdf');
        await downloadCifPdf();
      }
    } catch (err: any) {
      // If official PDF fails (e.g. template missing), fall back to custom
      if (getPdfStyle() === 'official') {
        console.warn('Official CIF PDF failed, falling back to custom:', err);
        try {
          const { downloadCifPdf } = await import('@/components/scoresheet-pdf/generateCifPdf');
          await downloadCifPdf();
          return;
        } catch { /* fallthrough to error */ }
      }
      console.error('CIF PDF generation failed:', err);
      alert('PDF generation failed: ' + (err?.message || err));
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="min-h-full">
      {/* Header — hidden when printing */}
      <div className="bg-slate-800 px-4 py-3 flex items-center gap-2 relative print:hidden">
        <button
          onClick={() => navigate(matchComplete ? '/' : '/scoring')}
          className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-lg font-bold transition-colors whitespace-nowrap shrink-0"
        >
          {matchComplete ? 'Home' : 'Back'}
        </button>
        <h1 className="text-xl font-bold whitespace-nowrap absolute left-1/2 -translate-x-1/2">CIF Scoresheet</h1>
        <div className="ml-auto flex gap-2 shrink-0">
          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-500 text-white px-4 py-2 rounded-lg text-lg font-bold transition-colors whitespace-nowrap"
          >
            {pdfLoading ? 'Generating...' : 'PDF'}
          </button>
          {!matchComplete && (
            <button
              onClick={() => navigate('/')}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-lg font-bold transition-colors whitespace-nowrap"
            >
              Leave
            </button>
          )}
        </div>
      </div>

      {/* Match header when complete */}
      {matchComplete && (
        <div className="p-4 border-b border-slate-700 print:hidden">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="text-right min-w-0 bg-blue-900/30 border-2 border-blue-600 rounded-lg p-3">
                <div className="font-bold text-lg truncate">{homeTeam.name}</div>
              </div>
              <div className="text-2xl font-bold whitespace-nowrap">
                {setsWon.home} - {setsWon.away}
              </div>
              <div className="text-left min-w-0 bg-red-900/30 border-2 border-red-700 rounded-lg p-3">
                <div className="font-bold text-lg truncate">{awayTeam.name}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Next set button */}
      {canStartNextSet && (
        <div className="p-4 text-center print:hidden">
          <button
            onClick={() => { advanceToNextSet(); navigate(`/lineup/${currentSetIndex + 1}`); }}
            className="bg-green-600 hover:bg-green-700 text-white text-xl font-bold px-8 py-3 rounded-xl transition-colors"
          >
            Start Set {currentSetIndex + 2}
          </button>
        </div>
      )}

      {/* CIF Sheets for each set played */}
      <div ref={printRef} className="p-4 overflow-x-auto">
        <div className="flex flex-col gap-6">
          {setsPlayed.map((si) => (
            <CifSheet key={si} state={state} setIndex={si} />
          ))}
        </div>
      </div>
    </div>
  );
}
