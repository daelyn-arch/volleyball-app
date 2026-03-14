import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMatchStore } from '@/store/matchStore';
import { getSetScore } from '@/store/derived';
import { getSetWinner } from '@/utils/scoring';
import type { CourtPosition, Lineup, TeamSide, Player } from '@/types/match';

/**
 * 2x3 grid layout matching a real volleyball lineup card:
 *
 *  ┌─────────────────────┐
 *  │       (NET)         │
 *  ├──────┬──────┬───────┤
 *  │  IV  │ III  │  II   │  ← Front row
 *  ├──────┼──────┼───────┤
 *  │  V   │  VI  │  I    │  ← Back row (I = server)
 *  └──────┴──────┴───────┘
 */
// Counter-clockwise DOM order for tab navigation, with CSS grid placement
const GRID: Array<{ pos: CourtPosition; label: string; row: number; col: number }> = [
  { pos: 1, label: 'I',   row: 2, col: 3 },
  { pos: 2, label: 'II',  row: 1, col: 3 },
  { pos: 3, label: 'III', row: 1, col: 2 },
  { pos: 4, label: 'IV',  row: 1, col: 1 },
  { pos: 5, label: 'V',   row: 2, col: 1 },
  { pos: 6, label: 'VI',  row: 2, col: 2 },
];

// Counter-clockwise position order: I → II → III → IV → V → VI → I
const CCW_ORDER: CourtPosition[] = [1, 2, 3, 4, 5, 6];

function nextPosCCW(pos: CourtPosition): CourtPosition {
  const idx = CCW_ORDER.indexOf(pos);
  return CCW_ORDER[(idx + 1) % CCW_ORDER.length];
}

function parseNumber(val: string): number | null {
  const n = parseInt(val.trim(), 10);
  return !isNaN(n) && n > 0 ? n : null;
}

export default function LineupPage() {
  const navigate = useNavigate();
  const { setIndex: setIndexParam } = useParams();
  const setIndex = parseInt(setIndexParam || '0', 10);

  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);
  const config = useMatchStore((s) => s.config);
  const events = useMatchStore((s) => s.events);
  const sets = useMatchStore((s) => s.sets);
  const setLineup = useMatchStore((s) => s.setLineup);
  const setFirstServe = useMatchStore((s) => s.setFirstServe);

  // Direct number inputs for each position (as strings for controlled inputs)
  const [homeInputs, setHomeInputs] = useState<Record<CourtPosition, string>>({
    1: '', 2: '', 3: '', 4: '', 5: '', 6: '',
  });
  const [awayInputs, setAwayInputs] = useState<Record<CourtPosition, string>>({
    1: '', 2: '', 3: '', 4: '', 5: '', 6: '',
  });

  // Bench, libero, captain as arrays/numbers
  const [homeBenchPlayers, setHomeBenchPlayers] = useState<number[]>([]);
  const [awayBenchPlayers, setAwayBenchPlayers] = useState<number[]>([]);
  const [homeLiberoPlayers, setHomeLiberoPlayers] = useState<number[]>([]);
  const [awayLiberoPlayers, setAwayLiberoPlayers] = useState<number[]>([]);
  const [homeCaptainNum, setHomeCaptainNum] = useState<number | null>(null);
  const [awayCaptainNum, setAwayCaptainNum] = useState<number | null>(null);
  const [homeActingCaptain, setHomeActingCaptain] = useState('');
  const [awayActingCaptain, setAwayActingCaptain] = useState('');
  const [firstServeTeam, setFirstServeTeam] = useState<TeamSide>('home');
  const [error, setError] = useState('');

  // Tap-to-place: selected card
  const [selectedCard, setSelectedCard] = useState<{ number: number; team: 'home' | 'away' } | null>(null);
  // Track which captain card is tapped (to reveal x)
  const [captainTapped, setCaptainTapped] = useState<'home' | 'away' | null>(null);

  // Refs for lineup grid inputs (keyed by `${team}-${pos}`)
  const gridInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Touch drag state
  const [touchDrag, setTouchDrag] = useState<{ number: number; team: 'home' | 'away'; x: number; y: number } | null>(null);
  const touchDragRef = useRef<{ number: number; team: 'home' | 'away' } | null>(null);
  const touchDragActive = useRef(false);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global touch handlers — attached to document so they work regardless of scroll position
  useEffect(() => {
    function onTouchMove(e: TouchEvent) {
      // If a card is being touched at all, prevent scroll immediately
      // This ensures the browser never commits to scrolling
      if (touchDragRef.current) {
        e.preventDefault();
      } else {
        return;
      }

      const touch = e.touches[0];
      if (touchDragActive.current) {
        setTouchDrag(prev => prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null);
      } else if (touchStartPos.current) {
        const dx = touch.clientX - touchStartPos.current.x;
        const dy = touch.clientY - touchStartPos.current.y;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          // Movement detected on a card — start drag immediately
          if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
          }
          touchDragActive.current = true;
          setTouchDrag({ ...touchDragRef.current!, x: touch.clientX, y: touch.clientY });
          touchStartPos.current = null;
        }
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
      if (!touchDragActive.current || !touchDragRef.current) {
        touchDragRef.current = null;
        touchDragActive.current = false;
        setTouchDrag(null);
        return;
      }
      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const slotEl = el?.closest('[data-slot]') as HTMLElement | null;
      if (slotEl) {
        const slotTeam = slotEl.dataset.slotTeam as 'home' | 'away';
        const slotPos = parseInt(slotEl.dataset.slot!, 10) as CourtPosition;
        if (slotTeam === touchDragRef.current.team) {
          updateInput(slotTeam, slotPos, String(touchDragRef.current.number));
          triggerFlash(slotTeam, slotPos);
        }
      }
      touchDragRef.current = null;
      touchDragActive.current = false;
      setTouchDrag(null);
    }

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Adding mode state
  const [addingField, setAddingField] = useState<string | null>(null);
  const [addingInput, setAddingInput] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  const cancellingRef = useRef(false);
  const addClickRef = useRef(false);
  const addedRef = useRef(false);


  // Pre-populate from store data (saved lineups, roster, etc.)
  useEffect(() => {
    const hasRoster = homeTeam.roster.length > 0;

    // Pre-fill lineup inputs from store if already set (e.g. demo match)
    const setData = sets[setIndex];
    if (setData?.homeLineup) {
      const h: Record<CourtPosition, string> = { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' };
      for (const pos of [1, 2, 3, 4, 5, 6] as CourtPosition[]) {
        h[pos] = String(setData.homeLineup[pos]);
      }
      setHomeInputs(h);
    }
    if (setData?.awayLineup) {
      const a: Record<CourtPosition, string> = { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' };
      for (const pos of [1, 2, 3, 4, 5, 6] as CourtPosition[]) {
        a[pos] = String(setData.awayLineup[pos]);
      }
      setAwayInputs(a);
    }
    if (setData?.firstServe) {
      setFirstServeTeam(setData.firstServe);
    }

    // Pre-populate bench/libero/captain from roster
    if (hasRoster) {
      setHomeLiberoPlayers(homeTeam.roster.filter(p => p.isLibero).map(p => p.number));
      setAwayLiberoPlayers(awayTeam.roster.filter(p => p.isLibero).map(p => p.number));

      const homeCap = homeTeam.roster.find(p => p.isCaptain);
      const awayCap = awayTeam.roster.find(p => p.isCaptain);
      if (homeCap) setHomeCaptainNum(homeCap.number);
      if (awayCap) setAwayCaptainNum(awayCap.number);

      // Bench: all non-libero roster players
      setHomeBenchPlayers(homeTeam.roster.filter(p => !p.isLibero).map(p => p.number));
      setAwayBenchPlayers(awayTeam.roster.filter(p => !p.isLibero).map(p => p.number));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (addingField && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [addingField]);

  // Derive which numbers are currently in lineup inputs
  const homeLineupNums = useMemo(() => {
    const nums = new Set<number>();
    for (const pos of [1, 2, 3, 4, 5, 6] as CourtPosition[]) {
      const n = parseNumber(homeInputs[pos]);
      if (n) nums.add(n);
    }
    return nums;
  }, [homeInputs]);

  const awayLineupNums = useMemo(() => {
    const nums = new Set<number>();
    for (const pos of [1, 2, 3, 4, 5, 6] as CourtPosition[]) {
      const n = parseNumber(awayInputs[pos]);
      if (n) nums.add(n);
    }
    return nums;
  }, [awayInputs]);

  // Visible bench = bench pool minus players already in lineup or libero list
  const homeLiberoSet = useMemo(() => new Set(homeLiberoPlayers), [homeLiberoPlayers]);
  const awayLiberoSet = useMemo(() => new Set(awayLiberoPlayers), [awayLiberoPlayers]);

  const visibleHomeBench = useMemo(
    () => homeBenchPlayers.filter(n => !homeLineupNums.has(n) && !homeLiberoSet.has(n)),
    [homeBenchPlayers, homeLineupNums, homeLiberoSet]
  );
  const visibleAwayBench = useMemo(
    () => awayBenchPlayers.filter(n => !awayLineupNums.has(n) && !awayLiberoSet.has(n)),
    [awayBenchPlayers, awayLineupNums, awayLiberoSet]
  );

  // Check if captain is in the lineup
  function isCaptainInLineup(inputs: Record<CourtPosition, string>, captainNum: number | null): boolean {
    if (!captainNum) return true;
    const lineupNums = Object.values(inputs).map(v => parseNumber(v)).filter(Boolean);
    return lineupNums.includes(captainNum);
  }

  const homeCaptainInLineup = isCaptainInLineup(homeInputs, homeCaptainNum);
  const awayCaptainInLineup = isCaptainInLineup(awayInputs, awayCaptainNum);

  // Flash animation when a card is placed in a slot
  const [flashSlot, setFlashSlot] = useState<{ key: string; team: string } | null>(null);
  function triggerFlash(team: string, pos: CourtPosition) {
    const key = `${team}-${pos}`;
    setFlashSlot({ key, team });
    setTimeout(() => setFlashSlot(null), 400);
  }

  function updateInput(
    team: 'home' | 'away',
    pos: CourtPosition,
    value: string
  ) {
    const cleaned = value.replace(/\D/g, '');
    const setter = team === 'home' ? setHomeInputs : setAwayInputs;
    setter((prev) => {
      const updated = { ...prev, [pos]: cleaned };
      // Clear any other position that has the same number
      if (cleaned) {
        for (const p of [1, 2, 3, 4, 5, 6] as CourtPosition[]) {
          if (p !== pos && updated[p] === cleaned) {
            updated[p] = '';
          }
        }
      }
      return updated;
    });
  }

  // Tap-to-place handlers
  function handleCardTap(number: number, team: 'home' | 'away') {
    if (selectedCard?.number === number && selectedCard?.team === team) {
      setSelectedCard(null);
    } else {
      setSelectedCard({ number, team });
    }
  }

  function handleSlotClick(team: 'home' | 'away', pos: CourtPosition) {
    if (selectedCard && selectedCard.team === team) {
      updateInput(team, pos, String(selectedCard.number));
      setSelectedCard(null);
      triggerFlash(team, pos);
    }
  }

  // Drag-and-drop handlers
  function handleDragStart(e: React.DragEvent, number: number, team: 'home' | 'away') {
    e.dataTransfer.setData('application/json', JSON.stringify({ number, team }));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(e: React.DragEvent, team: 'home' | 'away', pos: CourtPosition) {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.team === team && data.number) {
        updateInput(team, pos, String(data.number));
        triggerFlash(team, pos);
      }
    } catch { /* ignore invalid drops */ }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  // Touch drag handlers for mobile
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(e: React.TouchEvent, number: number, team: 'home' | 'away') {
    const touch = e.touches[0];
    touchDragRef.current = { number, team };
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    // Start drag after a short hold to distinguish from tap
    touchTimerRef.current = setTimeout(() => {
      touchDragActive.current = true;
      setTouchDrag({ number, team, x: touch.clientX, y: touch.clientY });
    }, 150);
  }

  function buildLineup(inputs: Record<CourtPosition, string>): Lineup | null {
    const lineup: Partial<Lineup> = {};
    for (const g of GRID) {
      const num = parseNumber(inputs[g.pos]);
      if (!num) return null;
      lineup[g.pos] = num;
    }
    return lineup as Lineup;
  }

  function buildRoster(
    lineup: Lineup,
    benchPlayers: number[],
    liberoPlayers: number[],
    captainNum: number | null,
    actingCaptainNum: number | null,
  ): Player[] {
    const liberoNums = new Set(liberoPlayers);
    const allNums = new Set<number>();
    const roster: Player[] = [];

    // Add starters
    for (let pos = 1; pos <= 6; pos++) {
      const num = lineup[pos as CourtPosition];
      if (!allNums.has(num)) {
        allNums.add(num);
        roster.push({
          number: num,
          isLibero: liberoNums.has(num),
          isCaptain: num === captainNum,
          isActingCaptain: num === actingCaptainNum,
        });
      }
    }

    // Add bench players
    for (const num of benchPlayers) {
      if (!allNums.has(num)) {
        allNums.add(num);
        roster.push({
          number: num,
          isLibero: liberoNums.has(num),
          isCaptain: num === captainNum,
          isActingCaptain: num === actingCaptainNum,
        });
      }
    }

    // Add liberos not already included
    for (const num of liberoNums) {
      if (!allNums.has(num)) {
        allNums.add(num);
        roster.push({ number: num, isLibero: true, isCaptain: num === captainNum });
      }
    }

    return roster;
  }

  function startAdding(field: string) {
    addedRef.current = false;
    setAddingField(field);
    setAddingInput('');
  }

  function cancelAdding() {
    cancellingRef.current = true;
    setAddingField(null);
    setAddingInput('');
    setTimeout(() => { cancellingRef.current = false; }, 100);
  }

  function addToField(field: string, num: number) {
    if (field === 'home-bench') {
      if (!homeBenchPlayers.includes(num)) setHomeBenchPlayers(prev => [...prev, num]);
    } else if (field === 'away-bench') {
      if (!awayBenchPlayers.includes(num)) setAwayBenchPlayers(prev => [...prev, num]);
    } else if (field === 'home-libero') {
      if (!homeLiberoPlayers.includes(num) && homeLiberoPlayers.length < 2) setHomeLiberoPlayers(prev => [...prev, num]);
    } else if (field === 'away-libero') {
      if (!awayLiberoPlayers.includes(num) && awayLiberoPlayers.length < 2) setAwayLiberoPlayers(prev => [...prev, num]);
    } else if (field === 'home-captain') {
      setHomeCaptainNum(num);
      setHomeActingCaptain('');
    } else if (field === 'away-captain') {
      setAwayCaptainNum(num);
      setAwayActingCaptain('');
    }
  }

  /** Called by Enter key and Add button — adds value and keeps input open (except captain). */
  function confirmAdd(field: string) {
    if (addedRef.current) return;

    const num = parseNumber(addingInput);
    setAddingInput('');

    if (num) addToField(field, num);

    const isCaptain = field.endsWith('-captain');
    if (isCaptain) {
      addedRef.current = true;
      setAddingField(null);
    } else {
      // Stay open, re-focus for next entry
      setTimeout(() => addInputRef.current?.focus(), 10);
    }
  }

  function handleBlur(field: string) {
    // Delay to let Add/Cancel button's mousedown/touchstart register first
    setTimeout(() => {
      if (cancellingRef.current || addClickRef.current) {
        addClickRef.current = false;
        return;
      }

      // Add any pending value and close
      const num = parseNumber(addingInput);
      if (num) addToField(field, num);
      setAddingInput('');
      addedRef.current = true;
      setAddingField(null);
    }, 150);
  }

  function handleSubmit() {
    setError('');

    const homeLineup = buildLineup(homeInputs);
    const awayLineup = buildLineup(awayInputs);

    if (!homeLineup) {
      setError('Fill in all 6 positions for ' + homeTeam.name);
      return;
    }
    if (!awayLineup) {
      setError('Fill in all 6 positions for ' + awayTeam.name);
      return;
    }

    // Check for duplicates within a lineup
    const homeNums = Object.values(homeLineup);
    if (new Set(homeNums).size !== 6) {
      setError(homeTeam.name + ': each position needs a different player number');
      return;
    }
    const awayNums = Object.values(awayLineup);
    if (new Set(awayNums).size !== 6) {
      setError(awayTeam.name + ': each position needs a different player number');
      return;
    }

    // Validate acting captain if captain is not in lineup
    if (homeCaptainNum && !homeCaptainInLineup && !homeActingCaptain) {
      setError(homeTeam.name + ': captain #' + homeCaptainNum + ' is not in the lineup — select an acting captain');
      return;
    }
    if (awayCaptainNum && !awayCaptainInLineup && !awayActingCaptain) {
      setError(awayTeam.name + ': captain #' + awayCaptainNum + ' is not in the lineup — select an acting captain');
      return;
    }

    const homeActingNum = parseNumber(homeActingCaptain);
    const awayActingNum = parseNumber(awayActingCaptain);

    // Build rosters
    const homeRoster = buildRoster(homeLineup, homeBenchPlayers, homeLiberoPlayers, homeCaptainNum, homeActingNum);
    const awayRoster = buildRoster(awayLineup, awayBenchPlayers, awayLiberoPlayers, awayCaptainNum, awayActingNum);

    // Update team rosters in store
    useMatchStore.setState({
      homeTeam: { ...homeTeam, roster: homeRoster },
      awayTeam: { ...awayTeam, roster: awayRoster },
    });

    setLineup(setIndex, 'home', homeLineup);
    setLineup(setIndex, 'away', awayLineup);
    setFirstServe(setIndex, firstServeTeam);
    navigate('/scoring');
  }

  function renderPlayerCard(
    num: number,
    accentColor: string,
    onRemove: () => void,
    team: 'home' | 'away',
    isDraggable: boolean,
  ) {
    const isSelected = selectedCard?.number === num && selectedCard?.team === team;
    const isBeingDragged = touchDrag?.number === num && touchDrag?.team === team;
    return (
      <div
        key={num}
        draggable={isDraggable && !isSelected}
        onDragStart={isDraggable && !isSelected ? (e) => handleDragStart(e, num, team) : undefined}
        onClick={isDraggable && !touchDrag ? (e) => { e.stopPropagation(); handleCardTap(num, team); } : undefined}
        onTouchStart={isDraggable ? (e) => handleTouchStart(e, num, team) : undefined}
        className={`flex items-center justify-center ${accentColor} rounded-lg transition-all select-none py-2.5 px-5 ${
          isDraggable ? 'cursor-grab active:cursor-grabbing' : ''
        } ${isSelected ? 'ring-2 ring-yellow-400 scale-105' : ''} ${isBeingDragged ? 'opacity-40' : ''}`}
      >
        <span className="text-white font-bold text-2xl">#{num}</span>
        {isSelected && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); setSelectedCard(null); }}
            className="ml-2 text-red-300 hover:text-red-400 font-bold text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  function renderAddSection(
    field: string,
    label: string,
    buttonLabel: string,
    items: number[],
    onRemove: (num: number) => void,
    accentColor: string,
    team: 'home' | 'away',
    options?: { draggable?: boolean; maxItems?: number },
  ) {
    const isDraggable = options?.draggable ?? false;
    const maxItems = options?.maxItems;
    const atLimit = maxItems !== undefined && items.length >= maxItems;

    // Determine the backing array length for max check (items may be filtered for bench)
    const backingLength = field.includes('libero')
      ? (team === 'home' ? homeLiberoPlayers.length : awayLiberoPlayers.length)
      : items.length;
    const addHidden = maxItems !== undefined && backingLength >= maxItems;

    return (
      <div className="mt-3">
        <label className="block text-xs text-slate-400 mb-1">
          {label}
          {maxItems !== undefined && <span className="text-slate-500"> (max {maxItems})</span>}
        </label>
        {/* Cards */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {items.map(num => renderPlayerCard(num, accentColor, () => onRemove(num), team, isDraggable))}
          </div>
        )}
        {/* Add button / input — hidden when at max */}
        {!addHidden && (
          addingField === field ? (
            <div>
              <input
                ref={addInputRef}
                type="text"
                inputMode="numeric"
                value={addingInput}
                onChange={(e) => setAddingInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); confirmAdd(field); }
                  if (e.key === 'Escape') cancelAdding();
                }}
                onBlur={() => handleBlur(field)}
                placeholder="#"
                className="w-full bg-slate-700 text-white text-lg font-bold rounded-lg px-3 py-3 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={3}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); addClickRef.current = true; }}
                  onTouchStart={() => { addClickRef.current = true; }}
                  onClick={() => { addClickRef.current = false; confirmAdd(field); }}
                  className="flex-1 bg-green-600 active:bg-green-700 text-white py-12 rounded-lg font-bold text-base transition-colors touch-manipulation"
                >
                  Add #{addingInput || '…'}
                </button>
                <button
                  type="button"
                  onMouseDown={() => { cancellingRef.current = true; }}
                  onTouchStart={() => { cancellingRef.current = true; }}
                  onClick={cancelAdding}
                  className="bg-slate-600 active:bg-slate-500 text-white w-10 py-12 rounded-lg font-bold text-xl transition-colors touch-manipulation"
                >
                  ✓
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => startAdding(field)}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm font-semibold transition-colors border border-dashed border-slate-500"
            >
              + {buttonLabel}
            </button>
          )
        )}
      </div>
    );
  }

  function renderCaptainSection(team: TeamSide) {
    const captainNum = team === 'home' ? homeCaptainNum : awayCaptainNum;
    const setCaptain = team === 'home' ? setHomeCaptainNum : setAwayCaptainNum;
    const setActing = team === 'home' ? setHomeActingCaptain : setAwayActingCaptain;
    const captainInLineup = team === 'home' ? homeCaptainInLineup : awayCaptainInLineup;
    const actingCaptain = team === 'home' ? homeActingCaptain : awayActingCaptain;
    const inputs = team === 'home' ? homeInputs : awayInputs;
    const field = `${team}-captain`;

    return (
      <>
        <div className="mt-3">
          <label className="block text-xs text-slate-400 mb-1">Captain</label>
          {/* Captain card */}
          {captainNum !== null && (
            <div className="flex flex-wrap gap-2 mb-2">
              <div
                onClick={() => setCaptainTapped(prev => prev === team ? null : team)}
                className={`flex items-center justify-center bg-yellow-700 rounded-lg py-2.5 px-5 transition-all ${captainTapped === team ? 'ring-2 ring-yellow-400 scale-105' : ''}`}
              >
                <span className="text-white font-bold text-2xl">#{captainNum}</span>
                {captainTapped === team && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCaptain(null); setActing(''); setCaptainTapped(null); }}
                    className="ml-2 text-red-300 hover:text-red-400 font-bold text-lg leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}
          {/* Add button / input */}
          {captainNum === null && (
            addingField === field ? (
              <div>
                <input
                  ref={addInputRef}
                  type="text"
                  inputMode="numeric"
                  value={addingInput}
                  onChange={(e) => setAddingInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); confirmAdd(field); }
                    if (e.key === 'Escape') cancelAdding();
                  }}
                  onBlur={() => handleBlur(field)}
                  placeholder="#"
                  className="w-full bg-slate-700 text-white text-lg font-bold rounded-lg px-3 py-3 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={3}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); addClickRef.current = true; }}
                    onTouchStart={() => { addClickRef.current = true; }}
                    onClick={() => { addClickRef.current = false; confirmAdd(field); }}
                    className="flex-1 bg-green-600 active:bg-green-700 text-white py-12 rounded-lg font-bold text-base transition-colors touch-manipulation"
                  >
                    Add #{addingInput || '…'}
                  </button>
                  <button
                    type="button"
                    onMouseDown={() => { cancellingRef.current = true; }}
                    onTouchStart={() => { cancellingRef.current = true; }}
                    onClick={cancelAdding}
                    className="bg-slate-600 active:bg-slate-500 text-white px-5 py-12 rounded-lg font-bold text-base transition-colors touch-manipulation"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startAdding(field)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm font-semibold transition-colors border border-dashed border-slate-500"
              >
                + Set Captain
              </button>
            )
          )}
        </div>

        {/* Acting Captain - shown when captain is not in lineup */}
        {captainNum !== null && !captainInLineup && (
          <div className="mt-2">
            <label className="block text-xs text-yellow-400 mb-1">
              Choose an Acting Captain (#{captainNum} not on court)
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.values(inputs)
                .map(v => parseNumber(v))
                .filter((n): n is number => n !== null)
                .map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setActing(String(num))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                      actingCaptain === String(num)
                        ? 'bg-yellow-600 text-white ring-2 ring-yellow-400'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    #{num}
                  </button>
                ))}
            </div>
          </div>
        )}
      </>
    );
  }

  function renderLineupCard(team: TeamSide, borderColor: string, teamColor: string) {
    const inputs = team === 'home' ? homeInputs : awayInputs;
    const teamData = team === 'home' ? homeTeam : awayTeam;
    const setBench = team === 'home' ? setHomeBenchPlayers : setAwayBenchPlayers;
    const liberoPlayers = team === 'home' ? homeLiberoPlayers : awayLiberoPlayers;
    const setLiberos = team === 'home' ? setHomeLiberoPlayers : setAwayLiberoPlayers;
    const visibleBench = team === 'home' ? visibleHomeBench : visibleAwayBench;

    const hasCardSelected = selectedCard?.team === team;

    return (
      <div className={`bg-slate-800 rounded-xl p-4 border-2 ${borderColor}`}>
        <h2 className={`text-xl font-bold ${teamColor} mb-3 text-center`}>
          {teamData.name}
        </h2>

        {/* Net label */}
        <div className="text-center text-xs text-slate-500 mb-2 border-b border-slate-600 pb-1">
          NET
        </div>

        {/* Tap-to-place hint */}
        {hasCardSelected && (
          <div className="text-center text-xs text-yellow-400 mb-2 animate-pulse">
            Tap a slot to place #{selectedCard!.number}
          </div>
        )}

        {/* 2x3 grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {GRID.map((g) => (
            <div
              key={g.pos}
              data-slot={g.pos}
              data-slot-team={team}
              className="flex flex-col items-center"
              style={{ gridRow: g.row, gridColumn: g.col }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, team, g.pos)}
              onClick={(e) => { e.stopPropagation(); handleSlotClick(team, g.pos); }}
            >
              <label className="text-xs text-slate-400 mb-1">{g.label}</label>
              <input
                ref={(el) => { gridInputRefs.current[`${team}-${g.pos}`] = el; }}
                type="text"
                inputMode="numeric"
                value={inputs[g.pos]}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  updateInput(team, g.pos, val);
                  // Auto-advance to next position when a valid number is entered (1-3 digits)
                  if (val && parseNumber(val)) {
                    const next = nextPosCCW(g.pos);
                    setTimeout(() => gridInputRefs.current[`${team}-${next}`]?.focus(), 10);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    // Override default tab to wrap from last position (VI) back to first (I)
                    const next = nextPosCCW(g.pos);
                    const nextInput = gridInputRefs.current[`${team}-${next}`];
                    if (nextInput) {
                      e.preventDefault();
                      nextInput.focus();
                      nextInput.select();
                    }
                  }
                }}
                onFocus={(e) => e.target.select()}
                placeholder="#"
                className={`w-full bg-slate-700 text-white text-center text-2xl font-bold rounded-lg py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 transition-all ${
                  hasCardSelected ? 'ring-2 ring-yellow-400/50 ring-dashed' : ''
                } ${flashSlot?.key === `${team}-${g.pos}` ? (flashSlot.team === 'home' ? 'animate-slot-pop-blue' : 'animate-slot-pop-red') : ''}`}
                maxLength={3}
              />
              {g.pos === 1 && (
                <span className="text-[10px] text-yellow-500 mt-0.5">Server</span>
              )}
            </div>
          ))}
        </div>

        {/* Bench players — visible = bench pool minus those in lineup or libero */}
        {renderAddSection(
          `${team}-bench`,
          'Bench Players',
          'Add Player',
          visibleBench,
          (num) => setBench(prev => prev.filter(n => n !== num)),
          'bg-slate-600',
          team,
          { draggable: true },
        )}

        {/* Libero — max 2 */}
        {renderAddSection(
          `${team}-libero`,
          'Libero(s)',
          'Add Libero',
          liberoPlayers,
          (num) => setLiberos(prev => prev.filter(n => n !== num)),
          'bg-teal-700',
          team,
          { maxItems: 2 },
        )}

        {/* Captain */}
        {renderCaptainSection(team)}
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 max-w-3xl mx-auto" onClick={() => { setSelectedCard(null); setCaptainTapped(null); }}>
      {/* Set Progress Bar */}
      <div className="flex mb-4">
        {Array.from({ length: config.bestOf }, (_, i) => {
          const score = getSetScore(events, i);
          const winner = getSetWinner(score, i, config);
          const isCurrent = i === setIndex;
          const isFirst = i === 0;
          const isLast = i === config.bestOf - 1;
          let bg = 'bg-slate-700';
          if (winner === 'home') bg = 'bg-blue-600';
          else if (winner === 'away') bg = 'bg-red-700';
          return (
            <div
              key={i}
              className={`flex-1 py-1.5 text-center text-sm font-bold text-white ${bg} ${isCurrent ? 'border-2 border-yellow-400' : 'border-2 border-transparent'} ${isFirst ? 'rounded-l-lg' : ''} ${isLast ? 'rounded-r-lg' : ''}`}
            >
              Set {i + 1}
            </div>
          );
        })}
      </div>

      <h1 className="text-3xl font-bold text-white mb-2 text-center">
        Set {setIndex + 1} Lineups
      </h1>

      {/* First serve selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-yellow-400 mb-2 text-center">First Serve ◉</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setFirstServeTeam('home')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
              firstServeTeam === 'home'
                ? 'bg-blue-600 text-white border-2 border-yellow-400'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border-2 border-transparent'
            }`}
          >
            {homeTeam.name || 'Home'}
          </button>
          <button
            type="button"
            onClick={() => setFirstServeTeam('away')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
              firstServeTeam === 'away'
                ? 'bg-red-700 text-white border-2 border-yellow-400'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border-2 border-transparent'
            }`}
          >
            {awayTeam.name || 'Away'}
          </button>
        </div>
      </div>

      {/* Lineup cards side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderLineupCard('home', 'border-blue-600', 'text-blue-400')}
        {renderLineupCard('away', 'border-red-700', 'text-red-400')}
      </div>

      {error && (
        <div className="mt-4 bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white text-xl font-semibold py-4 rounded-xl transition-colors"
      >
        Start Set {setIndex + 1}
      </button>

      {/* Touch drag ghost */}
      {touchDrag && (
        <div
          className={`fixed z-[100] pointer-events-none rounded-lg px-4 py-2 shadow-lg shadow-black/50 border-2 border-yellow-400 ${
            touchDrag.team === 'home' ? 'bg-blue-600' : 'bg-red-700'
          }`}
          style={{ left: touchDrag.x - 24, top: touchDrag.y - 20 }}
        >
          <span className="text-white font-bold text-lg">#{touchDrag.number}</span>
        </div>
      )}
    </div>
  );
}
