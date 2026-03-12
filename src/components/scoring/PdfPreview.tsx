import { useState, useEffect, useRef } from 'react';
import { useMatchStore } from '@/store/matchStore';

interface Props {
  onClose: () => void;
}

export default function PdfPreview({ onClose }: Props) {
  const [generating, setGenerating] = useState(true);
  const [error, setError] = useState('');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const events = useMatchStore((s) => s.events);
  const currentSetIndex = useMatchStore((s) => s.currentSetIndex);

  useEffect(() => {
    let cancelled = false;
    const generate = async () => {
      setGenerating(true);
      setError('');
      try {
        const { fillScoresheet } = await import('@/utils/pdfFill');
        const state = useMatchStore.getState();
        const blob = await fillScoresheet(state);

        if (cancelled) return;

        // Clean up old blob URL
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to generate preview');
      } finally {
        if (!cancelled) setGenerating(false);
      }
    };

    const timer = setTimeout(generate, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [events.length, currentSetIndex]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-bold text-lg">Scoresheet Preview</h2>
          {generating && <span className="text-yellow-400 text-sm">Updating...</span>}
        </div>
        <button
          onClick={onClose}
          className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          Close
        </button>
      </div>

      {/* PDF Display */}
      <div className="flex-1 overflow-auto p-2 flex justify-center">
        {error ? (
          <div className="text-red-400 text-center mt-8">{error}</div>
        ) : blobUrl ? (
          <iframe
            src={blobUrl}
            className="w-full h-full rounded shadow-lg bg-white"
            title="Scoresheet Preview"
          />
        ) : (
          <div className="text-slate-400 text-center mt-8">Generating...</div>
        )}
      </div>
    </div>
  );
}
