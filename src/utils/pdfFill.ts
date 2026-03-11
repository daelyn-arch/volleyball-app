import { PDFDocument, rgb, PDFName, TextAlignment } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { MatchState, TeamSide, CourtPosition, PointEvent, MatchEvent, SetData } from '@/types/match';
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
 * Left team Set 1: "Left_" prefix, no suffix (e.g. "Left_P1", "Left_1")
 * Right team Set 1: "Right_" prefix, no suffix (e.g. "Right_P1", "Right_1")
 * Left team Set 2: "Left_" prefix, "_2" suffix (e.g. "Left_P1_2", "Left_1_2")
 * Right team Set 2: "Right_" prefix, "_2" suffix (e.g. "Right_P1_2", "Right_1_2")
 *
 * Service rounds use lowercase "left" but uppercase "Right" for the prefix.
 *
 * home = left side of scoresheet
 * away = right side of scoresheet
 */

type SetSuffix = '' | '_2';
type SidePrefix = 'Left' | 'Right';

interface DrawInstruction {
  shape: 'triangle' | 'circle';
  fieldName?: string;          // resolve rect from form field
  rect?: { x: number; y: number; width: number; height: number }; // direct rect
  pageIndex?: number;          // page index when using direct rect
}

function getSetSuffix(setIndex: number): SetSuffix {
  return setIndex === 0 ? '' : '_2';
}

function getSidePrefix(side: 'left' | 'right'): SidePrefix {
  return side === 'left' ? 'Left' : 'Right';
}

function safeSetField(form: any, name: string, value: string, alignment?: TextAlignment) {
  try {
    const field = form.getTextField(name);
    if (alignment !== undefined) {
      field.setAlignment(alignment);
    }
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

// ── Shape Drawing Helpers ────────────────────────────────────

/** Get a form field's widget rectangle (position + size on the PDF page) */
function getFieldRect(form: any, fieldName: string): { x: number; y: number; width: number; height: number } | null {
  try {
    const field = form.getTextField(fieldName);
    const widgets = field.acroField.getWidgets();
    if (widgets.length === 0) return null;
    return widgets[0].getRectangle();
  } catch {
    return null;
  }
}

/** Get the page index for a form field widget */
function getFieldPageIndex(form: any, doc: PDFDocument, fieldName: string): number {
  try {
    const field = form.getTextField(fieldName);
    const widgets = field.acroField.getWidgets();
    if (widgets.length === 0) return 0;
    const widget = widgets[0];
    // The widget's /P entry references the page
    const pRef = widget.dict.get(PDFName.of('P'));
    if (pRef) {
      const pages = doc.getPages();
      const pRefStr = pRef.toString();
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].ref.toString() === pRefStr) return i;
      }
    }
  } catch {
    // fallback
  }
  return 0;
}

/** Draw a triangle outline around a field */
function drawTriangleOnPage(
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number }
) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;

  // Use smaller of width/height to avoid overlapping neighbors on small fields
  const dim = Math.min(rect.width, rect.height);
  const h = dim / 2;
  const halfBase = h * 0.866; // equilateral proportions

  const apex = { x: cx, y: cy + h };
  const bl = { x: cx - halfBase, y: cy - h };
  const br = { x: cx + halfBase, y: cy - h };

  const color = rgb(0, 0, 0);
  const thickness = 0.75;

  page.drawLine({ start: apex, end: bl, thickness, color });
  page.drawLine({ start: bl, end: br, thickness, color });
  page.drawLine({ start: br, end: apex, thickness, color });
}

/** Draw a perfectly round circle outline around a field */
function drawCircleOnPage(
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number }
) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const r = (Math.max(rect.width, rect.height) / 2 + 1) * 0.8;

  page.drawCircle({
    x: cx,
    y: cy,
    size: r,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    color: rgb(1, 1, 1),
    opacity: 0,
    borderOpacity: 1,
  });
}

// ── Libero Serving Detection ─────────────────────────────────

/**
 * Derive which starting lineup positions had a libero serve, based on events.
 * Tracks rotation count to map back to the original lineup position.
 */
function getLiberoServingStartPositions(
  events: MatchEvent[],
  setIndex: number,
  setData: SetData,
  team: TeamSide,
  liberoNums: Set<number>
): Set<CourtPosition> {
  const positions = new Set<CourtPosition>();
  if (!setData.firstServe || liberoNums.size === 0) return positions;

  let rotationCount = 0;
  const setEvents = events.filter(e => e.setIndex === setIndex);

  for (const event of setEvents) {
    if (event.type !== 'point') continue;
    const pe = event as PointEvent;

    // Check if our team's libero is serving
    if (pe.servingTeam === team && liberoNums.has(pe.serverNumber)) {
      const startingPos = (rotationCount % 6) + 1;
      positions.add(startingPos as CourtPosition);
    }

    // Track rotations: when our team gains serve via sideout, we rotate
    if (pe.scoringTeam !== pe.servingTeam && pe.scoringTeam === team) {
      rotationCount++;
    }
  }

  return positions;
}

// ── Fill Team Set Fields ─────────────────────────────────────

function fillTeamSetFields(
  form: any,
  state: MatchState,
  setIndex: number,
  team: TeamSide,
  sidePrefix: SidePrefix,
  setSuffix: SetSuffix,
  drawInstructions: DrawInstruction[]
) {
  const setData = state.sets[setIndex];
  if (!setData) return;

  const lineup = team === 'home' ? setData.homeLineup : setData.awayLineup;

  // ── Lineup (Left_P1 through Left_P6 / Right_P1 through Right_P6) ──
  if (lineup) {
    for (let pos = 1; pos <= 6; pos++) {
      const fieldName = `${sidePrefix}_P${pos}${setSuffix}`;
      safeSetField(form, fieldName, String(lineup[pos as CourtPosition]), TextAlignment.Center);
    }
  }

  // ── Running Score (Left_1 through Left_36 / Right_1 through Right_36) ──
  const runningScore = getRunningScoreData(state.events, setIndex);
  const teamScore = team === 'home' ? runningScore.home : runningScore.away;

  // Determine which points were scored during this team's own libero serve
  const teamData = team === 'home' ? state.homeTeam : state.awayTeam;
  const liberoNums = new Set(teamData.roster.filter(p => p.isLibero).map(p => p.number));
  const liberoServePoints = new Set<number>();
  if (liberoNums.size > 0) {
    const pointEvents = state.events.filter(
      e => e.setIndex === setIndex && e.type === 'point'
    ) as PointEvent[];
    for (const pe of pointEvents) {
      if (pe.scoringTeam === team && pe.servingTeam === team && liberoNums.has(pe.serverNumber)) {
        const point = team === 'home' ? pe.homeScore : pe.awayScore;
        liberoServePoints.add(point);
      }
    }
  }

  for (const entry of teamScore) {
    if (entry.point >= 1 && entry.point <= 36) {
      const fieldName = `${sidePrefix}_${entry.point}${setSuffix}`;
      if (liberoServePoints.has(entry.point)) {
        // Triangle only — no X text for libero-serve points
        drawInstructions.push({ fieldName, shape: 'triangle' });
      } else {
        safeSetField(form, fieldName, 'X');
      }
    }
  }

  // ── Libero serving triangle on Roman numeral above lineup ──
  if (lineup && liberoNums.size > 0) {
    const liberoServPositions = getLiberoServingStartPositions(
      state.events, setIndex, setData, team, liberoNums
    );
    for (const pos of liberoServPositions) {
      const fieldName = `${sidePrefix}_P${pos}${setSuffix}`;
      const fieldRect = getFieldRect(form, fieldName);
      if (fieldRect) {
        // Position the triangle above the field, centered on the Roman numeral label
        const labelRect = {
          x: fieldRect.x + fieldRect.width / 2 - 10,
          y: fieldRect.y + fieldRect.height,
          width: 20,
          height: 14,
        };
        drawInstructions.push({ shape: 'triangle', rect: labelRect, pageIndex: 0 });
      }
    }
  }

  // ── Serve / Receive indicator ──
  const isReceivingTeam = setData.firstServe !== team;
  if (setData.firstServe) {
    if (isReceivingTeam) {
      safeSetField(form, `${sidePrefix}_Recieve${setSuffix}`, 'X');
    } else {
      safeSetField(form, `${sidePrefix}_Serve${setSuffix}`, 'X');
    }
  }

  // ── Service Rounds ──
  const serviceRounds = getServiceRounds(state.events, setIndex, setData);
  const teamRounds = team === 'home' ? serviceRounds.home : serviceRounds.away;

  const srPrefix = sidePrefix === 'Left' ? 'left' : 'Right';

  const srRowByCol: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  if (isReceivingTeam) {
    srRowByCol[1] = 1;
    safeSetField(form, `${srPrefix}_1_score_service_round_1${setSuffix}`, 'X');
  }

  let lastSrFieldName = '';

  for (let i = 0; i < teamRounds.length; i++) {
    const round = teamRounds[i];

    const col = isReceivingTeam
      ? ((i + 1) % 6) + 1
      : (i % 6) + 1;

    srRowByCol[col]++;
    const row = srRowByCol[col];
    if (row > 6) continue;

    if (round.endScore) {
      const teamEndScore = team === 'home' ? round.endScore.home : round.endScore.away;
      const fieldName = `${srPrefix}_${col}_score_service_round_${row}${setSuffix}`;
      safeSetField(form, fieldName, String(teamEndScore), TextAlignment.Center);
      lastSrFieldName = fieldName;
    }
  }

  // Circle the last service round entry (final score for this team)
  if (lastSrFieldName) {
    drawInstructions.push({ fieldName: lastSrFieldName, shape: 'circle' });
  }

  // ── Substitutions ──
  const subs = getSubstitutions(state.events, setIndex, team);

  const rotation = getCurrentRotation(state, setIndex);
  if (rotation) {
    const subCountByPos: Record<number, number> = {};

    for (const sub of subs) {
      const startLineup = team === 'home' ? setData.homeLineup : setData.awayLineup;
      if (!startLineup) continue;

      let posCol = 0;
      for (let p = 1; p <= 6; p++) {
        if (startLineup[p as CourtPosition] === sub.playerOut ||
            startLineup[p as CourtPosition] === sub.playerIn) {
          posCol = p;
          break;
        }
      }
      if (posCol === 0) posCol = 1;

      const count = (subCountByPos[posCol] || 0) + 1;
      subCountByPos[posCol] = count;

      const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
      const ordinal = ordinals[count - 1] || `${count}th`;

      const subField = `${sidePrefix}_${posCol}_${ordinal}_sub${setSuffix}`;
      const subScoreField = `${sidePrefix}_${posCol}_${ordinal}_sub_score${setSuffix}`;
      safeSetField(form, subField, String(sub.playerIn), TextAlignment.Center);
      safeSetField(form, subScoreField, `${sub.homeScore}-${sub.awayScore}`, TextAlignment.Center);
    }
  }

  // ── Sub Count Boxes ──
  const subTotal = subs.length;
  for (let i = 1; i <= subTotal && i <= 15; i++) {
    safeSetField(form, `${sidePrefix}_sub_${i}${setSuffix}`, 'X');
  }

  // ── Timeouts ──
  const timeouts = getTimeouts(state.events, setIndex, team);
  for (const to of timeouts) {
    safeSetField(
      form,
      `${sidePrefix}_timeout_${to.timeoutNumber}${setSuffix}`,
      `${to.homeScore}-${to.awayScore}`,
      TextAlignment.Center
    );
  }

  // ── Libero ──
  const liberos = teamData.roster.filter(p => p.isLibero);
  if (liberos.length >= 1) {
    safeSetField(form, `${sidePrefix}_Libero_1${setSuffix}`, String(liberos[0].number), TextAlignment.Center);
  }
  if (liberos.length >= 2) {
    safeSetField(form, `${sidePrefix}_Libero_2${setSuffix}`, String(liberos[1].number), TextAlignment.Center);
  }

  // ── Captain fields ──
  const captain = teamData.roster.find(p => p.isCaptain);
  const actingCaptain = teamData.roster.find(p => p.isActingCaptain);
  if (captain) {
    safeSetField(form, `${sidePrefix}_CAPTAIN_x${setSuffix}`, 'X');
    safeSetField(form, `${sidePrefix}_CAPTAIN_c${setSuffix}`, String(captain.number));
  }
  if (actingCaptain) {
    safeSetField(form, `${sidePrefix}_CAPTAIN_a${setSuffix}`, String(actingCaptain.number));
  }
}

// ── Main Export ──────────────────────────────────────────────

export async function fillScoresheet(state: MatchState): Promise<Blob> {
  const pdfUrl = '/Non-deciding-two-set-scoresheet_prepared_form.pdf';
  const existingPdfBytes = await fetch(pdfUrl).then(res => res.arrayBuffer());
  const doc = await PDFDocument.load(existingPdfBytes);
  const form = doc.getForm();

  const setsWon = getSetsWon(state);
  const drawInstructions: DrawInstruction[] = [];

  // ── Match Metadata ──
  safeSetField(form, 'Team Left', state.homeTeam.name);
  safeSetField(form, 'Team Right', state.awayTeam.name);
  safeSetField(form, 'date', new Date(state.createdAt).toLocaleDateString());

  const meta = state.metadata;
  if (meta) {
    if (meta.competition) safeSetField(form, 'Name of the Competition', meta.competition);
    if (meta.cityState) safeSetField(form, 'City,State', meta.cityState);
    if (meta.hall) safeSetField(form, 'Hall', meta.hall);
    if (meta.matchNumber) safeSetField(form, 'Match No', meta.matchNumber);
    if (meta.level) safeSetField(form, 'Level', meta.level);
    if (meta.poolPhase) safeSetField(form, 'Pool Phase', meta.poolPhase);
    if (meta.court) safeSetField(form, 'court', meta.court);
    if (meta.division === 'Men') safeSetField(form, 'Men', 'X');
    if (meta.division === 'Women') safeSetField(form, 'Women', 'X');
    if (meta.division === 'CoEd') safeSetField(form, 'CoEd', 'X');
    if (meta.category === 'Adult') safeSetField(form, 'Adult', 'X');
    if (meta.category === 'Junior') safeSetField(form, 'Junior', 'X');
    if (meta.scorer) safeSetField(form, 'Match Scorer', meta.scorer);
    if (meta.referee) safeSetField(form, 'Match 1st Referee', meta.referee);
    if (meta.downRef) safeSetField(form, 'Down Ref', meta.downRef);
  }

  // ── Set Times (military/24h format) ──
  for (let si = 0; si < 2 && si <= state.currentSetIndex; si++) {
    const sd = state.sets[si];
    if (!sd) continue;
    const setNum = si + 1;
    if (sd.startTime) {
      const d = new Date(sd.startTime);
      const hhmm = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
      safeSetField(form, `Start Time Set ${setNum}`, hhmm);
    }
    if (sd.endTime) {
      const d = new Date(sd.endTime);
      const hhmm = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
      safeSetField(form, `End_Time_Set_${setNum}`, hhmm);
    }
  }

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
      // Set 1 uses lowercase "loser", Set 2 uses capital "Loser"
      const loserField = setNum === 2 ? `set ${setNum} Loser` : `set ${setNum} loser`;
      safeSetField(form, loserField, loserName);
      safeSetField(form, `set ${setNum} winner score`, String(winnerScore), TextAlignment.Center);
      safeSetField(form, `set ${setNum} loser score`, String(loserScore), TextAlignment.Center);
    }
  }

  // ── Match Winner ──
  if (state.matchComplete) {
    const matchWinner = setsWon.home > setsWon.away ? state.homeTeam.name : state.awayTeam.name;
    safeSetField(form, 'Match Winner', matchWinner);
    const wins = Math.max(setsWon.home, setsWon.away);
    const losses = Math.min(setsWon.home, setsWon.away);
    safeSetField(form, 'Wins:Losses', `${wins}:${losses}`, TextAlignment.Center);
  }

  // ── Remarks (score corrections etc.) ──
  if (state.remarks && state.remarks.length > 0) {
    safeSetField(form, 'Remarks', state.remarks.join('\n'));
  }

  // ── Fill each set/team quadrant ──
  if (state.sets[0]?.homeLineup || state.sets[0]?.awayLineup || state.events.some(e => e.setIndex === 0)) {
    fillTeamSetFields(form, state, 0, 'home', getSidePrefix('left'), getSetSuffix(0), drawInstructions);
    fillTeamSetFields(form, state, 0, 'away', getSidePrefix('right'), getSetSuffix(0), drawInstructions);
  }

  const hasSet2Events = state.events.some(e => e.setIndex === 1);
  if (hasSet2Events) {
    fillTeamSetFields(form, state, 1, 'home', getSidePrefix('left'), getSetSuffix(1), drawInstructions);
    fillTeamSetFields(form, state, 1, 'away', getSidePrefix('right'), getSetSuffix(1), drawInstructions);
  }

  // ── Resolve field positions BEFORE flattening ──
  const resolvedShapes: Array<{
    pageIndex: number;
    rect: { x: number; y: number; width: number; height: number };
    shape: 'triangle' | 'circle';
  }> = [];

  for (const instr of drawInstructions) {
    if (instr.rect) {
      // Direct rect provided (e.g. for Roman numeral labels above fields)
      resolvedShapes.push({ pageIndex: instr.pageIndex ?? 0, rect: instr.rect, shape: instr.shape });
    } else if (instr.fieldName) {
      const rect = getFieldRect(form, instr.fieldName);
      if (!rect) continue;
      const pageIndex = getFieldPageIndex(form, doc, instr.fieldName);
      resolvedShapes.push({ pageIndex, rect, shape: instr.shape });
    }
  }

  // ── Keep metadata fields editable, lock scoring fields ──
  const editableFields = new Set([
    'Name of the Competition',
    'City,State',
    'Hall',
    'Match No',
    'Level',
    'Pool Phase',
    'court',
    'time',
    'Men',
    'Women',
    'CoEd',
    'Adult',
    'Junior',
    '1st',
    'Remarks',
    'Left_Team_a_b',
    'Right_Team_a_b',
    'Match Scorer',
    'Match 1st Referee',
    'Down Ref',
  ]);

  for (const field of form.getFields()) {
    if (!editableFields.has(field.getName())) {
      field.enableReadOnly();
    }
  }

  // ── Draw shapes on top of the content ──
  const pages = doc.getPages();
  for (const s of resolvedShapes) {
    const page = pages[s.pageIndex] || pages[0];
    if (s.shape === 'triangle') {
      drawTriangleOnPage(page, s.rect);
    } else {
      drawCircleOnPage(page, s.rect);
    }
  }

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
