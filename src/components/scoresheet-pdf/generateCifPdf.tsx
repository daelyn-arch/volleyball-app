import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { useMatchStore } from '@/store/matchStore';
import { getCifSetData } from '@/store/cifDerived';
import { getSetScore } from '@/store/derived';
import type { MatchState, CourtPosition } from '@/types/match';
import type { CifPointEntry, CifServiceTerm } from '@/store/cifDerived';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

const s = StyleSheet.create({
  page: { padding: 20, fontSize: 8, fontFamily: 'Helvetica' },
  setHeader: { textAlign: 'center', fontSize: 13, fontWeight: 'bold', marginBottom: 6, paddingBottom: 4, borderBottom: '1pt solid #ccc' },
  mainRow: { flexDirection: 'row', gap: 8 },
  teamSection: { flex: 1 },
  teamHeader: { padding: '3 6', borderTopLeftRadius: 3, borderTopRightRadius: 3, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamHeaderHome: { backgroundColor: '#1d4ed8' },
  teamHeaderAway: { backgroundColor: '#b91c1c' },
  teamName: { color: 'white', fontSize: 9, fontWeight: 'bold' },
  firstServe: { color: '#fde047', fontSize: 7 },
  rowsContainer: { border: '0.5pt solid #999', borderTop: 'none', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  indRow: { flexDirection: 'row', alignItems: 'center', borderBottom: '0.5pt solid #ddd', minHeight: 18, paddingVertical: 1 },
  posLabel: { width: 16, textAlign: 'center', fontSize: 8, fontWeight: 'bold', color: '#666' },
  playerNum: { width: 20, textAlign: 'center', fontSize: 9, fontWeight: 'bold', borderRight: '0.5pt solid #ccc', paddingRight: 2 },
  termsWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingLeft: 3, paddingRight: 2 },
  termBlock: { flexDirection: 'row', alignItems: 'center', gap: 1, border: '0.5pt solid #ddd', borderRadius: 2, paddingHorizontal: 2, paddingVertical: 1, backgroundColor: '#fafafa' },
  termActive: { backgroundColor: '#fefce8', borderColor: '#facc15' },
  termPoint: { width: 11, height: 11, borderRadius: 6, border: '0.5pt solid #666', justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  termPointText: { fontSize: 6, fontWeight: 'bold', textAlign: 'center' },
  exitScore: { fontSize: 7, fontWeight: 'bold', color: '#b91c1c', borderLeft: '0.5pt solid #ccc', paddingLeft: 2, marginLeft: 1 },
  inlineEvent: { fontSize: 7, fontWeight: 'bold' },
  inlineSub: { color: '#7c3aed' },
  inlineTimeout: { color: '#ea580c' },
  noTerms: { fontSize: 7, color: '#ccc', paddingLeft: 3 },

  // Running score
  rsCenter: { width: 120, alignItems: 'center' },
  rsTitle: { fontSize: 7, fontWeight: 'bold', color: '#666', marginBottom: 2, letterSpacing: 0.5 },
  rsColumns: { flexDirection: 'row', gap: 2 },
  rsCol: { alignItems: 'center' },
  rsColLabel: { fontSize: 6, fontWeight: 'bold', marginBottom: 1 },
  // Scored cells — circle (served) vs slash (rally) vs triangle (libero)
  rsCellCircle: { width: 14, height: 14, borderRadius: 7, border: '1.2pt solid #1e40af', justifyContent: 'center', alignItems: 'center', marginVertical: 0.5 },
  rsCellSlash: { width: 14, height: 14, justifyContent: 'center', alignItems: 'center', marginVertical: 0.5, backgroundColor: '#fef2f2', borderRadius: 2 },
  rsCellTriangle: { width: 14, height: 14, justifyContent: 'center', alignItems: 'center', marginVertical: 0.5, border: '1.2pt solid #0d9488', backgroundColor: '#f0fdfa' },
  rsCellDim: { width: 14, height: 14, justifyContent: 'center', alignItems: 'center', marginVertical: 0.5 },
  rsCellNumScored: { fontSize: 7, fontWeight: 'bold', color: '#111' },
  rsCellNumDim: { fontSize: 7, color: '#ccc' },
  rsSlashMark: { fontSize: 9, color: '#dc2626', fontWeight: 'bold', lineHeight: 1 },
  rsDivider: { width: 0.5, backgroundColor: '#ccc', marginHorizontal: 1 },

  // Bottom section
  bottomRow: { flexDirection: 'row', gap: 8, marginTop: 6, paddingTop: 6, borderTop: '1pt solid #ccc', alignItems: 'flex-start' },
  subsSection: { flex: 1 },
  sectionLabel: { fontSize: 7, fontWeight: 'bold', color: '#666', marginBottom: 2 },
  toRow: { flexDirection: 'row', gap: 3, alignItems: 'center', marginBottom: 3 },
  toBox: { width: 32, height: 14, border: '0.5pt solid #93c5fd', borderRadius: 2, justifyContent: 'center', alignItems: 'center' },
  toBoxAway: { borderColor: '#fca5a5' },
  toBoxFilled: { backgroundColor: '#fff7ed' },
  toText: { fontSize: 7, fontWeight: 'bold', color: '#c2410c' },
  toEmpty: { fontSize: 7, color: '#ccc' },
  subsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1 },
  subBox: { width: 28, height: 12, border: '0.5pt solid #93c5fd', borderRadius: 1, justifyContent: 'center', alignItems: 'center' },
  subBoxAway: { borderColor: '#fca5a5' },
  subBoxFilled: { backgroundColor: '#f5f3ff' },
  subText: { fontSize: 6, fontWeight: 'bold', color: '#6b21a8' },
  subEmpty: { fontSize: 6, color: '#ddd' },

  // Legend
  legendCenter: { flex: 1, paddingHorizontal: 8 },
  legendTitle: { fontSize: 7, fontWeight: 'bold', color: '#666', marginBottom: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 1 },
  legendText: { fontSize: 7, color: '#555' },
  legendIcon: { width: 14, height: 14, justifyContent: 'center', alignItems: 'center' },
  legendCircle: { width: 12, height: 12, borderRadius: 6, border: '1pt solid #1e40af', justifyContent: 'center', alignItems: 'center' },
  legendSlashBg: { width: 12, height: 12, backgroundColor: '#fef2f2', borderRadius: 2, justifyContent: 'center', alignItems: 'center' },
  legendTriangle: { width: 12, height: 12, border: '1pt solid #0d9488', backgroundColor: '#f0fdfa', justifyContent: 'center', alignItems: 'center' },
  legendBold: { fontSize: 7, fontWeight: 'bold', width: 14, textAlign: 'center' },
});

function CifPdfDocument({ state }: { state: MatchState }) {
  const setsPlayed: number[] = [];
  for (let i = 0; i <= state.currentSetIndex; i++) {
    const sc = getSetScore(state.events, i);
    if (sc.home > 0 || sc.away > 0 || i === state.currentSetIndex) setsPlayed.push(i);
  }

  return (
    <Document>
      {setsPlayed.map((si) => (
        <Page key={si} size="LETTER" orientation="landscape" style={s.page}>
          <CifSetPage state={state} setIndex={si} />
        </Page>
      ))}
    </Document>
  );
}

function CifSetPage({ state, setIndex }: { state: MatchState; setIndex: number }) {
  const cifData = getCifSetData(state, setIndex);
  const isDecidingSet = setIndex === state.config.bestOf - 1;
  const maxPoints = isDecidingSet ? state.config.decidingSetPoints : state.config.pointsToWin;
  const homeMax = cifData.points.filter(p => p.scoringTeam === 'home').reduce((m, p) => Math.max(m, p.pointNumber), 0);
  const awayMax = cifData.points.filter(p => p.scoringTeam === 'away').reduce((m, p) => Math.max(m, p.pointNumber), 0);
  const actualMax = Math.max(maxPoints, homeMax, awayMax);

  return (
    <View>
      <Text style={s.setHeader}>SET {setIndex + 1}</Text>
      <View style={s.mainRow}>
        <TeamSection
          teamName={state.homeTeam.name}
          side="home"
          startingLineup={cifData.homeStartingLineup}
          positionRows={cifData.homePositionRows}
          isServingFirst={cifData.firstServe === 'home'}
        />
        <RunningScore
          points={cifData.points}
          maxPoints={actualMax}
          homeTeamName={state.homeTeam.name}
          awayTeamName={state.awayTeam.name}
        />
        <TeamSection
          teamName={state.awayTeam.name}
          side="away"
          startingLineup={cifData.awayStartingLineup}
          positionRows={cifData.awayPositionRows}
          isServingFirst={cifData.firstServe === 'away'}
        />
      </View>
      <View style={s.bottomRow}>
        <SubsTimeouts
          substitutions={cifData.homeSubstitutions}
          timeouts={cifData.homeTimeouts}
          maxSubs={state.config.maxSubsPerSet}
          side="home"
        />
        <Legend />
        <SubsTimeouts
          substitutions={cifData.awaySubstitutions}
          timeouts={cifData.awayTimeouts}
          maxSubs={state.config.maxSubsPerSet}
          side="away"
        />
      </View>
    </View>
  );
}

function TeamSection({ teamName, side, startingLineup, positionRows, isServingFirst }: {
  teamName: string;
  side: 'home' | 'away';
  startingLineup: Record<CourtPosition, number> | null;
  positionRows: Record<CourtPosition, CifServiceTerm[]>;
  isServingFirst: boolean;
}) {
  return (
    <View style={s.teamSection}>
      <View style={[s.teamHeader, side === 'home' ? s.teamHeaderHome : s.teamHeaderAway]}>
        <Text style={s.teamName}>{teamName}</Text>
        {isServingFirst && <Text style={s.firstServe}>1st Serve</Text>}
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

function IndividualRow({ position, terms, startingPlayer }: {
  position: number;
  terms: CifServiceTerm[];
  startingPlayer: number;
}) {
  return (
    <View style={s.indRow}>
      <Text style={s.posLabel}>{ROMAN[position - 1]}</Text>
      <Text style={s.playerNum}>{startingPlayer}</Text>
      <View style={s.termsWrap}>
        {terms.length === 0 && <Text style={s.noTerms}>—</Text>}
        {terms.map((term, i) => {
          const isActive = i === terms.length - 1 && term.exitScore === null;
          return (
            <View key={i} style={[s.termBlock, isActive ? s.termActive : {}]}>
              {term.inlineEvents.map((ev, j) => (
                <Text key={j} style={[s.inlineEvent, ev.type === 'timeout' ? s.inlineTimeout : s.inlineSub]}>
                  {ev.type === 'timeout' ? (ev.forServingTeam ? 'T' : 'Tx') : ev.forServingTeam ? 'S' : 'Sx'}
                </Text>
              ))}
              {term.servedPoints.map((pt) => (
                <View key={pt} style={s.termPoint}>
                  <Text style={s.termPointText}>{pt}</Text>
                </View>
              ))}
              {term.exitScore !== null && (
                <Text style={s.exitScore}>{term.exitScore}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function RunningScore({ points, maxPoints, homeTeamName, awayTeamName }: {
  points: CifPointEntry[];
  maxPoints: number;
  homeTeamName: string;
  awayTeamName: string;
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
        <ScoreCol label={homeTeamName} color="#1d4ed8" numbers={firstHalf} pointMap={homePoints} />
        <ScoreCol label={awayTeamName} color="#b91c1c" numbers={firstHalf} pointMap={awayPoints} />
        {secondHalf.length > 0 && (
          <>
            <View style={s.rsDivider} />
            <ScoreCol label={homeTeamName} color="#1d4ed8" numbers={secondHalf} pointMap={homePoints} />
            <ScoreCol label={awayTeamName} color="#b91c1c" numbers={secondHalf} pointMap={awayPoints} />
          </>
        )}
      </View>
    </View>
  );
}

function ScoreCol({ label, color, numbers, pointMap }: {
  label: string;
  color: string;
  numbers: number[];
  pointMap: Map<number, CifPointEntry>;
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
        // Libero serving = triangle-style box
        if (entry.wasLiberoServing && entry.wasServedPoint) {
          return (
            <View key={num} style={s.rsCellTriangle}>
              <Text style={s.rsCellNumScored}>{num}</Text>
            </View>
          );
        }
        // Served point = circle border
        if (entry.wasServedPoint) {
          return (
            <View key={num} style={s.rsCellCircle}>
              <Text style={s.rsCellNumScored}>{num}</Text>
            </View>
          );
        }
        // Rally point (sideout) = red background
        return (
          <View key={num} style={s.rsCellSlash}>
            <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#dc2626' }}>{num}</Text>
          </View>
        );
      })}
    </View>
  );
}

function SubsTimeouts({ substitutions, timeouts, maxSubs, side }: {
  substitutions: { playerIn: number; playerOut: number }[];
  timeouts: { timeoutNumber: number; homeScore: number; awayScore: number }[];
  maxSubs: number;
  side: 'home' | 'away';
}) {
  const isAway = side === 'away';
  return (
    <View style={s.subsSection}>
      <View style={s.toRow}>
        <Text style={s.sectionLabel}>T/O</Text>
        {[1, 2].map((n) => {
          const to = timeouts.find(t => t.timeoutNumber === n);
          return (
            <View key={n} style={[s.toBox, isAway ? s.toBoxAway : {}, to ? s.toBoxFilled : {}]}>
              {to ? <Text style={s.toText}>{to.homeScore}-{to.awayScore}</Text> : <Text style={s.toEmpty}>{n}</Text>}
            </View>
          );
        })}
      </View>
      <Text style={s.sectionLabel}>SUBS ({substitutions.length}/{maxSubs})</Text>
      <View style={s.subsGrid}>
        {Array.from({ length: Math.min(maxSubs, 15) }, (_, i) => {
          const sub = substitutions[i];
          return (
            <View key={i} style={[s.subBox, isAway ? s.subBoxAway : {}, sub ? s.subBoxFilled : {}]}>
              {sub ? <Text style={s.subText}>{sub.playerIn}/{sub.playerOut}</Text> : <Text style={s.subEmpty}>{i + 1}</Text>}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Legend() {
  return (
    <View style={s.legendCenter}>
      <Text style={s.legendTitle}>SCORING KEY</Text>
      <View style={s.legendItem}>
        <View style={s.legendCircle}>
          <Text style={{ fontSize: 5, fontWeight: 'bold' }}>O</Text>
        </View>
        <Text style={s.legendText}>Served point (circle)</Text>
      </View>
      <View style={s.legendItem}>
        <View style={s.legendSlashBg}>
          <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#dc2626' }}>/</Text>
        </View>
        <Text style={s.legendText}>Rally point (sideout)</Text>
      </View>
      <View style={s.legendItem}>
        <View style={s.legendTriangle}>
          <Text style={{ fontSize: 5, fontWeight: 'bold', color: '#0d9488' }}>L</Text>
        </View>
        <Text style={s.legendText}>Libero serving</Text>
      </View>
      <View style={s.legendItem}>
        <Text style={[s.legendBold, { color: '#7c3aed' }]}>S</Text>
        <Text style={s.legendText}>Sub (this team)</Text>
      </View>
      <View style={s.legendItem}>
        <Text style={[s.legendBold, { color: '#7c3aed' }]}>Sx</Text>
        <Text style={s.legendText}>Sub (opponent)</Text>
      </View>
      <View style={s.legendItem}>
        <Text style={[s.legendBold, { color: '#ea580c' }]}>T</Text>
        <Text style={s.legendText}>Timeout (this team)</Text>
      </View>
      <View style={s.legendItem}>
        <Text style={[s.legendBold, { color: '#ea580c' }]}>Tx</Text>
        <Text style={s.legendText}>Timeout (opponent)</Text>
      </View>
    </View>
  );
}

export async function downloadCifPdf() {
  const state = useMatchStore.getState();
  const blob = await pdf(<CifPdfDocument state={state} />).toBlob();
  const url = URL.createObjectURL(blob);
  const filename = `cif_scoresheet_${state.homeTeam.name}_vs_${state.awayTeam.name}.pdf`;

  // iOS Safari doesn't support a.click() on blob URLs — open in new tab instead
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
