import { useState } from 'react';
import { useMatchStore } from '@/store/matchStore';
import { hasDelayWarning } from '@/store/validators';
import type { TeamSide, SanctionRecipient } from '@/types/match';

interface Props {
  onClose: () => void;
}

type SanctionType = 'warning' | 'penalty' | 'expulsion' | 'disqualification' | 'delay-warning' | 'delay-penalty';
type Category = 'delay' | 'warning' | 'expulsion' | 'disqualification';

const RECIPIENT_OPTIONS: { value: SanctionRecipient; label: string; symbol: string }[] = [
  { value: 'player', label: 'Player', symbol: '#' },
  { value: 'coach', label: 'Coach', symbol: 'C' },
  { value: 'asstCoach', label: 'Asst Coach', symbol: 'A' },
  { value: 'trainer', label: 'Trainer', symbol: 'T' },
  { value: 'manager', label: 'Manager', symbol: 'M' },
];

export default function SanctionDialog({ onClose }: Props) {
  const [step, setStep] = useState<'category' | 'delay-sub' | 'team' | 'recipient' | 'player' | 'double-prompt'>('category');
  const [selectedType, setSelectedType] = useState<SanctionType | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamSide | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<SanctionRecipient | null>(null);
  const [playerInput, setPlayerInput] = useState('');
  const [firstSanction, setFirstSanction] = useState<{ team: TeamSide; sanctionType: SanctionType; playerNumber?: number; sanctionRecipient?: SanctionRecipient } | null>(null);

  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);
  const events = useMatchStore((s) => s.events);
  const recordSanction = useMatchStore((s) => s.recordSanction);
  const recordDoubleSanction = useMatchStore((s) => s.recordDoubleSanction);

  const homeHasDelayWarn = hasDelayWarning(events, 'home');
  const awayHasDelayWarn = hasDelayWarning(events, 'away');

  function handleCategory(cat: Category) {
    if (cat === 'delay') {
      setStep('delay-sub');
    } else if (cat === 'warning') {
      setSelectedType('warning');
      setStep('team');
    } else if (cat === 'expulsion') {
      setSelectedType('expulsion');
      setStep('team');
    } else if (cat === 'disqualification') {
      setSelectedType('disqualification');
      setStep('team');
    }
  }

  function handleDelayType(type: 'delay-warning' | 'delay-penalty') {
    setSelectedType(type);
    setStep('team');
  }

  function handleSelectTeam(team: TeamSide) {
    setSelectedTeam(team);

    let type = selectedType;
    // USAV: delay warning is per-match — auto-upgrade if team already warned
    if (type === 'delay-warning' && hasDelayWarning(events, team)) {
      type = 'delay-penalty';
      setSelectedType(type);
    }

    // Delays are team-level, skip recipient/player
    if (type === 'delay-warning' || type === 'delay-penalty') {
      finishSanction({ team, sanctionType: type });
    } else {
      setStep('recipient');
    }
  }

  function handleSelectRecipient(recipient: SanctionRecipient) {
    setSelectedRecipient(recipient);
    if (recipient === 'player') {
      setStep('player');
    } else {
      if (!selectedType || !selectedTeam) return;
      finishSanction({ team: selectedTeam, sanctionType: selectedType, sanctionRecipient: recipient });
    }
  }

  function handleSubmit() {
    if (!selectedType || !selectedTeam) return;
    const playerNum = playerInput ? parseInt(playerInput, 10) : undefined;
    finishSanction({ team: selectedTeam, sanctionType: selectedType, playerNumber: playerNum && !isNaN(playerNum) ? playerNum : undefined, sanctionRecipient: 'player' });
  }

  function handleSkipPlayer() {
    if (!selectedType || !selectedTeam) return;
    finishSanction({ team: selectedTeam, sanctionType: selectedType, sanctionRecipient: 'player' });
  }

  function finishSanction(details: { team: TeamSide; sanctionType: SanctionType; playerNumber?: number; sanctionRecipient?: SanctionRecipient }) {
    if (firstSanction === null) {
      setFirstSanction(details);
      setStep('double-prompt');
    } else {
      recordDoubleSanction(firstSanction, details);
      onClose();
    }
  }

  function handleNoDouble() {
    if (!firstSanction) return;
    recordSanction(firstSanction.team, firstSanction.sanctionType, firstSanction.playerNumber, firstSanction.sanctionRecipient);
    onClose();
  }

  function handleYesDouble() {
    setSelectedType(null);
    setSelectedTeam(null);
    setSelectedRecipient(null);
    setPlayerInput('');
    setStep('category');
  }

  const awardsPoint = selectedType === 'penalty' || selectedType === 'delay-penalty' || selectedType === 'expulsion' || selectedType === 'disqualification';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">
            {step === 'category' && 'Sanction Type'}
            {step === 'delay-sub' && 'Delay Type'}
            {step === 'team' && 'Select Team'}
            {step === 'recipient' && 'Who Received It?'}
            {step === 'player' && 'Player Number'}
            {step === 'double-prompt' && 'Double Sanction?'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-4">
          {/* Banner when collecting second sanction */}
          {firstSanction && step !== 'double-prompt' && (
            <div className="bg-amber-900/50 border border-amber-500 text-amber-200 rounded-lg px-3 py-2 mb-3 text-sm text-center">
              Recording second sanction
            </div>
          )}

          {/* Step: Double sanction prompt */}
          {step === 'double-prompt' && (
            <div className="flex flex-col gap-3">
              <p className="text-slate-300 text-sm text-center">
                Another sanction on this dead ball?
              </p>
              <button
                onClick={handleYesDouble}
                className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Yes — Add Second Sanction
              </button>
              <button
                onClick={handleNoDouble}
                className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                No — Record Single Sanction
              </button>
            </div>
          )}

          {/* Step 1: Category */}
          {step === 'category' && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleCategory('delay')}
                className="bg-blue-700 text-white px-4 py-3 rounded-lg font-bold text-sm text-left active:opacity-80"
              >
                Delay
                <span className="block text-xs font-normal opacity-80 mt-0.5">Warning or Penalty</span>
              </button>
              <button
                onClick={() => handleCategory('warning')}
                className="bg-yellow-500 text-black px-4 py-3 rounded-lg font-bold text-sm text-left active:opacity-80"
              >
                Yellow Card
                <span className="block text-xs font-normal opacity-80 mt-0.5">Warning — no point awarded</span>
              </button>
              <button
                onClick={() => {
                  setSelectedType('penalty');
                  setStep('team');
                }}
                className="bg-red-600 text-white px-4 py-3 rounded-lg font-bold text-sm text-left active:opacity-80"
              >
                Red Card
                <span className="block text-xs font-normal opacity-80 mt-0.5">Penalty — point to opponent</span>
              </button>
              <button
                onClick={() => handleCategory('expulsion')}
                className="bg-black text-white px-4 py-3 rounded-lg font-bold text-sm text-left active:opacity-80 border border-slate-600"
              >
                Expulsion
                <span className="block text-xs font-normal opacity-80 mt-0.5">Player removed for rest of set</span>
              </button>
              <button
                onClick={() => handleCategory('disqualification')}
                className="bg-black text-red-500 px-4 py-3 rounded-lg font-bold text-sm text-left active:opacity-80 border border-slate-600"
              >
                Disqualification
                <span className="block text-xs font-normal opacity-80 mt-0.5">Player removed for rest of match</span>
              </button>
            </div>
          )}

          {/* Step 1b: Delay sub-type */}
          {step === 'delay-sub' && (
            <div className="flex flex-col gap-3">
              {(homeHasDelayWarn || awayHasDelayWarn) && (
                <div className="bg-amber-900/40 border border-amber-600 text-amber-200 rounded-lg px-3 py-2 text-xs">
                  {homeHasDelayWarn && awayHasDelayWarn
                    ? 'Both teams already warned — next delay is a penalty'
                    : `${homeHasDelayWarn ? homeTeam.name : awayTeam.name} already warned — their next delay is a penalty`}
                </div>
              )}
              <button
                onClick={() => handleDelayType('delay-warning')}
                className="bg-yellow-700 text-white px-4 py-4 rounded-lg font-bold text-left active:opacity-80"
              >
                Delay Warning
                <span className="block text-xs font-normal opacity-80 mt-0.5">No point awarded (auto-upgrades if team already warned)</span>
              </button>
              <button
                onClick={() => handleDelayType('delay-penalty')}
                className="bg-orange-700 text-white px-4 py-4 rounded-lg font-bold text-left active:opacity-80"
              >
                Delay Penalty
                <span className="block text-xs font-normal opacity-80 mt-0.5">Point to opponent</span>
              </button>
              <button onClick={() => setStep('category')} className="text-slate-400 text-sm mt-1">Back</button>
            </div>
          )}

          {/* Step 2: Select team */}
          {step === 'team' && (
            <div className="flex flex-col gap-3">
              {awardsPoint && (
                <p className="text-yellow-400 text-xs text-center">Point will be awarded to opposing team</p>
              )}
              <button
                onClick={() => handleSelectTeam('home')}
                className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                {homeTeam.name || 'Home'}
              </button>
              <button
                onClick={() => handleSelectTeam('away')}
                className="bg-red-700 hover:bg-red-600 text-white px-4 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                {awayTeam.name || 'Away'}
              </button>
              <button
                onClick={() => setStep(selectedType?.startsWith('delay') ? 'delay-sub' : 'category')}
                className="text-slate-400 text-sm mt-1"
              >
                Back
              </button>
            </div>
          )}

          {/* Step 3: Recipient selection */}
          {step === 'recipient' && (
            <div className="flex flex-col gap-2">
              {RECIPIENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSelectRecipient(opt.value)}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg font-bold text-sm text-left transition-colors flex items-center gap-3"
                >
                  <span className="bg-slate-500 text-white w-8 h-8 rounded flex items-center justify-center font-mono text-base">
                    {opt.symbol}
                  </span>
                  {opt.label}
                </button>
              ))}
              <button onClick={() => setStep('team')} className="text-slate-400 text-sm mt-1">Back</button>
            </div>
          )}

          {/* Step 4: Player number */}
          {step === 'player' && (
            <div className="flex flex-col gap-3">
              <p className="text-slate-300 text-sm">
                Enter player number
              </p>
              <input
                type="text"
                inputMode="numeric"
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                placeholder="#"
                className="w-full bg-slate-700 text-white text-2xl font-bold rounded-lg px-4 py-3 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSkipPlayer}
                  className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-3 rounded-lg font-bold text-sm transition-colors"
                >
                  Team Only
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!playerInput}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white py-3 rounded-lg font-bold text-sm transition-colors"
                >
                  Confirm
                </button>
              </div>
              <button onClick={() => setStep('recipient')} className="text-slate-400 text-sm">Back</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
