import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { useMatchStore } from '@/store/matchStore';
import { getCifSetData } from '@/store/cifDerived';
import { getSetScore, getSetsWon } from '@/store/derived';
import { getSetWinner } from '@/utils/scoring';
import {
  getSanctions,
  getLiberoNumbers,
  formatSanctionType,
  sanctionColor,
  formatRecipient,
} from '@/store/pdfDerived';
import type { MatchState, CourtPosition, TeamSide } from '@/types/match';
import type { CifPointEntry, CifServiceTerm, CifSetData } from '@/store/cifDerived';

/* ──────────────────── Constants ──────────────────── */

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const HOME_COLOR = '#1d4ed8';
const AWAY_COLOR = '#b91c1c';
const TEAL = '#0d9488';
const SUB_COLOR = '#7c3aed';
const TIMEOUT_COLOR = '#ea580c';
const RESERVE_COLOR = '#0d9488';

/* ──────────────────── Date / time helpers ──────────────────── */

function fmtTime(ts: number | null): string {
  if (!ts) return '--:--';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ──────────────────── Styles ──────────────────── */

const s = StyleSheet.create({
  page: {
    padding: 14,
    paddingBottom: 10,
    fontSize: 10,
    fontFamily: 'Helvetica',
    flexDirection: 'column',
  },

  /* ── Metadata header ── */
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottom: '1pt solid #999',
    paddingBottom: 4,
    marginBottom: 4,
  },
  metaCenter: {
    flex: 1,
    alignItems: 'center',
  },
  metaMatchup: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  metaCompetition: {
    fontSize: 9,
    color: '#555',
    marginTop: 1,
  },
  metaSide: {
    width: 180,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 1,
  },
  metaLabel: {
    fontSize: 7.5,
    color: '#888',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    width: 50,
  },
  metaValue: {
    fontSize: 9,
    color: '#333',
  },

  /* ── Set header ── */
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottom: '0.5pt solid #ddd',
  },
  setTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111',
  },
  setTimeBadge: {
    fontSize: 9,
    color: '#666',
    backgroundColor: '#f3f4f6',
    padding: '2 5',
    borderRadius: 2,
  },
  firstServeBadge: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ca8a04',
    backgroundColor: '#fefce8',
    padding: '2 5',
    borderRadius: 2,
  },

  /* ── Main 3-column row ── */
  mainRow: {
    flexDirection: 'row',
    gap: 6,
  },
  teamSection: {
    flex: 1,
  },

  /* ── Team header bar ── */
  teamHeader: {
    padding: '3 6',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamHeaderHome: { backgroundColor: HOME_COLOR },
  teamHeaderAway: { backgroundColor: AWAY_COLOR },
  teamName: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  teamHeaderSub: { color: 'rgba(255,255,255,0.85)', fontSize: 8 },

  /* ── Position rows ── */
  rowsContainer: {
    border: '0.5pt solid #999',
    borderTop: 'none',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  indRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottom: '0.5pt solid #ddd',
    minHeight: 22,
    paddingVertical: 1,
  },
  posLabel: {
    width: 20,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
  },
  playerNum: {
    width: 24,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 'bold',
    borderRight: '0.5pt solid #ccc',
    paddingRight: 2,
  },
  termsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    paddingLeft: 3,
    paddingRight: 2,
  },
  termBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    border: '0.5pt solid #ddd',
    borderRadius: 2,
    paddingHorizontal: 2,
    paddingVertical: 1,
    backgroundColor: '#fafafa',
  },
  termActive: {
    backgroundColor: '#fefce8',
    borderColor: '#facc15',
  },
  termPoint: {
    width: 14,
    height: 14,
    borderRadius: 7,
    border: '0.5pt solid #666',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  termPointText: {
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  exitScore: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#b91c1c',
    borderLeft: '0.5pt solid #ccc',
    paddingLeft: 2,
    marginLeft: 1,
  },
  footFaultBox: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#b91c1c',
    borderLeft: '0.5pt solid #ccc',
    paddingLeft: 2,
    marginLeft: 1,
    border: '0.75pt solid #b91c1c',
    paddingHorizontal: 2,
    paddingVertical: 0.5,
  },
  inlineEvent: { fontSize: 9, fontWeight: 'bold' },
  inlineSub: { color: SUB_COLOR },
  inlineTimeout: { color: TIMEOUT_COLOR },
  inlineReServe: { color: RESERVE_COLOR },
  noTerms: { fontSize: 9, color: '#ccc', paddingLeft: 3 },

  /* ── Running score ── */
  rsCenter: { width: 155, alignItems: 'center' },
  rsTitle: { fontSize: 9, fontWeight: 'bold', color: '#666', marginBottom: 2, letterSpacing: 0.5 },
  rsColumns: { flexDirection: 'row', gap: 2 },
  rsCol: { alignItems: 'center' },
  rsColLabel: { fontSize: 8, fontWeight: 'bold', marginBottom: 1 },
  rsCellCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    border: '1.2pt solid #1e40af',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 0.5,
  },
  rsCellSlash: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 0.5,
    backgroundColor: '#fef2f2',
    borderRadius: 2,
  },
  rsCellTriangle: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 0.5,
    border: '1.2pt solid #0d9488',
    backgroundColor: '#f0fdfa',
  },
  rsCellPenalty: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 0.5,
    border: '1.2pt solid #dc2626',
    backgroundColor: '#fef2f2',
  },
  rsCellDim: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 0.5,
  },
  rsCellNumScored: { fontSize: 8, fontWeight: 'bold', color: '#111' },
  rsCellNumDim: { fontSize: 8, color: '#ccc' },
  rsDivider: { width: 0.5, backgroundColor: '#ccc', marginHorizontal: 1 },

  /* ── Bottom section ── */
  bottomSection: {
    marginTop: 4,
    paddingTop: 4,
    borderTop: '1pt solid #ccc',
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  subsSection: { flex: 1 },
  sectionLabel: { fontSize: 9, fontWeight: 'bold', color: '#666', marginBottom: 2 },
  toRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginBottom: 3 },
  toBox: {
    width: 40,
    height: 18,
    border: '0.5pt solid #93c5fd',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toBoxAway: { borderColor: '#fca5a5' },
  toBoxFilled: { backgroundColor: '#fff7ed' },
  toText: { fontSize: 9, fontWeight: 'bold', color: '#c2410c' },
  toEmpty: { fontSize: 8, color: '#ccc' },
  subsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1.5 },
  subBox: {
    width: 34,
    height: 15,
    border: '0.5pt solid #93c5fd',
    borderRadius: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subBoxAway: { borderColor: '#fca5a5' },
  subBoxFilled: { backgroundColor: '#f5f3ff' },
  subText: { fontSize: 7.5, fontWeight: 'bold', color: '#6b21a8' },
  subEmpty: { fontSize: 7, color: '#ddd' },

  /* ── Center column (legend + sanctions + remarks) ── */
  centerColumn: {
    flex: 1,
    paddingHorizontal: 4,
    gap: 4,
  },

  /* ── Legend ── */
  legendWrap: {},
  legendTitle: { fontSize: 9, fontWeight: 'bold', color: '#666', marginBottom: 1 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendText: { fontSize: 8, color: '#555' },
  legendCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    border: '0.8pt solid #1e40af',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendSlashBg: {
    width: 12,
    height: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendTriangle: {
    width: 12,
    height: 12,
    border: '0.8pt solid #0d9488',
    backgroundColor: '#f0fdfa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendPenalty: {
    width: 12,
    height: 12,
    border: '0.8pt solid #dc2626',
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Sanctions ── */
  sanctionsWrap: {},
  sanctionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 1.5,
    paddingHorizontal: 3,
    borderBottom: '0.5pt solid #eee',
    borderRadius: 1,
  },
  sanctionBadge: {
    width: 5,
    height: 10,
    borderRadius: 1,
  },
  sanctionType: {
    fontSize: 8,
    fontWeight: 'bold',
    width: 60,
  },
  sanctionTeam: {
    fontSize: 8,
    width: 34,
  },
  sanctionRecip: {
    fontSize: 8,
    width: 48,
  },
  sanctionScore: {
    fontSize: 8,
    color: '#666',
  },

  /* ── Remarks ── */
  remarksWrap: {},
  remarkText: { fontSize: 8, color: '#444', marginBottom: 1.5 },

  /* ── Set result / match result ── */
  setResult: {
    marginTop: 4,
    paddingTop: 3,
    borderTop: '1pt solid #ccc',
    textAlign: 'center',
  },
  setResultText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111',
    textAlign: 'center',
  },
  matchResult: {
    marginTop: 4,
    padding: '5 10',
    backgroundColor: '#f0fdf4',
    border: '1pt solid #86efac',
    borderRadius: 3,
    textAlign: 'center',
  },
  matchResultText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#166534',
    textAlign: 'center',
  },
});

/* ──────────────────── Document ──────────────────── */

function CifPdfDocument({ state }: { state: MatchState }) {
  const setsPlayed: number[] = [];
  for (let i = 0; i <= state.currentSetIndex; i++) {
    const sc = getSetScore(state.events, i);
    if (sc.home > 0 || sc.away > 0 || i === state.currentSetIndex) setsPlayed.push(i);
  }

  const isLastPage = (si: number) => si === setsPlayed[setsPlayed.length - 1];

  return (
    <Document>
      {setsPlayed.map((si) => (
        <Page key={si} size="LETTER" orientation="landscape" style={s.page}>
          <CifSetPage
            state={state}
            setIndex={si}
            showMatchResult={isLastPage(si) && state.matchComplete}
          />
        </Page>
      ))}
    </Document>
  );
}

/* ──────────────────── Set page ──────────────────── */

function CifSetPage({
  state,
  setIndex,
  showMatchResult,
}: {
  state: MatchState;
  setIndex: number;
  showMatchResult: boolean;
}) {
  const cifData = getCifSetData(state, setIndex);
  const setData = state.sets[setIndex];
  const score = getSetScore(state.events, setIndex);
  const winner = getSetWinner(score, setIndex, state.config);
  const sanctions = getSanctions(state.events, setIndex);

  const isDecidingSet = setIndex === state.config.bestOf - 1;
  const maxPoints = isDecidingSet ? state.config.decidingSetPoints : state.config.pointsToWin;
  const homeMax = cifData.points
    .filter((p) => p.scoringTeam === 'home')
    .reduce((m, p) => Math.max(m, p.pointNumber), 0);
  const awayMax = cifData.points
    .filter((p) => p.scoringTeam === 'away')
    .reduce((m, p) => Math.max(m, p.pointNumber), 0);
  const actualMax = Math.max(maxPoints, homeMax, awayMax);

  const homeLiberos = getLiberoNumbers(state.homeTeam.roster);
  const awayLiberos = getLiberoNumbers(state.awayTeam.roster);

  const firstServeTeam = cifData.firstServe;
  const homeIsServing = firstServeTeam === 'home';
  const awayIsServing = firstServeTeam === 'away';

  return (
    <View style={{ flex: 1 }}>
      {/* ── Metadata header ── */}
      <MetadataHeader state={state} />

      {/* ── Set header ── */}
      <View style={s.setHeader}>
        <Text style={s.setTitle}>SET {setIndex + 1}</Text>
        <Text style={s.setTimeBadge}>
          {fmtTime(setData?.startTime ?? null)} - {fmtTime(setData?.endTime ?? null)}
        </Text>
        {firstServeTeam && (
          <Text style={s.firstServeBadge}>
            1st Serve: {firstServeTeam === 'home' ? state.homeTeam.name : state.awayTeam.name}
          </Text>
        )}
      </View>

      {/* ── Main 3-column layout ── */}
      <View style={s.mainRow}>
        <TeamSection
          teamName={state.homeTeam.name}
          side="home"
          startingLineup={cifData.homeStartingLineup}
          positionRows={cifData.homePositionRows}
          isServingFirst={homeIsServing}
          liberoNumbers={homeLiberos}
        />
        <RunningScore
          points={cifData.points}
          maxPoints={actualMax}
          homeTeamName={state.homeTeam.name}
          awayTeamName={state.awayTeam.name}
          homePenaltyPoints={cifData.homePenaltyPoints}
          awayPenaltyPoints={cifData.awayPenaltyPoints}
        />
        <TeamSection
          teamName={state.awayTeam.name}
          side="away"
          startingLineup={cifData.awayStartingLineup}
          positionRows={cifData.awayPositionRows}
          isServingFirst={awayIsServing}
          liberoNumbers={awayLiberos}
        />
      </View>

      {/* ── Bottom section ── */}
      <View style={s.bottomSection}>
        <View style={s.bottomRow}>
          <SubsTimeouts
            substitutions={cifData.homeSubstitutions}
            timeouts={cifData.homeTimeouts}
            maxSubs={state.config.maxSubsPerSet}
            side="home"
          />
          <View style={s.centerColumn}>
            <Legend />
            {sanctions.length > 0 && (
              <SanctionsTable sanctions={sanctions} state={state} />
            )}
            {state.remarks.length > 0 && <Remarks remarks={state.remarks} />}
          </View>
          <SubsTimeouts
            substitutions={cifData.awaySubstitutions}
            timeouts={cifData.awayTimeouts}
            maxSubs={state.config.maxSubsPerSet}
            side="away"
          />
        </View>
      </View>

      {/* ── Set result ── */}
      {winner && (
        <View style={s.setResult}>
          <Text style={s.setResultText}>
            {winner === 'home' ? state.homeTeam.name : state.awayTeam.name} wins{' '}
            {Math.max(score.home, score.away)}-{Math.min(score.home, score.away)}
            {'  '}vs{' '}
            {winner === 'home' ? state.awayTeam.name : state.homeTeam.name}
          </Text>
        </View>
      )}

      {/* ── Match result (last page only) ── */}
      {showMatchResult && <MatchResult state={state} />}
    </View>
  );
}

/* ──────────────────── Metadata header ──────────────────── */

function MetadataHeader({ state }: { state: MatchState }) {
  const m = state.metadata;
  return (
    <View style={s.metaBar}>
      <View style={s.metaSide}>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Event</Text>
          <Text style={s.metaValue}>{m.competition || '--'}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Date</Text>
          <Text style={s.metaValue}>
            {state.createdAt ? fmtDate(state.createdAt) : '--'}
            {m.scheduledTime ? ` at ${m.scheduledTime}` : ''}
          </Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Venue</Text>
          <Text style={s.metaValue}>
            {m.hall || '--'}{m.cityState ? `, ${m.cityState}` : ''}
          </Text>
        </View>
      </View>
      <View style={s.metaCenter}>
        <Text style={s.metaMatchup}>
          {state.homeTeam.name} vs {state.awayTeam.name}
        </Text>
        <Text style={s.metaCompetition}>
          {[m.division, m.category, m.level, m.poolPhase].filter(Boolean).join(' / ') || 'Volleyball Scoresheet'}
        </Text>
      </View>
      <View style={s.metaSide}>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Court</Text>
          <Text style={s.metaValue}>{m.court || '--'}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Ref</Text>
          <Text style={s.metaValue}>{m.referee || '--'}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Down Ref</Text>
          <Text style={s.metaValue}>{m.downRef || '--'}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Scorer</Text>
          <Text style={s.metaValue}>{m.scorer || '--'}</Text>
        </View>
      </View>
    </View>
  );
}

/* ──────────────────── Team section ──────────────────── */

function TeamSection({
  teamName,
  side,
  startingLineup,
  positionRows,
  isServingFirst,
  liberoNumbers,
}: {
  teamName: string;
  side: TeamSide;
  startingLineup: Record<CourtPosition, number> | null;
  positionRows: Record<CourtPosition, CifServiceTerm[]>;
  isServingFirst: boolean;
  liberoNumbers: Set<number>;
}) {
  const libArr = Array.from(liberoNumbers);
  const libStr = libArr.length > 0 ? `LIB: ${libArr.map((n) => `#${n}`).join(', ')}` : '';
  const serveLabel = isServingFirst ? 'SERVE' : 'RECEIVE';

  return (
    <View style={s.teamSection}>
      <View style={[s.teamHeader, side === 'home' ? s.teamHeaderHome : s.teamHeaderAway]}>
        <View>
          <Text style={s.teamName}>{teamName}</Text>
          {libStr ? <Text style={s.teamHeaderSub}>{libStr}</Text> : null}
        </View>
        <Text style={s.teamHeaderSub}>{serveLabel}</Text>
      </View>
      <View style={s.rowsContainer}>
        {([1, 2, 3, 4, 5, 6] as CourtPosition[]).map((pos) => (
          <IndividualRow
            key={pos}
            position={pos}
            terms={positionRows[pos]}
            startingPlayer={startingLineup ? startingLineup[pos] : 0}
          />
        ))}
      </View>
    </View>
  );
}

/* ──────────────────── Individual position row ──────────────────── */

function IndividualRow({
  position,
  terms,
  startingPlayer,
}: {
  position: number;
  terms: CifServiceTerm[];
  startingPlayer: number;
}) {
  return (
    <View style={s.indRow}>
      <Text style={s.posLabel}>{ROMAN[position - 1]}</Text>
      <Text style={s.playerNum}>{startingPlayer || ''}</Text>
      <View style={s.termsWrap}>
        {terms.length === 0 && <Text style={s.noTerms}>---</Text>}
        {terms.map((term, i) => {
          const isActive = i === terms.length - 1 && term.exitScore === null;
          return (
            <View key={i} style={[s.termBlock, isActive ? s.termActive : {}]}>
              {term.inlineEvents.map((ev, j) => {
                let evStyle = s.inlineSub;
                let label = '';
                if (ev.type === 'timeout') {
                  evStyle = s.inlineTimeout;
                  label = ev.forServingTeam ? 'T' : 'Tx';
                } else if (ev.type === 'reServe') {
                  evStyle = s.inlineReServe;
                  label = 'RS';
                } else {
                  label = ev.forServingTeam ? 'S' : 'Sx';
                }
                return (
                  <Text key={j} style={[s.inlineEvent, evStyle]}>
                    {label}
                  </Text>
                );
              })}
              {term.sideoutPoint !== null && (
                <Text style={{ fontSize: 6.5, fontWeight: 'bold', color: '#666' }}>
                  {term.sideoutPoint}
                </Text>
              )}
              {term.servedPoints.map((pt) => (
                <View key={pt} style={s.termPoint}>
                  <Text style={s.termPointText}>{pt}</Text>
                </View>
              ))}
              {term.exitScore !== null &&
                (term.wasFootFault ? (
                  <Text style={s.footFaultBox}>R</Text>
                ) : (
                  <Text style={s.exitScore}>{term.exitScore}</Text>
                ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ──────────────────── Running score ──────────────────── */

function RunningScore({
  points,
  maxPoints,
  homeTeamName,
  awayTeamName,
  homePenaltyPoints,
  awayPenaltyPoints,
}: {
  points: CifPointEntry[];
  maxPoints: number;
  homeTeamName: string;
  awayTeamName: string;
  homePenaltyPoints: Set<number>;
  awayPenaltyPoints: Set<number>;
}) {
  const homePoints = new Map<number, CifPointEntry>();
  const awayPoints = new Map<number, CifPointEntry>();
  for (const p of points) {
    if (p.scoringTeam === 'home') homePoints.set(p.pointNumber, p);
    else awayPoints.set(p.pointNumber, p);
  }

  const mid = Math.ceil(maxPoints / 2);
  const firstHalf = Array.from({ length: mid }, (_, i) => i + 1);
  const secondHalf = Array.from({ length: maxPoints - mid }, (_, i) => mid + i + 1);

  return (
    <View style={s.rsCenter}>
      <Text style={s.rsTitle}>RUNNING SCORE</Text>
      <View style={s.rsColumns}>
        <ScoreCol
          label={homeTeamName}
          color={HOME_COLOR}
          numbers={firstHalf}
          pointMap={homePoints}
          penaltyPoints={homePenaltyPoints}
        />
        <ScoreCol
          label={awayTeamName}
          color={AWAY_COLOR}
          numbers={firstHalf}
          pointMap={awayPoints}
          penaltyPoints={awayPenaltyPoints}
        />
        {secondHalf.length > 0 && (
          <>
            <View style={s.rsDivider} />
            <ScoreCol
              label={homeTeamName}
              color={HOME_COLOR}
              numbers={secondHalf}
              pointMap={homePoints}
              penaltyPoints={homePenaltyPoints}
            />
            <ScoreCol
              label={awayTeamName}
              color={AWAY_COLOR}
              numbers={secondHalf}
              pointMap={awayPoints}
              penaltyPoints={awayPenaltyPoints}
            />
          </>
        )}
      </View>
    </View>
  );
}

function ScoreCol({
  label,
  color,
  numbers,
  pointMap,
  penaltyPoints,
}: {
  label: string;
  color: string;
  numbers: number[];
  pointMap: Map<number, CifPointEntry>;
  penaltyPoints: Set<number>;
}) {
  return (
    <View style={s.rsCol}>
      <Text style={[s.rsColLabel, { color }]}>{label.slice(0, 3).toUpperCase()}</Text>
      {numbers.map((num) => {
        const entry = pointMap.get(num);
        if (!entry) {
          return (
            <View key={num} style={s.rsCellDim}>
              <Text style={s.rsCellNumDim}>{num}</Text>
            </View>
          );
        }

        // Penalty point = boxed "P" style
        if (penaltyPoints.has(num)) {
          return (
            <View key={num} style={s.rsCellPenalty}>
              <Text style={{ fontSize: 6.5, fontWeight: 'bold', color: '#dc2626' }}>P{num}</Text>
            </View>
          );
        }

        // Libero serving = triangle/teal style
        if (entry.wasLiberoServing && entry.wasServedPoint) {
          return (
            <View key={num} style={s.rsCellTriangle}>
              <Text style={s.rsCellNumScored}>{num}</Text>
            </View>
          );
        }

        // Served point = circle
        if (entry.wasServedPoint) {
          return (
            <View key={num} style={s.rsCellCircle}>
              <Text style={s.rsCellNumScored}>{num}</Text>
            </View>
          );
        }

        // Rally / sideout point = red background
        return (
          <View key={num} style={s.rsCellSlash}>
            <Text style={{ fontSize: 6.5, fontWeight: 'bold', color: '#dc2626' }}>{num}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* ──────────────────── Subs & Timeouts ──────────────────── */

function SubsTimeouts({
  substitutions,
  timeouts,
  maxSubs,
  side,
}: {
  substitutions: { playerIn: number; playerOut: number }[];
  timeouts: { timeoutNumber: number; homeScore: number; awayScore: number }[];
  maxSubs: number;
  side: TeamSide;
}) {
  const isAway = side === 'away';
  return (
    <View style={s.subsSection}>
      <View style={s.toRow}>
        <Text style={s.sectionLabel}>T/O</Text>
        {[1, 2].map((n) => {
          const to = timeouts.find((t) => t.timeoutNumber === n);
          return (
            <View
              key={n}
              style={[s.toBox, isAway ? s.toBoxAway : {}, to ? s.toBoxFilled : {}]}
            >
              {to ? (
                <Text style={s.toText}>
                  {to.homeScore}-{to.awayScore}
                </Text>
              ) : (
                <Text style={s.toEmpty}>{n}</Text>
              )}
            </View>
          );
        })}
      </View>
      <Text style={s.sectionLabel}>
        SUBS ({substitutions.length}/{maxSubs})
      </Text>
      <View style={s.subsGrid}>
        {Array.from({ length: maxSubs }, (_, i) => {
          const sub = substitutions[i];
          return (
            <View
              key={i}
              style={[s.subBox, isAway ? s.subBoxAway : {}, sub ? s.subBoxFilled : {}]}
            >
              {sub ? (
                <Text style={s.subText}>
                  {sub.playerIn}/{sub.playerOut}
                </Text>
              ) : (
                <Text style={s.subEmpty}>{i + 1}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ──────────────────── Legend (compact) ──────────────────── */

function Legend() {
  return (
    <View style={s.legendWrap}>
      <Text style={s.legendTitle}>SCORING KEY</Text>
      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <View style={s.legendCircle}>
            <Text style={{ fontSize: 5, fontWeight: 'bold' }}>n</Text>
          </View>
          <Text style={s.legendText}>Served</Text>
        </View>
        <View style={s.legendItem}>
          <View style={s.legendSlashBg}>
            <Text style={{ fontSize: 6, fontWeight: 'bold', color: '#dc2626' }}>n</Text>
          </View>
          <Text style={s.legendText}>Rally</Text>
        </View>
        <View style={s.legendItem}>
          <View style={s.legendTriangle}>
            <Text style={{ fontSize: 5, fontWeight: 'bold', color: TEAL }}>n</Text>
          </View>
          <Text style={s.legendText}>Libero srv</Text>
        </View>
        <View style={s.legendItem}>
          <View style={s.legendPenalty}>
            <Text style={{ fontSize: 5, fontWeight: 'bold', color: '#dc2626' }}>P</Text>
          </View>
          <Text style={s.legendText}>Penalty</Text>
        </View>
      </View>
      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <Text style={{ fontSize: 7, fontWeight: 'bold', color: SUB_COLOR, width: 12, textAlign: 'center' }}>S</Text>
          <Text style={s.legendText}>Sub (own)</Text>
        </View>
        <View style={s.legendItem}>
          <Text style={{ fontSize: 7, fontWeight: 'bold', color: SUB_COLOR, width: 12, textAlign: 'center' }}>Sx</Text>
          <Text style={s.legendText}>Sub (opp)</Text>
        </View>
        <View style={s.legendItem}>
          <Text style={{ fontSize: 7, fontWeight: 'bold', color: TIMEOUT_COLOR, width: 12, textAlign: 'center' }}>T</Text>
          <Text style={s.legendText}>T/O (own)</Text>
        </View>
        <View style={s.legendItem}>
          <Text style={{ fontSize: 7, fontWeight: 'bold', color: TIMEOUT_COLOR, width: 12, textAlign: 'center' }}>Tx</Text>
          <Text style={s.legendText}>T/O (opp)</Text>
        </View>
        <View style={s.legendItem}>
          <Text style={{ fontSize: 7, fontWeight: 'bold', color: RESERVE_COLOR, width: 12, textAlign: 'center' }}>RS</Text>
          <Text style={s.legendText}>Re-serve</Text>
        </View>
      </View>
    </View>
  );
}

/* ──────────────────── Sanctions table ──────────────────── */

function SanctionsTable({
  sanctions,
  state,
}: {
  sanctions: import('@/types/match').SanctionEvent[];
  state: MatchState;
}) {
  return (
    <View style={s.sanctionsWrap}>
      <Text style={s.sectionLabel}>SANCTIONS</Text>
      {sanctions.map((san, i) => {
        const bgColor = sanctionColor(san.sanctionType);
        const teamName = san.team === 'home' ? state.homeTeam.name : state.awayTeam.name;
        return (
          <View key={i} style={s.sanctionRow}>
            <View style={[s.sanctionBadge, { backgroundColor: bgColor }]} />
            <Text style={[s.sanctionType, { color: bgColor }]}>
              {formatSanctionType(san.sanctionType)}
            </Text>
            <Text style={s.sanctionTeam}>{teamName}</Text>
            <Text style={s.sanctionRecip}>
              {formatRecipient(san.sanctionRecipient, san.playerNumber)}
            </Text>
            <Text style={s.sanctionScore}>
              {san.homeScore}-{san.awayScore}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* ──────────────────── Remarks ──────────────────── */

function Remarks({ remarks }: { remarks: string[] }) {
  return (
    <View style={s.remarksWrap}>
      <Text style={s.sectionLabel}>REMARKS</Text>
      {remarks.map((r, i) => (
        <Text key={i} style={s.remarkText}>
          {'\u2022'} {r}
        </Text>
      ))}
    </View>
  );
}

/* ──────────────────── Match result ──────────────────── */

function MatchResult({ state }: { state: MatchState }) {
  const setsWon = getSetsWon(state);
  const matchWinner: TeamSide | null =
    setsWon.home > setsWon.away ? 'home' : setsWon.away > setsWon.home ? 'away' : null;

  if (!matchWinner) return null;

  const winnerName = matchWinner === 'home' ? state.homeTeam.name : state.awayTeam.name;
  const winnerSets = Math.max(setsWon.home, setsWon.away);
  const loserSets = Math.min(setsWon.home, setsWon.away);

  return (
    <View style={s.matchResult}>
      <Text style={s.matchResultText}>
        MATCH: {winnerName} wins {winnerSets}-{loserSets}
      </Text>
    </View>
  );
}

/* ──────────────────── Export ──────────────────── */

export async function downloadCifPdf() {
  const state = useMatchStore.getState();
  const blob = await pdf(<CifPdfDocument state={state} />).toBlob();
  const url = URL.createObjectURL(blob);
  const filename = `cif_scoresheet_${state.homeTeam.name}_vs_${state.awayTeam.name}.pdf`;

  // iOS Safari doesn't support a.click() on blob URLs -- open in new tab instead
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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
