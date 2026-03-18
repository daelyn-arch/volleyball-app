import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import EventLog from '@/components/scoring/EventLog';

export default function MatchLogPage() {
  const navigate = useNavigate();
  const { events, currentSetIndex, homeTeam, awayTeam } = useMatchStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumbTop, setThumbTop] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [showThumb, setShowThumb] = useState(false);

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !trackRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight) {
      setShowThumb(false);
      return;
    }
    setShowThumb(true);
    const trackHeight = trackRef.current.clientHeight;
    const ratio = clientHeight / scrollHeight;
    const height = Math.max(ratio * trackHeight, 24);
    const top = (scrollTop / (scrollHeight - clientHeight)) * (trackHeight - height);
    setThumbHeight(height);
    setThumbTop(top);
  }, []);

  useEffect(() => {
    updateThumb();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateThumb, { passive: true });
    window.addEventListener('resize', updateThumb);
    return () => {
      el.removeEventListener('scroll', updateThumb);
      window.removeEventListener('resize', updateThumb);
    };
  }, [updateThumb, events]);

  return (
    <div className="h-dvh flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between gap-2 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap shrink-0"
        >
          Back
        </button>
        <h1 className="text-xl font-bold whitespace-nowrap">Match Log</h1>
      </div>

      {/* Full-height scrollable log with custom scrollbar */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto scrollbar-none">
          <EventLog events={events} setIndex={currentSetIndex} homeTeam={homeTeam} awayTeam={awayTeam} />
        </div>

        {/* Scroll indicator — centered, 1/3 height */}
        {showThumb && (
          <div
            ref={trackRef}
            className="absolute right-1.5 pointer-events-none"
            style={{ top: '33%', height: '33%' }}
          >
            <div
              className="w-1 rounded-full bg-slate-500/60"
              style={{ position: 'absolute', top: thumbTop, height: thumbHeight }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
