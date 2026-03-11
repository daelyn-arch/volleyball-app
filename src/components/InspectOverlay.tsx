import { useState, useEffect, useCallback, useRef } from 'react';

interface ElementInfo {
  name: string;
  rect: { x: number; y: number; width: number; height: number };
}

/** Walk up the DOM to find the nearest element with a data-name attribute */
function findNamedElement(el: HTMLElement): { name: string; el: HTMLElement } | null {
  let current: HTMLElement | null = el;
  for (let i = 0; i < 10 && current; i++) {
    const name = current.getAttribute('data-name');
    if (name) return { name, el: current };
    current = current.parentElement;
  }
  return null;
}

export default function InspectOverlay() {
  const [active, setActive] = useState(false);
  const [hovered, setHovered] = useState<ElementInfo | null>(null);
  const [selected, setSelected] = useState<ElementInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      setHovered(null);
      return;
    }

    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el || overlayRef.current?.contains(el)) {
        setHovered(null);
        return;
      }
      const named = findNamedElement(el);
      if (named) {
        const rect = named.el.getBoundingClientRect();
        setHovered({
          name: named.name,
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        });
      } else {
        setHovered(null);
      }
    };

    const onClick = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el || overlayRef.current?.contains(el)) return;
      e.preventDefault();
      e.stopPropagation();
      const named = findNamedElement(el);
      if (named) {
        const rect = named.el.getBoundingClientRect();
        setSelected({
          name: named.name,
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        });
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('click', onClick, true);
    };
  }, [active]);

  const copyInfo = useCallback(() => {
    if (!selected) return;
    navigator.clipboard.writeText(selected.name);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [selected]);

  return (
    <div ref={overlayRef}>
      {/* Toggle Button */}
      <button
        onClick={() => { setActive(a => !a); setSelected(null); }}
        className={`fixed bottom-4 right-4 z-[9999] px-3 py-2 rounded-lg text-xs font-bold shadow-lg transition-colors ${
          active
            ? 'bg-pink-600 text-white ring-2 ring-pink-400'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }`}
      >
        {active ? 'INSPECT ON' : 'INSPECT'}
      </button>

      {/* Hover Highlight */}
      {active && hovered && (
        <div
          className="fixed pointer-events-none z-[9998] border-2 border-pink-500 bg-pink-500/10"
          style={{
            left: hovered.rect.x,
            top: hovered.rect.y,
            width: hovered.rect.width,
            height: hovered.rect.height,
          }}
        >
          <div className="absolute -top-6 left-0 bg-pink-600 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap font-bold">
            {hovered.name}
          </div>
        </div>
      )}

      {/* Selected Info Panel */}
      {active && selected && (
        <div className="fixed bottom-14 right-4 z-[9999] bg-slate-900 border border-pink-500 rounded-lg p-3 w-64 shadow-xl">
          <div className="flex justify-between items-center">
            <span className="text-pink-400 font-bold text-sm">{selected.name}</span>
            <div className="flex gap-1">
              <button
                onClick={copyInfo}
                className="bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded text-[10px]"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={() => setSelected(null)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded text-[10px]"
              >
                X
              </button>
            </div>
          </div>
          <div className="text-slate-500 text-xs mt-1">
            {selected.rect.width}x{selected.rect.height}
          </div>
        </div>
      )}
    </div>
  );
}
