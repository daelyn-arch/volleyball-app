import { PDFDocument } from 'pdf-lib';
import type { MatchState, TeamSide, CourtPosition } from '@/types/match';
import {
  getSetScore,
  getSetsWon,
  getSetSummary,
  getServiceRounds,
  getSubstitutions,
  getTimeouts,
  getRunningScoreData,
  getCurrentRotation,
} from '@/store/derived';
import { getSetWinner } from '@/utils/scoring';

/**
 * Field naming convention in the prepared PDF:
 *
 * Left team Set 1: no suffix (e.g. "Left_P1", "Left_1", "left_1_score_service_round_1")
 * Right team Set 1: suffix "#1"
 * Left team Set 2: suffix "#2"
 * Right team Set 2: suffix "#3"
 *
 * The "left" team on the scoresheet corresponds to whichever team is on the
 * left bench side for that set (homeBenchSide). For now we map:
 *   home = left side of scoresheet
 *   away = right side of scoresheet
 */

type SetQuadrant = '' | '#1' | '#2' | '#3';

function getSuffix(setIndex: number, side: 'left' | 'right'): SetQuadrant {
  if (setIndex === 0 && side === 'left') return '';
  if (setIndex === 0 && side === 'right') return '#1';
  if (setIndex === 1 && side === 'left') return '#2';
  if (setIndex === 1 && side === 'right') return '#3';
  return '';
}

function safeSetField(form: any, name: string, value: string) {
  try {
    const field = form.getTextField(name);
    field.setText(value);
  } catch {
    // Field doesn't exist in this version of the PDF — skip silently
  }
}

function safeSetCheckbox(form: any, name: string, checked: boolean) {
  try {
    const field = form.getCheckBox(name);
    if (checked) field.check();
    else field.uncheck();
  } catch {
    // skip
  }
}

function fillTeamSetFields(
  form: any,
  state: MatchState,
  setIndex: number,
  team: TeamSide,
  suffix: SetQuadrant
) {
  const setData = state.sets[setIndex];
  if (!setData) return;

  const lineup = team === 'home' ? setData.homeLineup : setData.awayLineup;

  // ── Lineup (Left_P1 through Left_P6) ──
  // P1 = position I (server), P2 = position II, etc.
  if (lineup) {
    for (let pos = 1; pos <= 6; pos++) {
      const fieldName = `Left_P${pos}${suffix}`;
      safeSetField(form, fieldName, String(lineup[pos as CourtPosition]));
    }
  }

  // ── Running Score (Left_1 through Left_35) ──
  // These appear to be the point-by-point running score columns.
  // On a USAV scoresheet the running score has numbers 1-25 (or more for deuce)
  // with the server number written next to each point scored.
  // Left_1 through Left_25 = point numbers, Left_26-35 = deuce extension
  const runningScore = getRunningScoreData(state.events, setIndex);
  const teamScore = team === 'home' ? runningScore.home : runningScore.away;

  for (const entry of teamScore) {
    if (entry.point >= 1 && entry.point <= 35) {
      const fieldName = `Left_${entry.point}${suffix}`;
      safeSetField(form, fieldName, String(entry.serverNumber));
    }
  }

  // ── Service Rounds ──
  // left_N_score_service_round_M where N=position(1-6), M=round detail(1-6)
  // The grid is 6 columns (one per lineup position) × 6 rows.
  // Row layout per position column appears to be:
  //   _1 = top-left of pair (server number or start score)
  //   _2 = middle-left
  //   _3 = bottom-left
  //   _4 = top-right
  //   _5 = middle-right
  //   _6 = bottom-right
  // This maps to the USAV service round boxes which show:
  //   server# | exit score for serving team
  //   start   | exit score for receiving team
  const serviceRounds = getServiceRounds(state.events, setIndex, setData);
  const teamRounds = team === 'home' ? serviceRounds.home : serviceRounds.away;

  for (let i = 0; i < teamRounds.length && i < 6; i++) {
    const round = teamRounds[i];
    const col = i + 1; // position column 1-6
    const prefix = `left_${col}_score_service_round_`;

    // Row 1: server number
    safeSetField(form, `${prefix}1${suffix}`, String(round.serverNumber));
    // Row 2: points scored in this round
    safeSetField(form, `${prefix}2${suffix}`, String(round.pointsScored));
    // Row 3: empty or additional info
    if (round.endScore) {
      const teamEndScore = team === 'home' ? round.endScore.home : round.endScore.away;
      safeSetField(form, `${prefix}3${suffix}`, String(teamEndScore));
    }
    // Rows 4-6: exit scores
    if (round.endScore) {
      const oppEndScore = team === 'home' ? round.endScore.away : round.endScore.home;
      safeSetField(form, `${prefix}4${suffix}`, String(oppEndScore));
    }
  }

  // ── Substitutions ──
  // Left_N_Mth_sub = player number for position N, Mth substitution
  // Left_N_Mth_sub_score = score at time of sub
  const subs = getSubstitutions(state.events, setIndex, team);

  // Group subs by the position they occurred at
  // For simplicity, fill them sequentially into position columns
  // The sub fields are per-position (Left_1_1st_sub = position I, 1st sub)
  // But our data tracks subs globally. Map sub to the position of playerOut.
  const rotation = getCurrentRotation(state, setIndex);
  if (rotation) {
    // Track how many subs have been recorded per position column
    const subCountByPos: Record<number, number> = {};

    for (const sub of subs) {
      // Find which lineup position this sub happened at
      // Use the starting lineup to determine position
      const startLineup = team === 'home' ? setData.homeLineup : setData.awayLineup;
      if (!startLineup) continue;

      let posCol = 0;
      // Find the position column - check starting lineup and previously subbed players
      for (let p = 1; p <= 6; p++) {
        if (startLineup[p as CourtPosition] === sub.playerOut ||
            startLineup[p as CourtPosition] === sub.playerIn) {
          posCol = p;
          break;
        }
      }
      if (posCol === 0) posCol = 1; // fallback

      const count = (subCountByPos[posCol] || 0) + 1;
      subCountByPos[posCol] = count;

      const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
      const ordinal = ordinals[count - 1] || `${count}th`;

      safeSetField(form, `Left_${posCol}_${ordinal}_sub${suffix}`, String(sub.playerIn));
      safeSetField(
        form,
        `Left_${posCol}_${ordinal}_sub_score${suffix}`,
        `${sub.homeScore}-${sub.awayScore}`
      );
    }
  }

  // ── Sub Count Boxes (Left_sub_1 through Left_sub_15) ──
  // Mark how many subs have been used
  const subTotal = subs.length;
  for (let i = 1; i <= subTotal && i <= 15; i++) {
    safeSetField(form, `Left_sub_${i}${suffix}`, 'X');
  }

  // ── Timeouts ──
  const timeouts = getTimeouts(state.events, setIndex, team);
  for (const to of timeouts) {
    safeSetField(
      form,
      `Left_timeout_${to.timeoutNumber}${suffix}`,
      `${to.homeScore}-${to.awayScore}`
    );
  }

  // ── Libero ──
  const teamData = team === 'home' ? state.homeTeam : state.awayTeam;
  const liberos = teamData.roster.filter(p => p.isLibero);
  if (liberos.length >= 1) {
    safeSetField(form, `Left_Libero_1${suffix}`, String(liberos[0].number));
  }
  if (liberos.length >= 2) {
    safeSetField(form, `Left_Libero_2${suffix}`, String(liberos[1].number));
  }
}

export async function fillScoresheet(state: MatchState): Promise<Blob> {
  console.log('[PDF] fillScoresheet called');
  console.log('[PDF] Home:', state.homeTeam.name, '| Away:', state.awayTeam.name);
  console.log('[PDF] Events:', state.events.length, '| Current set:', state.currentSetIndex);
  console.log('[PDF] Sets:', state.sets.map((s, i) => `Set${i+1}: lineup=${!!s.homeLineup}`).join(', '));

  const pdfUrl = '/Non-deciding-two-set-scoresheet_prepared_form.pdf';
  const existingPdfBytes = await fetch(pdfUrl).then(res => res.arrayBuffer());
  const doc = await PDFDocument.load(existingPdfBytes);
  const form = doc.getForm();

  console.log('[PDF] Form fields found:', form.getFields().length);

  const setsWon = getSetsWon(state);

  // ── Match Metadata ──
  safeSetField(form, 'Team Left', state.homeTeam.name);
  safeSetField(form, 'Team Right', state.awayTeam.name);
  safeSetField(form, 'date', new Date(state.createdAt).toLocaleDateString());

  // ── Set Results ──
  for (let si = 0; si < 2 && si <= state.currentSetIndex; si++) {
    const score = getSetScore(state.events, si);
    const winner = getSetWinner(score, si, state.config);
    const setNum = si + 1;

    if (winner) {
      const winnerName = winner === 'home' ? state.homeTeam.name : state.awayTeam.name;
      const loserName = winner === 'home' ? state.awayTeam.name : state.homeTeam.name;
      const winnerScore = winner === 'home' ? score.home : score.away;
      const loserScore = winner === 'home' ? score.away : score.home;

      safeSetField(form, `set ${setNum} winner`, winnerName);
      safeSetField(form, `set ${setNum} loser`, loserName);
      safeSetField(form, `set ${setNum} winner score`, String(winnerScore));
      safeSetField(form, `set ${setNum} loser score`, String(loserScore));
    }
  }

  // ── Match Winner ──
  if (state.matchComplete) {
    const matchWinner = setsWon.home > setsWon.away ? state.homeTeam.name : state.awayTeam.name;
    safeSetField(form, 'Match Winner', matchWinner);
    safeSetField(form, 'Wins:Losses', `${setsWon.home}:${setsWon.away}`);
  }

  // ── Fill each set/team quadrant ──
  // Set 1: home = left (no suffix), away = right (#1)
  // Always fill if lineups exist (even at 0-0)
  if (state.sets[0]?.homeLineup || state.sets[0]?.awayLineup || state.events.some(e => e.setIndex === 0)) {
    console.log('[PDF] Filling Set 1 left (home) and right (away)');
    fillTeamSetFields(form, state, 0, 'home', getSuffix(0, 'left'));
    fillTeamSetFields(form, state, 0, 'away', getSuffix(0, 'right'));
  }

  // Set 2: home = left (#2), away = right (#3)
  if (state.sets[1]?.homeLineup || state.sets[1]?.awayLineup || (state.currentSetIndex >= 1 && state.events.some(e => e.setIndex === 1))) {
    console.log('[PDF] Filling Set 2 left (home) and right (away)');
      fillTeamSetFields(form, state, 1, 'home', getSuffix(1, 'left'));
      fillTeamSetFields(form, state, 1, 'away', getSuffix(1, 'right'));
    }
  }

  // Flatten form so fields are embedded in the PDF visually
  form.flatten();

  const pdfBytes = await doc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

export async function downloadScoresheet(state: MatchState) {
  const blob = await fillScoresheet(state);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scoresheet_${state.homeTeam.name}_vs_${state.awayTeam.name}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
