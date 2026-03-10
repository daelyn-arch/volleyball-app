import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { useMatchStore } from '@/store/matchStore';
import { getSetSummary, getSetsWon, getSetScore } from '@/store/derived';
import type { MatchState, SetSummary } from '@/types/match';

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: 'Helvetica' },
  header: { marginBottom: 10, textAlign: 'center' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#555' },
  setContainer: { marginBottom: 15, border: '1pt solid #000', borderRadius: 3 },
  setHeader: {
    backgroundColor: '#e5e7eb',
    padding: '4 8',
    borderBottom: '1pt solid #000',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  setTitle: { fontWeight: 'bold', fontSize: 11 },
  row: { flexDirection: 'row', borderBottom: '0.5pt solid #ccc' },
  col: { flex: 1, padding: '3 6', borderRight: '0.5pt solid #ccc' },
  colHeader: { flex: 1, padding: '3 6', borderRight: '0.5pt solid #ccc', backgroundColor: '#f3f4f6', fontWeight: 'bold' },
  sectionLabel: { backgroundColor: '#f9fafb', padding: '2 8', fontWeight: 'bold', borderBottom: '0.5pt solid #ccc' },
  bold: { fontWeight: 'bold' },
  small: { fontSize: 7, color: '#666' },
  lineupRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  lineupPos: { textAlign: 'center', width: 30 },
  runningScoreRow: { flexDirection: 'row', flexWrap: 'wrap', padding: '2 4' },
  scoreCell: {
    width: 16,
    height: 16,
    border: '0.5pt solid #999',
    textAlign: 'center',
    justifyContent: 'center',
    fontSize: 7,
  },
  scoreCellScored: {
    width: 16,
    height: 16,
    border: '0.5pt solid #000',
    textAlign: 'center',
    justifyContent: 'center',
    fontSize: 7,
    fontWeight: 'bold',
    backgroundColor: '#fff',
  },
  serviceRound: {
    border: '0.5pt solid #999',
    borderRadius: 2,
    padding: '1 3',
    marginRight: 3,
    marginBottom: 2,
    fontSize: 7,
  },
  srRow: { flexDirection: 'row', flexWrap: 'wrap', padding: '2 4' },
});

function ScoresheetPdfDocument({ state }: { state: MatchState }) {
  const setsWon = getSetsWon(state);
  const setsPlayed: number[] = [];
  for (let i = 0; i <= state.currentSetIndex; i++) {
    const score = getSetScore(state.events, i);
    if (score.home > 0 || score.away > 0) setsPlayed.push(i);
  }

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Volleyball Scoresheet</Text>
          <Text style={styles.subtitle}>
            {state.homeTeam.name} vs {state.awayTeam.name} | Sets: {setsWon.home}-{setsWon.away} | Best of {state.config.bestOf}
          </Text>
        </View>

        {setsPlayed.map((si) => {
          const summary = getSetSummary(state, si);
          return <SetSection key={si} summary={summary} state={state} />;
        })}
      </Page>
    </Document>
  );
}

function SetSection({ summary, state }: { summary: SetSummary; state: MatchState }) {
  const { setIndex, homeScore, awayScore, winner } = summary;
  const setData = state.sets[setIndex];
  const maxPts = Math.max(homeScore, awayScore, 25);

  return (
    <View style={styles.setContainer} wrap={false}>
      <View style={styles.setHeader}>
        <Text style={styles.setTitle}>Set {setIndex + 1}</Text>
        <Text style={styles.setTitle}>
          {homeScore} - {awayScore}
          {winner ? ` (${winner === 'home' ? state.homeTeam.name : state.awayTeam.name})` : ''}
        </Text>
      </View>

      {/* Lineups */}
      <View style={styles.row}>
        <View style={styles.colHeader}><Text>{state.homeTeam.name} Lineup{setData?.firstServe === 'home' ? ' (1st Serve)' : ''}</Text></View>
        <View style={styles.colHeader}><Text>{state.awayTeam.name} Lineup{setData?.firstServe === 'away' ? ' (1st Serve)' : ''}</Text></View>
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          {setData?.homeLineup ? (
            <View style={styles.lineupRow}>
              {(['I','II','III','IV','V','VI'] as const).map((label, i) => (
                <View key={label} style={styles.lineupPos}>
                  <Text style={styles.small}>{label}</Text>
                  <Text style={styles.bold}>{setData.homeLineup![(i+1) as 1|2|3|4|5|6]}</Text>
                </View>
              ))}
            </View>
          ) : <Text>-</Text>}
        </View>
        <View style={styles.col}>
          {setData?.awayLineup ? (
            <View style={styles.lineupRow}>
              {(['I','II','III','IV','V','VI'] as const).map((label, i) => (
                <View key={label} style={styles.lineupPos}>
                  <Text style={styles.small}>{label}</Text>
                  <Text style={styles.bold}>{setData.awayLineup![(i+1) as 1|2|3|4|5|6]}</Text>
                </View>
              ))}
            </View>
          ) : <Text>-</Text>}
        </View>
      </View>

      {/* Running Score */}
      <Text style={styles.sectionLabel}>Running Score</Text>
      <View style={styles.row}>
        <View style={styles.col}>
          <View style={styles.runningScoreRow}>
            {Array.from({ length: maxPts }, (_, i) => i + 1).map((p) => {
              const entry = summary.homeRunningScore.find((e) => e.point === p);
              return (
                <View key={p} style={entry ? styles.scoreCellScored : styles.scoreCell}>
                  <Text>{p}</Text>
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.col}>
          <View style={styles.runningScoreRow}>
            {Array.from({ length: maxPts }, (_, i) => i + 1).map((p) => {
              const entry = summary.awayRunningScore.find((e) => e.point === p);
              return (
                <View key={p} style={entry ? styles.scoreCellScored : styles.scoreCell}>
                  <Text>{p}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Service Rounds */}
      <Text style={styles.sectionLabel}>Service Rounds</Text>
      <View style={styles.row}>
        <View style={styles.col}>
          <View style={styles.srRow}>
            {summary.homeServiceRounds.map((r, i) => (
              <View key={i} style={styles.serviceRound}>
                <Text>#{r.serverNumber} {r.pointsScored}pt{r.endScore ? ` (${r.endScore.home}-${r.endScore.away})` : ''}</Text>
              </View>
            ))}
            {summary.homeServiceRounds.length === 0 && <Text style={styles.small}>None</Text>}
          </View>
        </View>
        <View style={styles.col}>
          <View style={styles.srRow}>
            {summary.awayServiceRounds.map((r, i) => (
              <View key={i} style={styles.serviceRound}>
                <Text>#{r.serverNumber} {r.pointsScored}pt{r.endScore ? ` (${r.endScore.home}-${r.endScore.away})` : ''}</Text>
              </View>
            ))}
            {summary.awayServiceRounds.length === 0 && <Text style={styles.small}>None</Text>}
          </View>
        </View>
      </View>

      {/* Substitutions */}
      <Text style={styles.sectionLabel}>Substitutions</Text>
      <View style={styles.row}>
        <View style={styles.col}>
          {summary.homeSubstitutions.map((s) => (
            <Text key={s.subNumber}>#{s.subNumber}: #{s.playerIn} in for #{s.playerOut} ({s.homeScore}-{s.awayScore})</Text>
          ))}
          {summary.homeSubstitutions.length === 0 && <Text style={styles.small}>None</Text>}
        </View>
        <View style={styles.col}>
          {summary.awaySubstitutions.map((s) => (
            <Text key={s.subNumber}>#{s.subNumber}: #{s.playerIn} in for #{s.playerOut} ({s.homeScore}-{s.awayScore})</Text>
          ))}
          {summary.awaySubstitutions.length === 0 && <Text style={styles.small}>None</Text>}
        </View>
      </View>

      {/* Timeouts */}
      <Text style={styles.sectionLabel}>Timeouts</Text>
      <View style={styles.row}>
        <View style={styles.col}>
          {summary.homeTimeouts.map((t) => (
            <Text key={t.timeoutNumber}>T/O #{t.timeoutNumber} at {t.homeScore}-{t.awayScore}</Text>
          ))}
          {summary.homeTimeouts.length === 0 && <Text style={styles.small}>None</Text>}
        </View>
        <View style={styles.col}>
          {summary.awayTimeouts.map((t) => (
            <Text key={t.timeoutNumber}>T/O #{t.timeoutNumber} at {t.homeScore}-{t.awayScore}</Text>
          ))}
          {summary.awayTimeouts.length === 0 && <Text style={styles.small}>None</Text>}
        </View>
      </View>
    </View>
  );
}

export async function generatePdf() {
  const state = useMatchStore.getState();
  const blob = await pdf(<ScoresheetPdfDocument state={state} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scoresheet_${state.homeTeam.name}_vs_${state.awayTeam.name}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
