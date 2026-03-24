import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { useMatchStore } from '@/store/matchStore';
import { getSetSummary, getSetsWon, getSetScore } from '@/store/derived';
import { getSetWinner, getMatchWinner } from '@/utils/scoring';
import {
  getPenaltyPoints,
  getSanctions,
  getLiberoNumbers,
  formatSanctionType,
  sanctionColor,
  formatRecipient,
} from '@/store/pdfDerived';
import type {
  MatchState,
  SetSummary,
  TeamSide,
  ServiceRound,
  RunningScoreEntry,
  SubstitutionRecord,
  TimeoutRecord,
  SanctionEvent,
  SetData,
  Lineup,
  CourtPosition,
} from '@/types/match';

// ── Color palette ──────────────────────────────────────────
const C = {
  homeHeader: '#1d4ed8',
  homeLight: '#dbeafe',
  homeMid: '#93c5fd',
  awayHeader: '#b91c1c',
  awayLight: '#fee2e2',
  awayMid: '#fca5a5',
  liberoGreen: '#d1fae5',
  penaltyYellow: '#fef3c7',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  white: '#ffffff',
  black: '#000000',
  sanctionYellow: '#fef08a',
  sanctionRed: '#fecaca',
  sanctionOrange: '#fed7aa',
  sanctionDark: '#d1d5db',
} as const;

// ── Styles ─────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    padding: 18,
    paddingBottom: 24,
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    backgroundColor: C.white,
  },

  // Metadata header
  metaBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 5,
    borderBottom: `1.5pt solid ${C.gray300}`,
  },
  metaTeams: {
    fontSize: 13,
    fontWeight: 'bold',
    color: C.gray900,
    textAlign: 'center',
  },
  metaVs: {
    fontSize: 10,
    color: C.gray500,
    marginHorizontal: 6,
  },
  metaHomeTeam: {
    fontSize: 13,
    fontWeight: 'bold',
    color: C.homeHeader,
  },
  metaAwayTeam: {
    fontSize: 13,
    fontWeight: 'bold',
    color: C.awayHeader,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  metaItem: {
    fontSize: 6.5,
    color: C.gray600,
  },
  metaLabel: {
    fontWeight: 'bold',
    color: C.gray700,
  },

  // Set header
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.gray800,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginBottom: 5,
  },
  setTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: C.white,
  },
  setTimes: {
    fontSize: 7.5,
    color: C.gray300,
  },
  firstServeTag: {
    fontSize: 7,
    fontWeight: 'bold',
    color: C.white,
    backgroundColor: C.gray600,
    border: '1pt solid #facc15',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },

  // Layout containers
  topRow: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: 4,
  },
  lineupPanel: {
    flex: 1,
    borderRadius: 3,
    overflow: 'hidden',
    border: `0.75pt solid ${C.gray300}`,
  },
  lineupHeader: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineupTeamName: {
    fontSize: 8,
    fontWeight: 'bold',
    color: C.white,
  },
  lineupBody: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    backgroundColor: C.white,
    justifyContent: 'center',
    gap: 2,
  },
  lineupPos: {
    width: 28,
    alignItems: 'center',
  },
  lineupPosLabel: {
    fontSize: 5.5,
    color: C.gray500,
    marginBottom: 1,
  },
  lineupPosNum: {
    fontSize: 9,
    fontWeight: 'bold',
    color: C.gray900,
  },
  lineupMeta: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingBottom: 3,
    gap: 8,
    backgroundColor: C.white,
  },
  lineupMetaText: {
    fontSize: 6,
    color: C.gray600,
  },

  // Running score
  runningScoreContainer: {
    marginBottom: 4,
    border: `0.75pt solid ${C.gray300}`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  rsSectionLabel: {
    backgroundColor: C.gray100,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderBottom: `0.5pt solid ${C.gray300}`,
  },
  rsSectionLabelText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: C.gray700,
  },
  rsTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderBottom: `0.5pt solid ${C.gray200}`,
  },
  rsTeamLabel: {
    width: 55,
    fontSize: 6.5,
    fontWeight: 'bold',
    paddingRight: 4,
  },
  rsCellsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    gap: 1,
  },
  rsCell: {
    width: 19,
    height: 19,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    border: `0.5pt solid ${C.gray300}`,
  },
  rsCellNum: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  rsCellServer: {
    fontSize: 5.5,
    color: C.gray400,
    position: 'absolute',
    top: 0.5,
    right: 1.5,
  },

  // Service rounds
  serviceSection: {
    marginBottom: 4,
    border: `0.75pt solid ${C.gray300}`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  serviceRow: {
    flexDirection: 'row',
    gap: 4,
  },
  serviceTeam: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  serviceTeamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  srTable: {
    borderTop: `0.5pt solid ${C.gray200}`,
  },
  srTableRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${C.gray200}`,
    alignItems: 'center',
    minHeight: 11,
  },
  srPosCell: {
    width: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 1,
  },
  srPosLabel: {
    fontSize: 6,
    fontWeight: 'bold',
    color: C.white,
    backgroundColor: C.gray400,
    border: `0.75pt solid ${C.gray400}`,
    borderRadius: 2,
    paddingHorizontal: 2,
    paddingVertical: 0.5,
    textAlign: 'center',
    minWidth: 12,
  },
  srPosPlayer: {
    fontSize: 8,
    fontWeight: 'bold',
    color: C.gray800,
  },
  srRoundsCell: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    paddingVertical: 1,
    paddingHorizontal: 2,
  },
  srRoundChip: {
    borderRadius: 2,
    paddingHorizontal: 3,
    paddingVertical: 1,
    fontSize: 6,
  },

  // Subs and Timeouts
  bottomRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  subsSection: {
    flex: 1,
    border: `0.75pt solid ${C.gray300}`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  toSection: {
    flex: 1,
    border: `0.75pt solid ${C.gray300}`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  subTable: {
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  subRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${C.gray200}`,
    paddingVertical: 1,
  },
  subCell: {
    flex: 1,
    fontSize: 6,
    textAlign: 'center',
  },
  subHeaderCell: {
    flex: 1,
    fontSize: 5.5,
    fontWeight: 'bold',
    textAlign: 'center',
    color: C.gray600,
  },
  teamSubsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  teamSubsPanel: {
    flex: 1,
  },
  teamSubsLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    marginBottom: 1,
    paddingHorizontal: 2,
  },

  // Timeouts
  toBody: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  toTeam: {
    flex: 1,
    alignItems: 'center',
  },
  toTeamLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  toBoxRow: {
    flexDirection: 'row',
    gap: 3,
  },
  toBox: {
    width: 36,
    height: 18,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    border: `0.75pt solid ${C.gray300}`,
  },
  toBoxText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: C.gray800,
  },
  toBoxEmpty: {
    fontSize: 6,
    color: C.gray400,
  },

  // Sanctions
  sanctionsSection: {
    marginBottom: 4,
    border: `0.75pt solid ${C.gray300}`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  sanctionRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${C.gray200}`,
    alignItems: 'center',
    minHeight: 12,
  },
  sanctionColorBar: {
    width: 3,
    height: '100%',
    minHeight: 12,
  },
  sanctionCell: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontSize: 6.5,
  },
  sanctionType: {
    width: 68,
    fontWeight: 'bold',
  },
  sanctionTeam: {
    width: 55,
  },
  sanctionRecip: {
    width: 52,
  },
  sanctionSet: {
    width: 25,
    textAlign: 'center',
  },
  sanctionScore: {
    width: 40,
    textAlign: 'center',
  },
  sanctionHeaderRow: {
    flexDirection: 'row',
    backgroundColor: C.gray100,
    borderBottom: `0.5pt solid ${C.gray300}`,
    alignItems: 'center',
    minHeight: 11,
  },
  sanctionHeaderCell: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontSize: 6,
    fontWeight: 'bold',
    color: C.gray600,
  },

  // Remarks
  remarksSection: {
    marginBottom: 4,
    border: `0.75pt solid ${C.gray300}`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  remarkLine: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    fontSize: 6.5,
    color: C.gray700,
    borderBottom: `0.5pt solid ${C.gray200}`,
  },

  // Set result
  setResult: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 8,
    marginBottom: 2,
  },
  setResultWinner: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  setResultScore: {
    fontSize: 10,
    fontWeight: 'bold',
    color: C.gray800,
  },
  setResultLoser: {
    fontSize: 9,
    color: C.gray500,
  },

  // Match result (last page)
  matchResult: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    border: `1.5pt solid ${C.gray800}`,
    alignItems: 'center',
  },
  matchResultTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: C.gray800,
    marginBottom: 4,
  },
  matchResultWinner: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  matchResultRecord: {
    fontSize: 11,
    color: C.gray600,
  },
  matchResultSets: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 12,
  },
  matchSetScore: {
    fontSize: 8,
    color: C.gray600,
    textAlign: 'center',
  },

  // Section label
  sectionLabel: {
    backgroundColor: C.gray100,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderBottom: `0.5pt solid ${C.gray300}`,
    fontSize: 7,
    fontWeight: 'bold',
    color: C.gray700,
  },

  none: {
    fontSize: 6.5,
    color: C.gray400,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});

// ── Helpers ────────────────────────────────────────────────

const POS_LABELS: string[] = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function fmtTime(ts: number | null): string {
  if (!ts) return '--:--';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function teamColor(side: TeamSide, variant: 'header' | 'light' | 'mid'): string {
  if (side === 'home') {
    if (variant === 'header') return C.homeHeader;
    if (variant === 'light') return C.homeLight;
    return C.homeMid;
  }
  if (variant === 'header') return C.awayHeader;
  if (variant === 'light') return C.awayLight;
  return C.awayMid;
}

function sanctionBg(st: SanctionEvent['sanctionType']): string {
  switch (st) {
    case 'warning':
    case 'delay-warning':
      return C.sanctionYellow;
    case 'penalty':
    case 'delay-penalty':
      return C.sanctionRed;
    case 'expulsion':
      return C.sanctionOrange;
    case 'disqualification':
      return C.sanctionDark;
  }
}

/**
 * Group service rounds by rotation position (I-VI).
 * Each server number corresponds to the lineup position at the start.
 */
function groupRoundsByPosition(
  rounds: ServiceRound[],
  lineup: Lineup | null
): Map<number, ServiceRound[]> {
  const groups = new Map<number, ServiceRound[]>();
  for (let p = 1; p <= 6; p++) groups.set(p, []);
  if (!lineup) return groups;

  // Build a map from serverNumber to starting position
  const numToPos = new Map<number, number>();
  for (let p = 1; p <= 6; p++) {
    numToPos.set(lineup[p as CourtPosition], p);
  }

  for (const r of rounds) {
    // Try to find the position for this server
    const pos = numToPos.get(r.serverNumber);
    if (pos) {
      groups.get(pos)!.push(r);
    } else {
      // Libero or sub serving — find which position they're in
      // Append to position 1 (catch-all)
      groups.get(1)!.push(r);
    }
  }
  return groups;
}

// ── Components ─────────────────────────────────────────────

function MetadataHeader({ state }: { state: MatchState }) {
  const { metadata, homeTeam, awayTeam, config, createdAt } = state;
  const setsWon = getSetsWon(state);

  const items: [string, string][] = [];
  if (metadata.competition) items.push(['Event', metadata.competition]);
  items.push(['Date', fmtDate(createdAt)]);
  if (metadata.scheduledTime) items.push(['Time', metadata.scheduledTime]);
  if (metadata.cityState) items.push(['City', metadata.cityState]);
  if (metadata.hall) items.push(['Hall', metadata.hall]);
  if (metadata.court) items.push(['Court', metadata.court]);
  if (metadata.division) items.push(['Div', metadata.division]);
  if (metadata.category) items.push(['Cat', metadata.category]);
  if (metadata.level) items.push(['Level', metadata.level]);
  if (metadata.matchNumber) items.push(['Match #', metadata.matchNumber]);
  if (metadata.poolPhase) items.push(['Pool', metadata.poolPhase]);
  if (metadata.region) items.push(['Region', metadata.region]);
  items.push(['Format', `Best of ${config.bestOf}`]);

  const officials: [string, string][] = [];
  if (metadata.referee) officials.push(['R1', metadata.referee]);
  if (metadata.downRef) officials.push(['R2', metadata.downRef]);
  if (metadata.scorer) officials.push(['Scorer', metadata.scorer]);
  if (metadata.workTeam) officials.push(['Work Team', metadata.workTeam]);

  return (
    <View>
      <View style={s.metaBar}>
        <Text style={s.metaHomeTeam}>{homeTeam.name}</Text>
        <Text style={s.metaVs}>vs</Text>
        <Text style={s.metaAwayTeam}>{awayTeam.name}</Text>
        <Text style={{ fontSize: 9, color: C.gray500, marginLeft: 10 }}>
          Sets: {setsWon.home} - {setsWon.away}
        </Text>
      </View>
      <View style={s.metaRow}>
        {items.map(([label, val]) => (
          <Text key={label} style={s.metaItem}>
            <Text style={s.metaLabel}>{label}: </Text>
            {val}
          </Text>
        ))}
      </View>
      {officials.length > 0 && (
        <View style={[s.metaRow, { marginBottom: 6 }]}>
          {officials.map(([label, val]) => (
            <Text key={label} style={s.metaItem}>
              <Text style={s.metaLabel}>{label}: </Text>
              {val}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function LineupPanel({
  side,
  teamName,
  lineup,
  roster,
  isFirstServe,
}: {
  side: TeamSide;
  teamName: string;
  lineup: Lineup | null;
  roster: { number: number; isLibero?: boolean; isCaptain?: boolean }[];
  isFirstServe: boolean;
}) {
  const liberos = roster.filter((p) => p.isLibero).map((p) => p.number);
  const captain = roster.find((p) => p.isCaptain);

  return (
    <View style={s.lineupPanel}>
      <View style={[s.lineupHeader, { backgroundColor: teamColor(side, 'header') }]}>
        <Text style={s.lineupTeamName}>{teamName}</Text>
        {isFirstServe && <Text style={s.firstServeTag}>1st Serve</Text>}
      </View>
      <View style={s.lineupBody}>
        {lineup ? (
          POS_LABELS.map((label, i) => (
            <View key={label} style={s.lineupPos}>
              <Text style={s.lineupPosLabel}>{label}</Text>
              <Text style={s.lineupPosNum}>{lineup[(i + 1) as CourtPosition]}</Text>
            </View>
          ))
        ) : (
          <Text style={{ fontSize: 7, color: C.gray400, padding: 4 }}>No lineup</Text>
        )}
      </View>
      <View style={s.lineupMeta}>
        {liberos.length > 0 && (
          <Text style={s.lineupMetaText}>
            <Text style={{ fontWeight: 'bold' }}>L: </Text>
            {liberos.join(', ')}
          </Text>
        )}
        {captain && (
          <Text style={s.lineupMetaText}>
            <Text style={{ fontWeight: 'bold' }}>C: </Text>
            #{captain.number}
          </Text>
        )}
      </View>
    </View>
  );
}

function RunningScoreSection({
  summary,
  state,
}: {
  summary: SetSummary;
  state: MatchState;
}) {
  const maxPts = Math.max(summary.homeScore, summary.awayScore, 1);
  const homeLiberos = getLiberoNumbers(state.homeTeam.roster);
  const awayLiberos = getLiberoNumbers(state.awayTeam.roster);
  const homePenaltyPts = getPenaltyPoints(state.events, summary.setIndex, 'home');
  const awayPenaltyPts = getPenaltyPoints(state.events, summary.setIndex, 'away');

  function renderCells(
    entries: RunningScoreEntry[],
    side: TeamSide,
    liberoNums: Set<number>,
    penaltyPts: Set<number>,
    maxP: number,
  ) {
    const entryMap = new Map<number, RunningScoreEntry>();
    for (const e of entries) entryMap.set(e.point, e);

    return Array.from({ length: maxP }, (_, i) => {
      const p = i + 1;
      const entry = entryMap.get(p);
      if (!entry) {
        // Unscored
        return (
          <View key={p} style={[s.rsCell, { backgroundColor: C.gray50 }]}>
            <Text style={{ fontSize: 6, color: C.gray300 }}>{p}</Text>
          </View>
        );
      }

      const isLiberoServe = liberoNums.has(entry.serverNumber);
      const isPenalty = penaltyPts.has(p);
      const isServePoint = entry.team === side && entry.team === entry.team; // always true, this means scoring team matches the row
      // Determine if this was a "served" point: the servingTeam matches the side
      // We need to figure out if the server was on this team
      // entries only exist for points this team scored, and each entry has the serverNumber
      // If the server is on this team, it's a serve point; otherwise it's a rally/sideout point
      const serverOnThisTeam =
        side === 'home'
          ? [...getLiberoNumbers(state.homeTeam.roster)].includes(entry.serverNumber) ||
            state.homeTeam.roster.some((p) => p.number === entry.serverNumber)
          : [...getLiberoNumbers(state.awayTeam.roster)].includes(entry.serverNumber) ||
            state.awayTeam.roster.some((p) => p.number === entry.serverNumber);

      // Actually, the RunningScoreEntry has serverNumber = the person serving at the time.
      // The entry.team is which team scored. So "served point" means the server's team = scoring team.
      // We check if the server belongs to the roster of this side.
      const isServedPoint = serverOnThisTeam;

      let bgColor = isServedPoint ? teamColor(side, 'mid') : teamColor(side, 'light');
      if (isPenalty) bgColor = C.penaltyYellow;
      else if (isLiberoServe) bgColor = C.liberoGreen;

      const textColor = isServedPoint ? C.white : C.gray800;

      return (
        <View
          key={p}
          style={[
            s.rsCell,
            {
              backgroundColor: bgColor,
              borderColor: isServedPoint ? teamColor(side, 'header') : C.gray300,
            },
          ]}
        >
          <Text style={[s.rsCellServer, { color: isServedPoint ? 'rgba(255,255,255,0.7)' : C.gray400 }]}>
            {entry.serverNumber}
          </Text>
          <Text style={[s.rsCellNum, { color: isServedPoint ? C.white : C.gray800 }]}>
            {isPenalty ? 'P' : ''}{p}
          </Text>
        </View>
      );
    });
  }

  return (
    <View style={s.runningScoreContainer}>
      <View style={s.rsSectionLabel}>
        <Text style={s.rsSectionLabelText}>Running Score</Text>
      </View>
      <View style={s.rsTeamRow}>
        <Text style={[s.rsTeamLabel, { color: C.homeHeader }]}>{state.homeTeam.name}</Text>
        <View style={s.rsCellsWrap}>
          {renderCells(summary.homeRunningScore, 'home', homeLiberos, homePenaltyPts, maxPts)}
        </View>
      </View>
      <View style={[s.rsTeamRow, { borderBottom: 'none' }]}>
        <Text style={[s.rsTeamLabel, { color: C.awayHeader }]}>{state.awayTeam.name}</Text>
        <View style={s.rsCellsWrap}>
          {renderCells(summary.awayRunningScore, 'away', awayLiberos, awayPenaltyPts, maxPts)}
        </View>
      </View>
      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingVertical: 2, borderTop: `0.5pt solid ${C.gray200}` }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <View style={{ width: 8, height: 8, borderRadius: 1, backgroundColor: C.homeMid }} />
          <Text style={{ fontSize: 5.5, color: C.gray600 }}>Served point</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <View style={{ width: 8, height: 8, borderRadius: 1, backgroundColor: C.homeLight }} />
          <Text style={{ fontSize: 5.5, color: C.gray600 }}>Rally/sideout</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <View style={{ width: 8, height: 8, borderRadius: 1, backgroundColor: C.liberoGreen }} />
          <Text style={{ fontSize: 5.5, color: C.gray600 }}>Libero serving</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <View style={{ width: 8, height: 8, borderRadius: 1, backgroundColor: C.penaltyYellow }} />
          <Text style={{ fontSize: 5.5, color: C.gray600 }}>Penalty point</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ fontSize: 5.5, color: C.gray600 }}>Small # = server</Text>
        </View>
      </View>
    </View>
  );
}

function TeamServiceSection({
  summary,
  state,
}: {
  summary: SetSummary;
  state: MatchState;
}) {
  const setData = state.sets[summary.setIndex];
  const homeGroups = groupRoundsByPosition(summary.homeServiceRounds, setData?.homeLineup ?? null);
  const awayGroups = groupRoundsByPosition(summary.awayServiceRounds, setData?.awayLineup ?? null);

  function renderTeam(
    side: TeamSide,
    groups: Map<number, ServiceRound[]>,
    teamName: string,
    lineup: Lineup | null,
    roster: { number: number; isLibero?: boolean; isCaptain?: boolean }[],
    isFirstServe: boolean,
  ) {
    const liberos = roster.filter((p) => p.isLibero).map((p) => p.number);
    const captain = roster.find((p) => p.isCaptain);

    return (
      <View style={s.serviceTeam}>
        {/* Team header */}
        <View style={[s.lineupHeader, { backgroundColor: teamColor(side, 'header') }]}>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            {isFirstServe && <Text style={s.firstServeTag}>1st Serve</Text>}
            <Text style={s.lineupTeamName}>{teamName}</Text>
          </View>
        </View>
        {/* Libero / Captain row */}
        {(liberos.length > 0 || captain) && (
          <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 4, paddingVertical: 2, backgroundColor: C.white, borderBottom: `0.5pt solid ${C.gray200}` }}>
            {liberos.length > 0 && (
              <Text style={{ fontSize: 6, fontWeight: 'bold', color: C.white, backgroundColor: '#0d9488', border: '1pt solid #0d9488', borderRadius: 2, paddingHorizontal: 3, paddingVertical: 0.5 }}>
                LIB: {liberos.join(', ')}
              </Text>
            )}
            {captain && (
              <Text style={{ fontSize: 6, fontWeight: 'bold', color: C.white, backgroundColor: '#b8860b', border: '1pt solid #facc15', borderRadius: 2, paddingHorizontal: 3, paddingVertical: 0.5 }}>
                C: #{captain.number}
              </Text>
            )}
          </View>
        )}
        {/* Service rounds by position */}
        <View style={s.srTable}>
          {POS_LABELS.map((label, i) => {
            const pos = i + 1;
            const rounds = groups.get(pos) ?? [];
            return (
              <View key={label} style={s.srTableRow}>
                <View style={s.srPosCell}>
                  <Text style={s.srPosLabel}>{label}</Text>
                  {lineup && <Text style={s.srPosPlayer}>#{lineup[pos as CourtPosition]}</Text>}
                </View>
                <View style={s.srRoundsCell}>
                  {rounds.length === 0 ? (
                    <Text style={{ fontSize: 6, color: C.gray400 }}>-</Text>
                  ) : (
                    rounds.map((r, ri) => (
                      <View
                        key={ri}
                        style={[
                          s.srRoundChip,
                          {
                            backgroundColor: teamColor(side, 'light'),
                            borderLeft: `2pt solid ${teamColor(side, 'header')}`,
                          },
                        ]}
                      >
                        <Text>
                          #{r.serverNumber} {r.pointsScored}pt
                          {r.endScore ? ` (${r.endScore.home}-${r.endScore.away})` : ''}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={s.serviceSection}>
      <View style={s.serviceRow}>
        {renderTeam('home', homeGroups, state.homeTeam.name, setData?.homeLineup ?? null, state.homeTeam.roster, setData?.firstServe === 'home')}
        <View style={{ width: 0.5, backgroundColor: C.gray300 }} />
        {renderTeam('away', awayGroups, state.awayTeam.name, setData?.awayLineup ?? null, state.awayTeam.roster, setData?.firstServe === 'away')}
      </View>
    </View>
  );
}

function SubstitutionsPanel({
  side,
  teamName,
  subs,
}: {
  side: TeamSide;
  teamName: string;
  subs: SubstitutionRecord[];
}) {
  return (
    <View style={s.teamSubsPanel}>
      <Text style={[s.teamSubsLabel, { color: teamColor(side, 'header') }]}>{teamName}</Text>
      {subs.length === 0 ? (
        <Text style={s.none}>None</Text>
      ) : (
        <View>
          <View style={s.subRow}>
            <Text style={s.subHeaderCell}>#</Text>
            <Text style={s.subHeaderCell}>In</Text>
            <Text style={s.subHeaderCell}>Out</Text>
            <Text style={s.subHeaderCell}>Score</Text>
          </View>
          {subs.map((sub) => (
            <View key={`${sub.subNumber}-${sub.playerIn}`} style={s.subRow}>
              <Text style={s.subCell}>{sub.subNumber}</Text>
              <Text style={[s.subCell, { fontWeight: 'bold' }]}>{sub.playerIn}</Text>
              <Text style={s.subCell}>{sub.playerOut}</Text>
              <Text style={s.subCell}>
                {sub.homeScore}-{sub.awayScore}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TimeoutsPanel({
  side,
  teamName,
  timeouts,
}: {
  side: TeamSide;
  teamName: string;
  timeouts: TimeoutRecord[];
}) {
  const t1 = timeouts.find((t) => t.timeoutNumber === 1);
  const t2 = timeouts.find((t) => t.timeoutNumber === 2);

  return (
    <View style={s.toTeam}>
      <Text style={[s.toTeamLabel, { color: teamColor(side, 'header') }]}>{teamName}</Text>
      <View style={s.toBoxRow}>
        <View
          style={[
            s.toBox,
            t1
              ? { backgroundColor: teamColor(side, 'light'), borderColor: teamColor(side, 'header') }
              : {},
          ]}
        >
          {t1 ? (
            <Text style={s.toBoxText}>
              {t1.homeScore}-{t1.awayScore}
            </Text>
          ) : (
            <Text style={s.toBoxEmpty}>T/O 1</Text>
          )}
        </View>
        <View
          style={[
            s.toBox,
            t2
              ? { backgroundColor: teamColor(side, 'light'), borderColor: teamColor(side, 'header') }
              : {},
          ]}
        >
          {t2 ? (
            <Text style={s.toBoxText}>
              {t2.homeScore}-{t2.awayScore}
            </Text>
          ) : (
            <Text style={s.toBoxEmpty}>T/O 2</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function BottomSection({ summary, state, sanctions }: { summary: SetSummary; state: MatchState; sanctions: SanctionEvent[] }) {
  return (
    <View style={s.bottomRow}>
      {/* Left column: Subs then Timeouts */}
      <View style={s.subsSection}>
        {/* Substitutions */}
        <Text style={s.sectionLabel}>Substitutions</Text>
        <View style={[s.subTable, s.teamSubsRow]}>
          <SubstitutionsPanel
            side="home"
            teamName={state.homeTeam.name}
            subs={summary.homeSubstitutions}
          />
          <View style={{ width: 0.5, backgroundColor: C.gray300, marginHorizontal: 2 }} />
          <SubstitutionsPanel
            side="away"
            teamName={state.awayTeam.name}
            subs={summary.awaySubstitutions}
          />
        </View>
        {/* Divider */}
        <View style={{ height: 0.5, backgroundColor: C.gray300 }} />
        {/* Timeouts */}
        <Text style={s.sectionLabel}>Timeouts</Text>
        <View style={s.toBody}>
          <TimeoutsPanel side="home" teamName={state.homeTeam.name} timeouts={summary.homeTimeouts} />
          <TimeoutsPanel side="away" teamName={state.awayTeam.name} timeouts={summary.awayTimeouts} />
        </View>
      </View>

      {/* Right column: Comments then Sanctions */}
      <View style={s.toSection}>
        {/* Comments — takes remaining space */}
        <View style={{ flex: 1, padding: 4 }}>
          <Text style={s.sectionLabel}>Comments</Text>
          {state.remarks.length > 0 ? (
            state.remarks.map((r, i) => (
              <Text key={i} style={{ fontSize: 6.5, color: C.gray700, marginBottom: 1.5 }}>
                • {r}
              </Text>
            ))
          ) : (
            <Text style={{ fontSize: 6.5, color: C.gray400, fontStyle: 'italic' }}>None</Text>
          )}
        </View>
        {/* Divider */}
        <View style={{ height: 0.5, backgroundColor: C.gray300 }} />
        {/* Sanctions */}
        <View style={{ padding: 4 }}>
          <Text style={s.sectionLabel}>Sanctions</Text>
          {sanctions.length > 0 ? (
            sanctions.map((sn, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 1.5 }}>
                <View style={{ width: 3, height: 8, backgroundColor: sanctionColor(sn.sanctionType), borderRadius: 1 }} />
                <Text style={{ fontSize: 6.5, color: C.gray700 }}>
                  {formatSanctionType(sn.sanctionType)} — {sn.team === 'home' ? state.homeTeam.name : state.awayTeam.name} {formatRecipient(sn.sanctionRecipient, sn.playerNumber)} ({sn.homeScore}-{sn.awayScore})
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 6.5, color: C.gray400, fontStyle: 'italic' }}>None</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function SanctionsSection({ sanctions, state }: { sanctions: SanctionEvent[]; state: MatchState }) {
  if (sanctions.length === 0) return null;

  return (
    <View style={s.sanctionsSection}>
      <Text style={s.sectionLabel}>Sanctions</Text>
      <View style={s.sanctionHeaderRow}>
        <View style={{ width: 3 }} />
        <Text style={[s.sanctionHeaderCell, s.sanctionType]}>Type</Text>
        <Text style={[s.sanctionHeaderCell, s.sanctionTeam]}>Team</Text>
        <Text style={[s.sanctionHeaderCell, s.sanctionRecip]}>Recipient</Text>
        <Text style={[s.sanctionHeaderCell, s.sanctionSet]}>Set</Text>
        <Text style={[s.sanctionHeaderCell, s.sanctionScore]}>Score</Text>
      </View>
      {sanctions.map((sn, i) => (
        <View key={i} style={[s.sanctionRow, { backgroundColor: sanctionBg(sn.sanctionType) }]}>
          <View style={[s.sanctionColorBar, { backgroundColor: sanctionColor(sn.sanctionType) }]} />
          <Text style={[s.sanctionCell, s.sanctionType]}>{formatSanctionType(sn.sanctionType)}</Text>
          <Text style={[s.sanctionCell, s.sanctionTeam]}>
            {sn.team === 'home' ? state.homeTeam.name : state.awayTeam.name}
          </Text>
          <Text style={[s.sanctionCell, s.sanctionRecip]}>
            {formatRecipient(sn.sanctionRecipient, sn.playerNumber)}
          </Text>
          <Text style={[s.sanctionCell, s.sanctionSet]}>{sn.setIndex + 1}</Text>
          <Text style={[s.sanctionCell, s.sanctionScore]}>
            {sn.homeScore}-{sn.awayScore}
          </Text>
        </View>
      ))}
    </View>
  );
}

function RemarksSection({ remarks }: { remarks: string[] }) {
  if (remarks.length === 0) return null;

  return (
    <View style={s.remarksSection}>
      <Text style={s.sectionLabel}>Remarks</Text>
      {remarks.map((r, i) => (
        <Text key={i} style={s.remarkLine}>
          {'\u2022'} {r}
        </Text>
      ))}
    </View>
  );
}

function SetResultBar({ summary, state }: { summary: SetSummary; state: MatchState }) {
  const winner = summary.winner;
  if (!winner) return null;

  const winnerName = winner === 'home' ? state.homeTeam.name : state.awayTeam.name;
  const loserName = winner === 'home' ? state.awayTeam.name : state.homeTeam.name;
  const winnerScore = winner === 'home' ? summary.homeScore : summary.awayScore;
  const loserScore = winner === 'home' ? summary.awayScore : summary.homeScore;

  return (
    <View style={s.setResult}>
      <Text style={[s.setResultWinner, { color: teamColor(winner, 'header') }]}>{winnerName}</Text>
      <Text style={s.setResultScore}>
        {winnerScore} - {loserScore}
      </Text>
      <Text style={s.setResultLoser}>{loserName}</Text>
    </View>
  );
}

function MatchResultSection({ state }: { state: MatchState }) {
  const setsWon = getSetsWon(state);
  const matchWinner = getMatchWinner(setsWon, state.config);
  if (!matchWinner) return null;

  const winnerName = matchWinner === 'home' ? state.homeTeam.name : state.awayTeam.name;
  const loserName = matchWinner === 'home' ? state.awayTeam.name : state.homeTeam.name;

  // Gather per-set scores
  const setScores: { home: number; away: number }[] = [];
  for (let i = 0; i <= state.currentSetIndex; i++) {
    const sc = getSetScore(state.events, i);
    if (sc.home > 0 || sc.away > 0) setScores.push(sc);
  }

  return (
    <View style={s.matchResult}>
      <Text style={s.matchResultTitle}>MATCH RESULT</Text>
      <Text style={[s.matchResultWinner, { color: teamColor(matchWinner, 'header') }]}>
        {winnerName} wins
      </Text>
      <Text style={s.matchResultRecord}>
        Sets: {setsWon.home} - {setsWon.away}
      </Text>
      <View style={s.matchResultSets}>
        {setScores.map((sc, i) => (
          <View key={i} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 6.5, fontWeight: 'bold', color: C.gray700, marginBottom: 1 }}>
              Set {i + 1}
            </Text>
            <Text style={s.matchSetScore}>
              {sc.home} - {sc.away}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Set Page ───────────────────────────────────────────────

function SetPage({
  summary,
  state,
  isLast,
}: {
  summary: SetSummary;
  state: MatchState;
  isLast: boolean;
}) {
  const { setIndex } = summary;
  const setData = state.sets[setIndex];
  const setSanctions = getSanctions(state.events, setIndex);

  return (
    <Page size="LETTER" orientation="landscape" style={s.page}>
      {/* Metadata */}
      <MetadataHeader state={state} />

      {/* Set header */}
      <View style={s.setHeader}>
        <Text style={s.setTitle}>SET {setIndex + 1}</Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Text style={s.setTimes}>
            Start: {fmtTime(setData?.startTime ?? null)} | End: {fmtTime(setData?.endTime ?? null)}
          </Text>
          {setData?.firstServe && (
            <Text style={s.firstServeTag}>
              1st Serve: {setData.firstServe === 'home' ? state.homeTeam.name : state.awayTeam.name}
            </Text>
          )}
        </View>
        <Text style={s.setTitle}>
          {summary.homeScore} - {summary.awayScore}
        </Text>
      </View>

      {/* Team info + Service rounds (combined) */}
      <TeamServiceSection summary={summary} state={state} />

      {/* Running score */}
      <RunningScoreSection summary={summary} state={state} />

      {/* Timeouts, Subs, Comments, Sanctions */}
      <BottomSection summary={summary} state={state} sanctions={setSanctions} />

      {/* Remarks (show on all pages — they are global) */}
      {isLast && <RemarksSection remarks={state.remarks} />}

      {/* Set result */}
      <SetResultBar summary={summary} state={state} />

      {/* Match result on last page */}
      {isLast && <MatchResultSection state={state} />}
    </Page>
  );
}

// ── Document ───────────────────────────────────────────────

function ScoresheetPdfDocument({ state }: { state: MatchState }) {
  const setsPlayed: number[] = [];
  for (let i = 0; i <= state.currentSetIndex; i++) {
    const score = getSetScore(state.events, i);
    if (score.home > 0 || score.away > 0) setsPlayed.push(i);
  }

  // If no sets have been played, still show set 1
  if (setsPlayed.length === 0) setsPlayed.push(0);

  return (
    <Document>
      {setsPlayed.map((si, idx) => {
        const summary = getSetSummary(state, si);
        return (
          <SetPage
            key={si}
            summary={summary}
            state={state}
            isLast={idx === setsPlayed.length - 1}
          />
        );
      })}
    </Document>
  );
}

// ── Export ──────────────────────────────────────────────────

export async function generatePdf() {
  const state = useMatchStore.getState();
  const blob = await pdf(<ScoresheetPdfDocument state={state} />).toBlob();
  const url = URL.createObjectURL(blob);

  const homeName = state.homeTeam.name.replace(/\s+/g, '_');
  const awayName = state.awayTeam.name.replace(/\s+/g, '_');
  const filename = `scoresheet_${homeName}_vs_${awayName}.pdf`;

  // iOS Safari doesn't support a.click() for downloads — use window.open fallback
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    window.open(url, '_blank');
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Revoke after a short delay to ensure the download starts
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
