import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import type { ScoresheetType } from '@/types/match';

export default function ScoresheetTypePage() {
  const navigate = useNavigate();
  const setScoresheetType = useMatchStore((s) => s.setScoresheetType);

  function handleSelect(type: ScoresheetType) {
    setScoresheetType(type);
    navigate('/setup');
  }

  return (
    <div className="flex flex-col items-center justify-center h-dvh p-8 gap-8">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-lg font-bold transition-colors"
        >
          &larr;
        </button>
        <h1 className="text-3xl font-bold text-white">Scoresheet Type</h1>
      </div>
      <p className="text-slate-400 text-lg text-center max-w-md">
        Choose a scoring format for this match.
      </p>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <button
          onClick={() => handleSelect('usav')}
          className="bg-blue-700 hover:bg-blue-600 text-white text-xl font-semibold py-6 px-8 rounded-xl transition-colors text-left"
        >
          <span className="block text-2xl font-bold">USAV</span>
          <span className="block text-sm font-normal text-blue-200 mt-1">
            Standard scoring with rotation grid display
          </span>
        </button>

        <button
          onClick={() => handleSelect('cif')}
          className="bg-emerald-700 hover:bg-emerald-600 text-white text-xl font-semibold py-6 px-8 rounded-xl transition-colors text-left"
        >
          <span className="block text-2xl font-bold">CIF</span>
          <span className="block text-sm font-normal text-emerald-200 mt-1">
            Visual scoresheet with running score, service terms, and mark symbols
          </span>
        </button>
      </div>
    </div>
  );
}
