import { useState } from 'react';
import { useMatchStore } from '@/store/matchStore';

export default function ScoresheetPdfDownload() {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const { downloadScoresheet } = await import('@/utils/pdfFill');
      const state = useMatchStore.getState();
      await downloadScoresheet(state);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed. See console for details.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
    >
      {loading ? 'Generating...' : 'Download PDF'}
    </button>
  );
}
