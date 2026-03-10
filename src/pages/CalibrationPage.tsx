import { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface MarkedPoint {
  id: string;
  label: string;
  pdfX: number; // PDF coordinate (bottom-left origin)
  pdfY: number;
  canvasX: number; // For display only
  canvasY: number;
}

const TEMPLATES = [
  { name: 'Non-Deciding (2-set)', file: '/Non-deciding-two-set-scoresheet.pdf' },
  { name: 'Deciding Set', file: '/deciding_set_scoresheet.pdf' },
];

// Predefined field categories for quick labeling
const FIELD_CATEGORIES = [
  'team_name_home',
  'team_name_away',
  'lineup_home_I', 'lineup_home_II', 'lineup_home_III',
  'lineup_home_IV', 'lineup_home_V', 'lineup_home_VI',
  'lineup_away_I', 'lineup_away_II', 'lineup_away_III',
  'lineup_away_IV', 'lineup_away_V', 'lineup_away_VI',
  'running_score', // will be followed by _home_1 through _home_25 etc
  'service_round',
  'sub_area',
  'timeout_area',
  'libero_area',
  'custom',
];

export default function CalibrationPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [points, setPoints] = useState<MarkedPoint[]>([]);
  const [currentLabel, setCurrentLabel] = useState('');
  const [pdfSize, setPdfSize] = useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = useState({ pdfX: 0, pdfY: 0 });
  const [mode, setMode] = useState<'click' | 'grid'>('click');
  const [gridStart, setGridStart] = useState<{ x: number; y: number } | null>(null);
  const [gridEnd, setGridEnd] = useState<{ x: number; y: number } | null>(null);
  const [gridRows, setGridRows] = useState(1);
  const [gridCols, setGridCols] = useState(25);
  const [gridPrefix, setGridPrefix] = useState('running_score_home_set1_');
  const [loading, setLoading] = useState(false);

  // Load and render PDF
  const renderPdf = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setLoading(true);

    try {
      const pdf = await pdfjsLib.getDocument(TEMPLATES[selectedTemplate].file).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPdfSize({ width: page.getViewport({ scale: 1 }).width, height: page.getViewport({ scale: 1 }).height });

      await page.render({ canvas, viewport }).promise;

      // Size overlay to match
      const overlay = overlayRef.current;
      if (overlay) {
        overlay.width = viewport.width;
        overlay.height = viewport.height;
      }
    } catch (err) {
      console.error('Failed to render PDF:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate, scale]);

  useEffect(() => {
    renderPdf();
  }, [renderPdf]);

  // Redraw overlay with marked points
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    for (const pt of points) {
      const cx = pt.pdfX * scale;
      const cy = (pdfSize.height - pt.pdfY) * scale; // flip Y

      // Red dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.fill();

      // Label
      ctx.font = '10px monospace';
      ctx.fillStyle = 'red';
      ctx.fillText(pt.label, cx + 6, cy - 4);
    }

    // Draw grid preview if in grid mode with both points
    if (mode === 'grid' && gridStart && gridEnd) {
      ctx.strokeStyle = 'rgba(0, 200, 0, 0.6)';
      ctx.lineWidth = 1;
      const sx = gridStart.x * scale;
      const sy = (pdfSize.height - gridStart.y) * scale;
      const ex = gridEnd.x * scale;
      const ey = (pdfSize.height - gridEnd.y) * scale;
      ctx.strokeRect(sx, sy, ex - sx, ey - sy);

      // Grid lines
      const cellW = (ex - sx) / gridCols;
      const cellH = (ey - sy) / gridRows;
      ctx.strokeStyle = 'rgba(0, 200, 0, 0.3)';
      for (let c = 1; c < gridCols; c++) {
        ctx.beginPath();
        ctx.moveTo(sx + c * cellW, sy);
        ctx.lineTo(sx + c * cellW, ey);
        ctx.stroke();
      }
      for (let r = 1; r < gridRows; r++) {
        ctx.beginPath();
        ctx.moveTo(sx, sy + r * cellH);
        ctx.lineTo(ex, sy + r * cellH);
        ctx.stroke();
      }
    }
  }, [points, pdfSize, scale, mode, gridStart, gridEnd, gridRows, gridCols]);

  function canvasToPixelCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = overlayRef.current!;
    const rect = canvas.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const pdfX = canvasX / scale;
    const pdfY = pdfSize.height - canvasY / scale; // flip Y back to PDF coords
    return { canvasX, canvasY, pdfX, pdfY };
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const { canvasX, canvasY, pdfX, pdfY } = canvasToPixelCoords(e);

    if (mode === 'click') {
      if (!currentLabel) {
        alert('Enter a label first');
        return;
      }
      const pt: MarkedPoint = {
        id: Date.now().toString(36),
        label: currentLabel,
        pdfX: Math.round(pdfX * 100) / 100,
        pdfY: Math.round(pdfY * 100) / 100,
        canvasX,
        canvasY,
      };
      setPoints((prev) => [...prev, pt]);
    } else if (mode === 'grid') {
      if (!gridStart) {
        setGridStart({ x: pdfX, y: pdfY });
      } else if (!gridEnd) {
        setGridEnd({ x: pdfX, y: pdfY });
      }
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const { pdfX, pdfY } = canvasToPixelCoords(e);
    setMousePos({ pdfX: Math.round(pdfX * 10) / 10, pdfY: Math.round(pdfY * 10) / 10 });
  }

  function applyGrid() {
    if (!gridStart || !gridEnd || !gridPrefix) return;

    const newPoints: MarkedPoint[] = [];
    const cellW = (gridEnd.x - gridStart.x) / gridCols;
    const cellH = (gridEnd.y - gridStart.y) / gridRows;

    let idx = 1;
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        // Center of each cell
        const pdfX = gridStart.x + (c + 0.5) * cellW;
        const pdfY = gridStart.y + (r + 0.5) * cellH;
        newPoints.push({
          id: Date.now().toString(36) + idx,
          label: gridPrefix + idx,
          pdfX: Math.round(pdfX * 100) / 100,
          pdfY: Math.round(pdfY * 100) / 100,
          canvasX: pdfX * scale,
          canvasY: (pdfSize.height - pdfY) * scale,
        });
        idx++;
      }
    }

    setPoints((prev) => [...prev, ...newPoints]);
    setGridStart(null);
    setGridEnd(null);
  }

  function removeLastPoint() {
    setPoints((prev) => prev.slice(0, -1));
  }

  function exportJSON() {
    const templateName = TEMPLATES[selectedTemplate].name;
    const data = {
      template: templateName,
      file: TEMPLATES[selectedTemplate].file,
      pdfWidth: pdfSize.width,
      pdfHeight: pdfSize.height,
      fields: points.map((p) => ({
        label: p.label,
        x: p.pdfX,
        y: p.pdfY,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coordinates_${templateName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyJSON() {
    const data = points.map((p) => ({
      label: p.label,
      x: p.pdfX,
      y: p.pdfY,
    }));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  }

  return (
    <div className="flex h-screen bg-slate-900 text-white">
      {/* Left panel - controls */}
      <div className="w-80 shrink-0 bg-slate-800 p-4 overflow-y-auto flex flex-col gap-4 border-r border-slate-700">
        <h1 className="text-xl font-bold">PDF Calibration Tool</h1>

        {/* Template selector */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Template</label>
          <select
            value={selectedTemplate}
            onChange={(e) => {
              setSelectedTemplate(Number(e.target.value));
              setPoints([]);
              setGridStart(null);
              setGridEnd(null);
            }}
            className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm"
          >
            {TEMPLATES.map((t, i) => (
              <option key={i} value={i}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Zoom */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Zoom: {scale}x</label>
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.25"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Mouse position */}
        <div className="bg-slate-700 rounded px-3 py-2 text-xs font-mono">
          PDF coords: ({mousePos.pdfX}, {mousePos.pdfY})
        </div>

        {/* Mode */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => { setMode('click'); setGridStart(null); setGridEnd(null); }}
              className={`flex-1 py-2 rounded text-sm font-semibold ${
                mode === 'click' ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              Single Click
            </button>
            <button
              onClick={() => setMode('grid')}
              className={`flex-1 py-2 rounded text-sm font-semibold ${
                mode === 'grid' ? 'bg-green-600' : 'bg-slate-700'
              }`}
            >
              Grid Select
            </button>
          </div>
        </div>

        {mode === 'click' ? (
          <>
            {/* Label input */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Field Label</label>
              <input
                type="text"
                value={currentLabel}
                onChange={(e) => setCurrentLabel(e.target.value)}
                placeholder="e.g. lineup_home_I"
                className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm"
              />
            </div>

            {/* Quick labels */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Quick Labels</label>
              <div className="flex flex-wrap gap-1">
                {FIELD_CATEGORIES.slice(0, 14).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCurrentLabel(cat)}
                    className={`text-xs px-2 py-1 rounded ${
                      currentLabel === cat ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {cat.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Grid controls */}
            <div className="bg-slate-700 rounded p-3 text-sm">
              <p className="text-xs text-slate-400 mb-2">
                {!gridStart
                  ? 'Click the TOP-LEFT corner of the grid area'
                  : !gridEnd
                  ? 'Click the BOTTOM-RIGHT corner'
                  : 'Configure grid and apply'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Cols</label>
                  <input
                    type="number"
                    value={gridCols}
                    onChange={(e) => setGridCols(Number(e.target.value))}
                    className="w-full bg-slate-600 rounded px-2 py-1 text-sm"
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Rows</label>
                  <input
                    type="number"
                    value={gridRows}
                    onChange={(e) => setGridRows(Number(e.target.value))}
                    className="w-full bg-slate-600 rounded px-2 py-1 text-sm"
                    min={1}
                  />
                </div>
              </div>
              <div className="mt-2">
                <label className="text-xs text-slate-400">Label Prefix</label>
                <input
                  type="text"
                  value={gridPrefix}
                  onChange={(e) => setGridPrefix(e.target.value)}
                  className="w-full bg-slate-600 rounded px-2 py-1 text-sm"
                />
              </div>
              {gridStart && gridEnd && (
                <button
                  onClick={applyGrid}
                  className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded text-sm font-semibold"
                >
                  Apply Grid ({gridRows * gridCols} points)
                </button>
              )}
              {gridStart && (
                <button
                  onClick={() => { setGridStart(null); setGridEnd(null); }}
                  className="mt-1 w-full bg-slate-600 text-white py-1 rounded text-xs"
                >
                  Reset Grid Selection
                </button>
              )}
            </div>
          </>
        )}

        <hr className="border-slate-600" />

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={removeLastPoint}
            disabled={points.length === 0}
            className="flex-1 bg-orange-700 hover:bg-orange-600 disabled:bg-slate-700 text-white py-2 rounded text-sm"
          >
            Undo Last
          </button>
          <button
            onClick={() => setPoints([])}
            disabled={points.length === 0}
            className="flex-1 bg-red-700 hover:bg-red-600 disabled:bg-slate-700 text-white py-2 rounded text-sm"
          >
            Clear All
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportJSON}
            disabled={points.length === 0}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white py-2 rounded text-sm font-semibold"
          >
            Export JSON
          </button>
          <button
            onClick={copyJSON}
            disabled={points.length === 0}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white py-2 rounded text-sm"
          >
            Copy
          </button>
        </div>

        {/* Point list */}
        <div>
          <div className="text-xs text-slate-400 mb-1">{points.length} points marked</div>
          <div className="max-h-60 overflow-y-auto bg-slate-900 rounded p-2 text-xs font-mono">
            {points.map((p, i) => (
              <div key={p.id} className="flex justify-between py-0.5 hover:bg-slate-800">
                <span className="text-blue-300 truncate mr-2">{p.label}</span>
                <span className="text-slate-400 shrink-0">({p.pdfX}, {p.pdfY})</span>
              </div>
            ))}
            {points.length === 0 && (
              <span className="text-slate-500">Click on the PDF to mark fields</span>
            )}
          </div>
        </div>
      </div>

      {/* Right - PDF canvas */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="text-slate-400 text-center py-8">Loading PDF...</div>
        )}
        <div className="relative inline-block">
          <canvas ref={canvasRef} className="block" />
          <canvas
            ref={overlayRef}
            className="absolute top-0 left-0 cursor-crosshair"
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
          />
        </div>
      </div>
    </div>
  );
}
