import { useState } from 'react';
import { useMatchStore } from '@/store/matchStore';
import { useDialog } from '@/components/ThemedDialog';
import { getPdfStyle } from '@/utils/pdfStyleSetting';

export default function ScoresheetPdfDownload({ fullWidth, label }: { fullWidth?: boolean; label?: string }) {
  const [loading, setLoading] = useState(false);
  const { showAlert } = useDialog();

  async function handleDownload() {
    setLoading(true);
    try {
      if (getPdfStyle() === 'custom') {
        const { generatePdf } = await import('./generatePdf');
        await generatePdf();
      } else {
        const { downloadScoresheet } = await import('@/utils/pdfFill');
        const state = useMatchStore.getState();
        await downloadScoresheet(state);
      }
    } catch (err) {
      // Fallback: if custom fails, try official; if official fails, try custom
      try {
        if (getPdfStyle() === 'custom') {
          const { downloadScoresheet } = await import('@/utils/pdfFill');
          await downloadScoresheet(useMatchStore.getState());
        } else {
          const { generatePdf } = await import('./generatePdf');
          await generatePdf();
        }
        return;
      } catch { /* fallthrough */ }
      console.error('PDF generation failed:', err);
      showAlert('PDF Error', 'PDF generation failed. See console for details.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className={`bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white px-4 py-2 rounded-lg text-lg font-bold transition-colors${fullWidth ? ' w-full' : ''}`}
    >
      {loading ? 'Generating...' : (label || 'Download PDF')}
    </button>
  );
}
