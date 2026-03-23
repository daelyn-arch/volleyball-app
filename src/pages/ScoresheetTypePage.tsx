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
      <div className="flex flex-col gap-4 w-full max-w-sm mx-auto">
        <button
          onClick={() => handleSelect('usav')}
          className="bg-blue-700 hover:bg-blue-600 text-white text-xl font-semibold py-5 px-8 rounded-xl transition-colors"
        >
          USAV
        </button>

        <button
          onClick={() => handleSelect('cif')}
          className="bg-emerald-700 hover:bg-emerald-600 text-white text-xl font-semibold py-5 px-8 rounded-xl transition-colors"
        >
          CIF
        </button>
      </div>
    </div>
  );
}
