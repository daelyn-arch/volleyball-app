import { useState, useEffect, useRef, useCallback } from 'react';
import { useMatchStore } from '@/store/matchStore';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface Props {
  onClose: () => void;
}

export default function PdfPreview({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const blobUrlRef = useRef<string | null>(null);

  // Subscribe to the parts of state that affect the PDF
  const events = useMatchStore((s) => s.events);
  const currentSetIndex = useMatchStore((s) => s.currentSetIndex);

  const generateAndRender = useCallback(async () => {
    setGenerating(true);
    setError('');
    try {
      const { fillScoresheet } = await import('@/utils/pdfFill');
      const state = useMatchStore.getState();
      const blob = await fillScoresheet(state);
      const arrayBuffer = await blob.arrayBuffer();

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setNumPages(pdf.numPages);

      const currentPage = Math.min(page, pdf.numPages);
      const pdfPage = await pdf.getPage(currentPage);

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Scale to fit the container width
      const containerWidth = canvas.parentElement?.clientWidth || 600;
      const viewport = pdfPage.getViewport({ scale: 1 });
      const scale = (containerWidth - 16) / viewport.width; // 16px padding
      const scaledViewport = pdfPage.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await pdfPage.render({
        canvasContext: ctx,
        viewport: scaledViewport,
        canvas,
      } as any).promise;

      // Clean up old blob URL
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = URL.createObjectURL(blob);
    } catch (e: any) {
      setError(e.message || 'Failed to generate preview');
    } finally {
      setGenerating(false);
    }
  }, [page]);

  // Debounced regeneration on state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      generateAndRender();
    }, 500);
    return () => clearTimeout(timer);
  }, [events.length, currentSetIndex, page, generateAndRender]);

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
        <div className="flex items-center gap-2">
          {numPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-2 py-1 rounded text-sm"
              >
                Prev
              </button>
              <span className="text-slate-300 text-sm px-2">
                {page} / {numPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(numPages, p + 1))}
                disabled={page >= numPages}
                className="bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-2 py-1 rounded text-sm"
              >
                Next
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-2 flex justify-center">
        {error ? (
          <div className="text-red-400 text-center mt-8">{error}</div>
        ) : (
          <canvas ref={canvasRef} className="bg-white rounded shadow-lg max-w-full" />
        )}
      </div>
    </div>
  );
}
