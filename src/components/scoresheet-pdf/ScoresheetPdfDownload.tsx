import { useState } from 'react';
import { useMatchStore } from '@/store/matchStore';
import { useDialog } from '@/components/ThemedDialog';

export default function ScoresheetPdfDownload({ fullWidth }: { fullWidth?: boolean }) {
  const [loading, setLoading] = useState(false);
  const { showAlert } = useDialog();

  async function handleDownload() {
    setLoading(true);
    try {
      const { downloadScoresheet } = await import('@/utils/pdfFill');
      const state = useMatchStore.getState();
      await downloadScoresheet(state);
    } catch (err) {
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
      className={`bg-blue-600 hover:bg-blue-500 disabled:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors${fullWidth ? ' w-full' : ''}`}
    >
      {loading ? 'Generating...' : 'Download PDF'}
    </button>
  );
}
