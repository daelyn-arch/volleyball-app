// ── Player & Team ──────────────────────────────────────────

export interface Player {
  number: number;
  name?: string;
  isLibero?: boolean;
  isCaptain?: boolean;
  isActingCaptain?: boolean;
}

export interface Team {
  name: string;
  roster: Player[];
}

// ── Court positions (USAV standard) ───────────────────────
// Position I = right back (server), rotating counter-clockwise
// I → II → III → IV → V → VI → I
export type CourtPosition = 1 | 2 | 3 | 4 | 5 | 6;

// ── Lineup: maps positions I-VI to player numbers ────────
export type Lineup = Record<CourtPosition, number>;

// ── Events (append-only log) ──────────────────────────────

export type TeamSide = 'home' | 'away';

interface BaseEvent {
  id: string;
  timestamp: number;
  setIndex: number; // 0-based set index
}

export interface PointEvent extends BaseEvent {
  type: 'point';
  scoringTeam: TeamSide;
  servingTeam: TeamSide;
  serverNumber: number;
  homeScore: number; // score AFTER this point
  awayScore: number;
}

export interface SubstitutionEvent extends BaseEvent {
  type: 'substitution';
  team: TeamSide;
  playerIn: number;
  playerOut: number;
  homeScore: number; // score at time of sub
  awayScore: number;
  subNumber: number; // 1-6, which sub this is for the team in this set
}

export interface TimeoutEvent extends BaseEvent {
  type: 'timeout';
  team: TeamSide;
  homeScore: number;
  awayScore: number;
  timeoutNumber: 1 | 2; // 1st or 2nd timeout
}

export interface LiberoReplacementEvent extends BaseEvent {
  type: 'liberoReplacement';
  team: TeamSide;
  liberoNumber: number;
  replacedPlayer: number; // player coming off court
  position: CourtPosition; // must be back row (1, 5, 6)
  isLiberoEntering: boolean; // true = libero goes in, false = libero comes out
  autoSwap?: boolean; // true if auto-generated when libero would rotate to front row
}

export type SanctionRecipient = 'player' | 'coach' | 'asstCoach' | 'trainer' | 'manager';

export interface SanctionEvent extends BaseEvent {
  type: 'sanction';
  team: TeamSide;
  playerNumber?: number;
  sanctionType: 'warning' | 'penalty' | 'expulsion' | 'disqualification' | 'delay-warning' | 'delay-penalty';
  sanctionRecipient?: SanctionRecipient;
  homeScore: number;
  awayScore: number;
}

export interface CorrectionEvent extends BaseEvent {
  type: 'correction';
  homeScore: number;
  awayScore: number;
  homeLineup: Lineup;
  awayLineup: Lineup;
  servingTeam: TeamSide;
}

export type MatchEvent =
  | PointEvent
  | SubstitutionEvent
  | TimeoutEvent
  | LiberoReplacementEvent
  | SanctionEvent
  | CorrectionEvent;

// ── Set ───────────────────────────────────────────────────

export interface SetData {
  homeLineup: Lineup | null;
  awayLineup: Lineup | null;
  firstServe: TeamSide | null;
  /** Which team started on which side (left/right) */
  homeBenchSide: 'left' | 'right';
  startTime: number | null;
  endTime: number | null;
}

// ── Match Metadata (optional, for PDF) ───────────────────

export interface MatchMetadata {
  competition: string;
  cityState: string;
  hall: string;
  matchNumber: string;
  level: string;
  division: 'Men' | 'Women' | 'CoEd' | '';
  category: 'Adult' | 'Junior' | '';
  poolPhase: string;
  court: string;
  scorer: string;
  referee: string;
  downRef: string;
}

// ── Match ─────────────────────────────────────────────────

export interface MatchConfig {
  bestOf: 3 | 5;
  pointsToWin: number; // 25 for regulation, configurable
  decidingSetPoints: number; // 15 for deciding set
  maxSubsPerSet: number; // 15 per USAV
  maxTimeoutsPerSet: number; // 2 per USAV
}

export interface MatchState {
  id: string;
  createdAt: number;
  homeTeam: Team;
  awayTeam: Team;
  config: MatchConfig;
  sets: SetData[];
  events: MatchEvent[];
  currentSetIndex: number;
  matchComplete: boolean;
  /** Optional match metadata for PDF */
  metadata: MatchMetadata;
  /** Track libero serving rotation per set. Key: `${setIndex}-${team}`, value: position */
  liberoServingPositions: Record<string, CourtPosition | null>;
  /** Score correction remarks for the PDF */
  remarks: string[];
}

// ── Derived types ─────────────────────────────────────────

export interface Score {
  home: number;
  away: number;
}

export interface ServiceRound {
  servingTeam: TeamSide;
  serverNumber: number;
  startScore: Score;
  endScore: Score | null; // null if round is ongoing
  pointsScored: number;
}

export interface RunningScoreEntry {
  point: number; // 1-25+
  serverNumber: number;
  team: TeamSide;
}

export interface RotationState {
  homeLineup: Lineup;
  awayLineup: Lineup;
  servingTeam: TeamSide;
  serverNumber: number;
}

export interface SubstitutionRecord {
  playerIn: number;
  playerOut: number;
  homeScore: number;
  awayScore: number;
  subNumber: number;
}

export interface TimeoutRecord {
  homeScore: number;
  awayScore: number;
  timeoutNumber: 1 | 2;
}

export interface SetSummary {
  setIndex: number;
  homeScore: number;
  awayScore: number;
  winner: TeamSide | null;
  homeServiceRounds: ServiceRound[];
  awayServiceRounds: ServiceRound[];
  homeRunningScore: RunningScoreEntry[];
  awayRunningScore: RunningScoreEntry[];
  homeSubstitutions: SubstitutionRecord[];
  awaySubstitutions: SubstitutionRecord[];
  homeTimeouts: TimeoutRecord[];
  awayTimeouts: TimeoutRecord[];
}
