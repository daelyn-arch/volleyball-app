import { PDFDocument, rgb, PDFName, TextAlignment, degrees, StandardFonts } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { MatchState, TeamSide, CourtPosition, PointEvent, MatchEvent, SetData, SanctionRecipient } from '@/types/match';
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

export interface DrawInstruction {
  shape: 'triangle' | 'circle' | 'slash';
  fieldName?: string;          // resolve rect from form field
  rect?: { x: number; y: number; width: number; height: number }; // direct rect
  pageIndex?: number;          // page index when using direct rect
}

interface TBarRange {
  side: 'Left' | 'Right';
  setIndex: number;
  startPoint: number;
  endPoint: number;
}

function getSetSuffix(setIndex: number): SetSuffix {
  return setIndex === 0 ? '' : '_2';
}

function getSidePrefix(side: 'left' | 'right'): SidePrefix {
  return side === 'left' ? 'Left' : 'Right';
}

export function safeSetField(form: any, name: string, value: string, alignment?: TextAlignment, fontSize?: number) {
  try {
    const field = form.getTextField(name);
    // Remove maxLength constraint if it would block the value
    try {
      const maxLen = field.getMaxLength();
      if (maxLen !== undefined && value.length > maxLen) {
        field.setMaxLength(undefined as any);
      }
    } catch { /* no maxLength set */ }
    if (alignment !== undefined) {
      field.setAlignment(alignment);
    }
    if (fontSize !== undefined) {
      field.setFontSize(fontSize);
    }
    field.setText(value);
  } catch {
    // Field doesn't exist in this version of the PDF — skip silently
  }
}

export function safeSetCheckbox(form: any, name: string, checked: boolean) {
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
export function getFieldRect(form: any, fieldName: string): { x: number; y: number; width: number; height: number } | null {
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
export function getFieldPageIndex(form: any, doc: PDFDocument, fieldName: string): number {
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
export function drawTriangleOnPage(
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
export function drawCircleOnPage(
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

/** Draw a bold forward slash through a field */
export function drawSlashOnPage(
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number }
) {
  const color = rgb(0, 0, 0);
  const thickness = 1.25;
  const inset = 2;
  page.drawLine({
    start: { x: rect.x + inset, y: rect.y + inset },
    end: { x: rect.x + rect.width - inset, y: rect.y + rect.height - inset },
    thickness,
    color,
  });
}

// ── Running Score Grid Coordinate Map ─────────────────────────
// Extracted from PDF field positions. Each cell is 8.4×8.4.
// Coordinates are bottom-left corner (PDF origin = bottom-left, y goes up).
// 3 physical columns per side: points 1-12, 13-24, 25-36.
const CELL_SIZE = 8.4;
const SCORE_GRID: Record<string, { colX: number[]; rowY: number[] }> = {
  'Left_0':  { colX: [272.7, 283.0, 293.1], rowY: [468.4, 456.8, 445.6, 434.1, 422.4, 411.0, 399.7, 388.3, 377.0, 365.2, 354.2, 342.5] },
  'Right_0': { colX: [315.0, 325.1, 335.3], rowY: [468.4, 456.8, 445.6, 434.1, 422.4, 411.0, 399.7, 388.3, 377.0, 365.2, 354.2, 342.5] },
  'Left_1':  { colX: [272.7, 283.1, 293.2], rowY: [223.1, 211.5, 200.3, 188.8, 177.2, 165.7, 154.4, 143.0, 131.7, 119.9, 108.9, 97.2] },
  'Right_1': { colX: [314.9, 325.2, 335.4], rowY: [223.1, 211.5, 200.3, 188.8, 177.2, 165.7, 154.4, 143.0, 131.7, 119.9, 108.9, 97.2] },
};

function getScoreCellRect(side: 'Left' | 'Right', setIndex: number, point: number): { x: number; y: number } | null {
  if (point < 1 || point > 36) return null;
  const grid = SCORE_GRID[`${side}_${setIndex}`];
  if (!grid) return null;
  const col = Math.floor((point - 1) / 12);
  const row = (point - 1) % 12;
  return { x: grid.colX[col], y: grid.rowY[row] };
}

/** Draw T-bars for a team's running score column. Groups by physical column. */
function drawTBarsOnPage(
  page: PDFPage,
  side: 'Left' | 'Right',
  setIndex: number,
  startPoint: number,
  endPoint: number,
) {
  if (startPoint > endPoint || startPoint > 36) return;
  const capped = Math.min(endPoint, 36);
  const color = rgb(0, 0, 0);
  const thickness = 1;
  const halfW = CELL_SIZE * 0.35;

  // Group points by physical column (0=1-12, 1=13-24, 2=25-36)
  const columns = new Map<number, { start: number; end: number }>();
  for (let p = startPoint; p <= capped; p++) {
    const col = Math.floor((p - 1) / 12);
    if (!columns.has(col)) columns.set(col, { start: p, end: p });
    else columns.get(col)!.end = p;
  }

  for (const [, range] of columns) {
    const first = getScoreCellRect(side, setIndex, range.start);
    const last = getScoreCellRect(side, setIndex, range.end);
    if (!first || !last) continue;

    const cx = first.x + CELL_SIZE / 2;
    const topY = first.y + CELL_SIZE;   // top edge of first empty cell
    const bottomY = last.y;              // bottom edge of last empty cell

    // Horizontal bar at top
    page.drawLine({ start: { x: cx - halfW, y: topY }, end: { x: cx + halfW, y: topY }, thickness, color });
    // Vertical stem down
    page.drawLine({ start: { x: cx, y: topY }, end: { x: cx, y: bottomY }, thickness, color });
  }
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
  drawInstructions: DrawInstruction[],
  tbarRanges: TBarRange[],
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

  // Determine which points were awarded by penalty (sanction followed by point)
  const penaltyPoints = new Set<number>();
  const setEvents = state.events.filter(e => e.setIndex === setIndex);
  for (let i = 0; i < setEvents.length - 1; i++) {
    const e = setEvents[i];
    const next = setEvents[i + 1];
    if (e.type === 'sanction' && next.type === 'point' &&
        (e.sanctionType === 'penalty' || e.sanctionType === 'delay-penalty' ||
         e.sanctionType === 'expulsion' || e.sanctionType === 'disqualification') &&
        next.scoringTeam === team) {
      const point = team === 'home' ? next.homeScore : next.awayScore;
      penaltyPoints.add(point);
    }
  }

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

  let maxPointScored = 0;
  for (const entry of teamScore) {
    if (entry.point >= 1 && entry.point <= 36) {
      const fieldName = `${sidePrefix}_${entry.point}${setSuffix}`;
      if (liberoServePoints.has(entry.point)) {
        drawInstructions.push({ fieldName, shape: 'triangle' });
      } else {
        drawInstructions.push({ fieldName, shape: 'slash' });
      }
      // Penalty-awarded points also get a circle
      if (penaltyPoints.has(entry.point)) {
        drawInstructions.push({ fieldName, shape: 'circle' });
      }
      if (entry.point > maxPointScored) maxPointScored = entry.point;
    }
  }

  // T-bar unused points after the final scored point (only when set is complete)
  const setScoreForTbar = getSetScore(state.events, setIndex);
  const setWinnerForTbar = getSetWinner(setScoreForTbar, setIndex, state.config);
  if (setWinnerForTbar) {
    // T-bar from this team's last scored point+1 to the end of the physical column
    // containing the higher score (covers all unused cells for both teams)
    const higherScore = Math.max(setScoreForTbar.home, setScoreForTbar.away);
    const lastCol = Math.floor((higherScore - 1) / 12);
    const endOfLastCol = (lastCol + 1) * 12; // 12, 24, or 36
    const startPoint = maxPointScored + 1;
    if (startPoint <= endOfLastCol) {
      tbarRanges.push({
        side: sidePrefix as 'Left' | 'Right',
        setIndex,
        startPoint,
        endPoint: endOfLastCol,
      });
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

  // Circle only when the set is complete
  const setScore = getSetScore(state.events, setIndex);
  const setWinner = getSetWinner(setScore, setIndex, state.config);
  if (setWinner) {
    // Check if this team's last service round was the set-ending round
    // (i.e., the last round was by this team's server and they won)
    const lastRound = teamRounds[teamRounds.length - 1];
    const teamWonServing = lastRound &&
      lastRound.servingTeam === team &&
      setWinner === team &&
      lastRound.endScore &&
      (team === 'home' ? lastRound.endScore.home : lastRound.endScore.away) === (team === 'home' ? setScore.home : setScore.away);

    if (teamWonServing && lastSrFieldName) {
      // Team won on their own serve — circle the existing last entry
      drawInstructions.push({ fieldName: lastSrFieldName, shape: 'circle' });
    } else {
      // Team lost the set on the other team's serve, or won on a side-out
      // Place final score in the next empty serving round slot
      const finalScore = team === 'home' ? setScore.home : setScore.away;
      const nextCol = isReceivingTeam
        ? ((teamRounds.length + 1) % 6) + 1
        : (teamRounds.length % 6) + 1;
      srRowByCol[nextCol]++;
      const nextRow = srRowByCol[nextCol];
      if (nextRow <= 6) {
        const fieldName = `${srPrefix}_${nextCol}_score_service_round_${nextRow}${setSuffix}`;
        safeSetField(form, fieldName, String(finalScore), TextAlignment.Center);
        drawInstructions.push({ fieldName, shape: 'circle' });
      }
    }
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
      safeSetField(form, subScoreField, `${sub.homeScore}:${sub.awayScore}`, TextAlignment.Center, 10);
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
      `${to.homeScore}:${to.awayScore}`,
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

// ── Deciding Set (3rd Set) PDF Fill ──────────────────────────

async function fillDecidingSetSheet(
  state: MatchState,
  flatten: boolean,
): Promise<PDFDocument> {
  const pdfUrl = '/deciding_set_scoresheet_prepared_form.pdf';
  const bytes = await fetch(pdfUrl).then(r => r.arrayBuffer());
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  const page = doc.getPages()[0];
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const setIndex = state.config.bestOf - 1;
  const setData = state.sets[setIndex];
  if (!setData) return doc;

  const switchScore = setData.sidesSwitchedAtScore;
  const homeSide = setData.homeBenchSide;
  const leftTeam: TeamSide = homeSide === 'left' ? 'home' : 'away';
  const rightTeam: TeamSide = homeSide === 'left' ? 'away' : 'home';
  const leftTeamData = leftTeam === 'home' ? state.homeTeam : state.awayTeam;
  const rightTeamData = rightTeam === 'home' ? state.homeTeam : state.awayTeam;

  // Helper: draw text at a field's position on the 90°-rotated page
  // On rotated page: raw width = visual height, raw height = visual width
  function drawAtField(fieldName: string, text: string, fontSize?: number, useBold?: boolean) {
    try {
      const f = form.getTextField(fieldName);
      const rect = f.acroField.getWidgets()[0].getRectangle();
      const sz = fontSize || 8;
      const usedFont = useBold ? fontBold : font;
      // Vertically center: raw x + width/2 + ascent/3
      const vCenter = rect.x + rect.width / 2 + sz * 0.3;
      page.drawText(text, {
        x: vCenter,
        y: rect.y + 2,
        size: sz,
        font: usedFont,
        rotate: degrees(90),
        color: rgb(0, 0, 0),
      });
    } catch { /* field not found */ }
  }

  // Helper: draw centered text in a field (both horizontally and vertically)
  function drawCentered(fieldName: string, text: string, fontSize?: number, useBold?: boolean) {
    try {
      const f = form.getTextField(fieldName);
      const rect = f.acroField.getWidgets()[0].getRectangle();
      const sz = fontSize || 8;
      const usedFont = useBold ? fontBold : font;
      const textWidth = usedFont.widthOfTextAtSize(text, sz);
      // Horizontal center (visual): center along raw y-axis
      const visualWidth = rect.height;
      const hOffset = Math.max(0, (visualWidth - textWidth) / 2);
      // Vertical center (visual): center along raw x-axis
      const vCenter = rect.x + rect.width / 2 + sz * 0.3;
      page.drawText(text, {
        x: vCenter,
        y: rect.y + hOffset,
        size: sz,
        font: usedFont,
        rotate: degrees(90),
        color: rgb(0, 0, 0),
      });
    } catch { /* field not found */ }
  }

  // Helper: draw a checkbox mark at a field position
  function drawCheck(fieldName: string) {
    try {
      const f = form.getCheckBox ? form.getCheckBox(fieldName) : form.getTextField(fieldName);
      const rect = f.acroField.getWidgets()[0].getRectangle();
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      const s = Math.min(rect.width, rect.height) * 0.35;
      // Draw a filled square/check mark centered in the checkbox
      page.drawRectangle({
        x: cx - s, y: cy - s,
        width: s * 2, height: s * 2,
        color: rgb(0, 0, 0),
      });
    } catch { /* field not found */ }
  }

  // ── Metadata ──
  drawAtField('Team Left', leftTeamData.name, 8, true);
  drawAtField('Team Right', rightTeamData.name, 8, true);
  drawAtField('Team Left Header', leftTeamData.name, 10, true);
  drawAtField('Team Right header', rightTeamData.name, 10, true);
  drawAtField('Date', new Date(state.createdAt).toLocaleDateString(), 10, true);
  drawAtField('Name of the Competition', state.metadata?.competition || '', 10);
  drawAtField('City, State', state.metadata?.cityState || '', 10);
  drawAtField('Hall', state.metadata?.hall || '', 10);
  drawAtField('Match No', state.metadata?.matchNumber || '', 10);
  drawAtField('Level', state.metadata?.level || '', 10);
  drawAtField('Pool Phase', state.metadata?.poolPhase || '', 10);
  drawAtField('Court', state.metadata?.court || '', 10);
  drawAtField('Match Scorer', state.metadata?.scorer || '', 9);
  drawAtField('match scorer', state.metadata?.scorer || '', 9);
  drawAtField('Match 1st Referee', state.metadata?.referee || '', 9);
  drawAtField('1st', state.metadata?.referee || '', 9);
  drawAtField('Down ref', state.metadata?.downRef || '', 9);
  drawAtField('Work Team', state.metadata?.workTeam || '', 9);
  drawAtField('Region', state.metadata?.region || '', 10);

  // Checkboxes — draw filled squares directly (form checkboxes render incorrectly on rotated pages)
  const meta = state.metadata;
  if (meta) {
    if (meta.division === 'Men') drawCheck('Men');
    if (meta.division === 'Women') drawCheck('Women');
    if (meta.division === 'CoEd') drawCheck('CoEd');
    if (meta.category === 'Adult') drawCheck('Adult');
    if (meta.category === 'Junior') drawCheck('Junior');
  }

  // Team A/B
  drawCentered('A team a/b', leftTeam === 'home' ? 'A' : 'B', 8);
  drawCentered('B team a/b', rightTeam === 'home' ? 'A' : 'B', 8);

  // ── Lineup ──
  const fillLineup = (team: TeamSide, prefix: string, postSwap: boolean) => {
    const lineup = team === 'home' ? setData.homeLineup : setData.awayLineup;
    if (!lineup) return;
    const suffix = postSwap ? '_post_swap' : '';
    for (let pos = 1; pos <= 6; pos++) {
      drawCentered(`${prefix}_P${pos}${suffix}`, String(lineup[pos as CourtPosition]), 12);
    }
  };
  fillLineup(leftTeam, 'Left', false);
  fillLineup(rightTeam, 'Right', false);
  if (switchScore) {
    fillLineup(leftTeam, 'Left', true);
    drawAtField('Team Left Post Swap', leftTeamData.name, 6);
    // Post-swap captain
    const leftCaptain = leftTeamData.roster.find(p => p.isCaptain);
    if (leftCaptain) {
      drawCentered('first_Left_CAPTAIN_x', 'X', 8);
    }
    const leftActingCaptain = leftTeamData.roster.find(p => p.isActingCaptain);
    if (leftActingCaptain) {
      drawCentered('first_Left_CAPTAIN_a', String(leftActingCaptain.number), 8);
    }
  }

  // ── Serve / Receive ──
  if (setData.firstServe) {
    const leftServing = setData.firstServe === leftTeam;
    drawCentered(leftServing ? 'Left_Serve' : 'Left_Recieve', 'X', 7);
    drawCentered(leftServing ? 'Right_Recieve' : 'Right_Serve', 'X', 7);
  }

  // ── Libero ──
  const leftLiberos = leftTeamData.roster.filter(p => p.isLibero);
  const rightLiberos = rightTeamData.roster.filter(p => p.isLibero);
  if (leftLiberos.length >= 1) drawCentered('left_libero_1', String(leftLiberos[0].number), 8);
  if (leftLiberos.length >= 2) drawCentered('left_libero_2', String(leftLiberos[1].number), 8);
  if (rightLiberos.length >= 1) drawCentered('right_libero_1', String(rightLiberos[0].number), 8);
  if (rightLiberos.length >= 2) drawCentered('right_libero_2', String(rightLiberos[1].number), 8);

  // ── Captain ──
  const fillCaptain = (teamData: typeof leftTeamData, prefix: string) => {
    const captain = teamData.roster.find(p => p.isCaptain);
    const actingCaptain = teamData.roster.find(p => p.isActingCaptain);
    if (captain) {
      drawCentered(`${prefix}_CAPTAIN_x`, 'X', 8);
      drawCentered(`${prefix}_CAPTAIN_c`, String(captain.number), 8);
    }
    if (actingCaptain) {
      drawCentered(`${prefix}_CAPTAIN_a`, String(actingCaptain.number), 8);
    }
  };
  fillCaptain(leftTeamData, 'Left');
  fillCaptain(rightTeamData, 'Right');

  // ── Running Score (graphical slashes) ──
  const drawInstructions: DrawInstruction[] = [];
  const runningScore = getRunningScoreData(state.events, setIndex);
  const leftScore = leftTeam === 'home' ? runningScore.home : runningScore.away;
  const rightScore = rightTeam === 'home' ? runningScore.home : runningScore.away;
  const setEvents = state.events.filter(e => e.setIndex === setIndex);

  const fillRunningScoreSide = (entries: typeof leftScore, team: TeamSide, fieldPrefix: string) => {
    const teamData = team === 'home' ? state.homeTeam : state.awayTeam;
    const libNums = new Set(teamData.roster.filter(p => p.isLibero).map(p => p.number));
    const penaltyPoints = new Set<number>();
    for (let i = 0; i < setEvents.length - 1; i++) {
      const e = setEvents[i]; const next = setEvents[i + 1];
      if (e.type === 'sanction' && next.type === 'point' &&
          (e.sanctionType === 'penalty' || e.sanctionType === 'delay-penalty' ||
           e.sanctionType === 'expulsion' || e.sanctionType === 'disqualification') &&
          next.scoringTeam === team) {
        penaltyPoints.add(team === 'home' ? next.homeScore : next.awayScore);
      }
    }
    const liberoServePoints = new Set<number>();
    const pointEvents = setEvents.filter(e => e.type === 'point') as PointEvent[];
    for (const pe of pointEvents) {
      if (pe.scoringTeam === team && pe.servingTeam === team && libNums.has(pe.serverNumber)) {
        liberoServePoints.add(team === 'home' ? pe.homeScore : pe.awayScore);
      }
    }
    for (const entry of entries) {
      if (entry.point < 1 || entry.point > 36) continue;
      const fieldName = `${entry.point}_score_${fieldPrefix}`;
      drawInstructions.push({ fieldName, shape: liberoServePoints.has(entry.point) ? 'triangle' : 'slash' });
      if (penaltyPoints.has(entry.point)) drawInstructions.push({ fieldName, shape: 'circle' });
    }
  };

  const leftSwitchPoint = switchScore ? (leftTeam === 'home' ? switchScore.home : switchScore.away) : null;
  const leftPreChange = leftSwitchPoint ? leftScore.filter(e => e.point <= leftSwitchPoint) : leftScore;
  const leftPostChange = leftSwitchPoint ? leftScore.filter(e => e.point > leftSwitchPoint) : [];
  fillRunningScoreSide(leftPreChange, leftTeam, 'left');
  fillRunningScoreSide(leftPostChange, leftTeam, 'Left_post_change');
  fillRunningScoreSide(rightScore, rightTeam, 'right');

  if (switchScore) {
    drawCentered('Left Points at Change', String(leftTeam === 'home' ? switchScore.home : switchScore.away), 8);
    drawCentered('Left Team A or B', leftTeam === 'home' ? 'A' : 'B', 8);
  }

  // ── Service Rounds (with final score circle) ──
  const fillServiceRounds = (team: TeamSide, prefix: string) => {
    const serviceRounds = getServiceRounds(state.events, setIndex, setData);
    const teamRounds = team === 'home' ? serviceRounds.home : serviceRounds.away;
    const isReceivingTeam = setData.firstServe !== team;
    const srRowByCol: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    if (isReceivingTeam) { srRowByCol[1] = 1; drawCentered(`${prefix}_1_score_service_round_1`, 'X', 10); }
    let lastSrFieldName = '';
    for (let i = 0; i < teamRounds.length; i++) {
      const round = teamRounds[i];
      const col = isReceivingTeam ? ((i + 1) % 6) + 1 : (i % 6) + 1;
      srRowByCol[col]++;
      const row = srRowByCol[col];
      if (row > 6) continue;
      if (round.endScore) {
        const teamEndScore = team === 'home' ? round.endScore.home : round.endScore.away;
        const fieldName = `${prefix}_${col}_score_service_round_${row}`;
        drawCentered(fieldName, String(teamEndScore), 10);
        lastSrFieldName = fieldName;
      }
    }
    // Circle the final score when set is complete
    const setScore3 = getSetScore(state.events, setIndex);
    const setWinner3 = getSetWinner(setScore3, setIndex, state.config);
    if (setWinner3) {
      const lastRound = teamRounds[teamRounds.length - 1];
      const teamWonServing = lastRound && lastRound.servingTeam === team && setWinner3 === team;
      if (teamWonServing && lastSrFieldName) {
        // Circle the last entry
        const rect = getFieldRect(form, lastSrFieldName);
        if (rect) drawCircleOnPage(page, rect);
      } else {
        // Place final score in next slot and circle it
        const finalScore = team === 'home' ? setScore3.home : setScore3.away;
        const nextCol = isReceivingTeam ? ((teamRounds.length + 1) % 6) + 1 : (teamRounds.length % 6) + 1;
        srRowByCol[nextCol]++;
        const nextRow = srRowByCol[nextCol];
        if (nextRow <= 6) {
          const fieldName = `${prefix}_${nextCol}_score_service_round_${nextRow}`;
          drawCentered(fieldName, String(finalScore), 10);
          const rect = getFieldRect(form, fieldName);
          if (rect) drawCircleOnPage(page, rect);
        }
      }
    }
  };
  fillServiceRounds(leftTeam, 'Left');
  fillServiceRounds(rightTeam, 'Right');

  // ── Substitutions ──
  const fillSubs = (team: TeamSide, prefix: string) => {
    const subs = getSubstitutions(state.events, setIndex, team);
    const startLineup = team === 'home' ? setData.homeLineup : setData.awayLineup;
    if (!startLineup) return;
    const subCountByPos: Record<number, number> = {};
    for (const sub of subs) {
      let posCol = 0;
      for (let p = 1; p <= 6; p++) {
        if (startLineup[p as CourtPosition] === sub.playerOut || startLineup[p as CourtPosition] === sub.playerIn) { posCol = p; break; }
      }
      if (posCol === 0) posCol = 1;
      const count = (subCountByPos[posCol] || 0) + 1;
      subCountByPos[posCol] = count;
      const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
      const ordinal = ordinals[count - 1] || `${count}th`;
      drawCentered(`${prefix}_${posCol}_${ordinal}_sub`, String(sub.playerIn), 9);
      drawCentered(`${prefix}_${posCol}_${ordinal}_sub_score`, `${sub.homeScore}:${sub.awayScore}`, 7);
    }
    for (let i = 1; i <= subs.length && i <= 12; i++) drawCentered(`${prefix}_sub_${i}`, 'X', 8);
  };
  fillSubs(leftTeam, 'Left');
  fillSubs(rightTeam, 'Right');

  // ── Timeouts ──
  const fillTimeouts = (team: TeamSide, prefix: string) => {
    const timeouts = getTimeouts(state.events, setIndex, team);
    for (const to of timeouts) {
      const isPostSwap = switchScore &&
        (to.homeScore > switchScore.home || to.awayScore > switchScore.away ||
         (to.homeScore === switchScore.home && to.awayScore === switchScore.away));
      const suffix = isPostSwap ? '_post_swap' : '';
      drawCentered(`timeout_${to.timeoutNumber}_${prefix.toLowerCase()}${suffix}`, `${to.homeScore}:${to.awayScore}`, 6);
    }
  };
  fillTimeouts(leftTeam, 'Left');
  fillTimeouts(rightTeam, 'Right');

  // ── Sanctions (7 rows) ──
  const sanctionEvents = state.events.filter((e): e is import('@/types/match').SanctionEvent => e.type === 'sanction');
  const recipientSymbol: Record<string, string> = { player: '#', coach: 'C', asstCoach: 'A', trainer: 'T', manager: 'M' };
  sanctionEvents.forEach((e, idx) => {
    if (idx >= 7) return;
    const row = idx + 1;
    const isDelay = e.sanctionType === 'delay-warning' || e.sanctionType === 'delay-penalty';
    const symbol = isDelay ? 'D' : (e.sanctionRecipient === 'player' && e.playerNumber ? String(e.playerNumber) : (e.sanctionRecipient ? recipientSymbol[e.sanctionRecipient] || '#' : '#'));
    if (e.sanctionType === 'warning' || e.sanctionType === 'delay-warning') drawCentered(`yellow_card_${row}`, symbol, 12);
    else if (e.sanctionType === 'penalty' || e.sanctionType === 'delay-penalty') drawCentered(`red_card_${row}`, symbol, 12);
    else if (e.sanctionType === 'expulsion') drawCentered(`Expulsion_${row}`, symbol, 12);
    else if (e.sanctionType === 'disqualification') drawCentered(`Disqualified_${row}`, symbol, 12);
    drawCentered(`penalized_team_${row}`, e.team === 'home' ? 'A' : 'B', 12);
    drawCentered(`penalty_current_set_${row}`, String(e.setIndex + 1), 12);
    drawCentered(`penalty_current_score_${row}`, `${e.homeScore}:${e.awayScore}`, 10);
  });

  // ── Set/Match Results ──
  const score = getSetScore(state.events, setIndex);
  const winner = getSetWinner(score, setIndex, state.config);
  if (winner) {
    drawAtField('Set 3 winner', winner === 'home' ? state.homeTeam.name : state.awayTeam.name, 10, true);
    drawAtField('Set 3 Loser', winner === 'home' ? state.awayTeam.name : state.homeTeam.name, 10, true);
    drawCentered('set 3 winner score', String(winner === 'home' ? score.home : score.away), 12, true);
    drawCentered('set 3 loser score', String(winner === 'home' ? score.away : score.home), 12, true);
  }
  if (state.matchComplete) {
    const setsWon = getSetsWon(state);
    drawAtField('Match Winner', setsWon.home > setsWon.away ? state.homeTeam.name : state.awayTeam.name, 10, true);
  }

  // ── Remarks (only set 3 sanctions) ──
  const decidingRemarks: string[] = [];
  const sanctionLabels3: Record<string, string> = {
    'warning': 'Warning', 'penalty': 'Penalty',
    'delay-warning': 'Delay Warning', 'delay-penalty': 'Delay Penalty',
    'expulsion': 'Expulsion', 'disqualification': 'Disqualification',
  };
  const recipientLabels3: Record<string, string> = {
    player: 'Player', coach: 'Coach', asstCoach: 'Asst Coach', trainer: 'Trainer', manager: 'Manager',
  };
  sanctionEvents.filter(e => e.setIndex === setIndex).forEach((e) => {
    const teamName = e.team === 'home' ? state.homeTeam.name : state.awayTeam.name;
    const label = sanctionLabels3[e.sanctionType] || e.sanctionType;
    const recipient = e.sanctionRecipient ? recipientLabels3[e.sanctionRecipient] || '' : '';
    const playerStr = e.playerNumber ? ` #${e.playerNumber}` : '';
    decidingRemarks.push(`Set 3 (${e.homeScore}:${e.awayScore}): ${label} - ${teamName}${recipient ? ' ' + recipient : ''}${playerStr}`);
  });
  // Also include user remarks that mention set 3
  if (state.remarks) {
    for (const r of state.remarks) {
      if (r.includes('Set 3')) decidingRemarks.push(r);
    }
  }
  if (decidingRemarks.length > 0) {
    try {
      const f = form.getTextField('Remarks');
      const rect = f.acroField.getWidgets()[0].getRectangle();
      // On rotated page: visual top = LOW raw X, visual bottom = HIGH raw X
      // rect.y = visual left edge, rect.height = visual width
      const fontSize = 6;
      const lineHeight = fontSize * 1.5;
      // Start at visual top-left: low raw X
      let xPos = rect.x + fontSize + 2; // visual top
      for (const line of decidingRemarks) {
        page.drawText(line, {
          x: xPos,
          y: rect.y + 2, // visual left edge
          size: fontSize,
          font,
          rotate: degrees(90),
          color: rgb(0, 0, 0),
        });
        xPos += lineHeight; // move down (increasing raw X)
        if (xPos > rect.x + rect.width - 2) break; // stop if we reach the bottom
      }
    } catch { /* field not found */ }
  }

  // ── Set time ──
  if (setData.startTime) {
    const d = new Date(setData.startTime);
    const hhmm = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    drawAtField('Time', hhmm, 8);
    drawAtField('start time', hhmm, 7);
    drawCentered('Set 3', hhmm, 7);
  }
  if (setData.endTime) {
    const d = new Date(setData.endTime);
    const hhmm = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    drawAtField('end time', hhmm, 7);
  }

  // ── Team_3 ──
  drawAtField('Team_3', `${leftTeamData.name} vs ${rightTeamData.name}`, 5);

  // ── Resolve draw instructions and draw shapes ──
  // For 90° rotated page, slash direction must be flipped to appear correct after rotation
  function drawSlashRotated(rect: { x: number; y: number; width: number; height: number }) {
    const inset = 2;
    page.drawLine({
      start: { x: rect.x + inset, y: rect.y + rect.height - inset },
      end: { x: rect.x + rect.width - inset, y: rect.y + inset },
      thickness: 1.25,
      color: rgb(0, 0, 0),
    });
  }

  // Triangle for rotated page — rotate the apex direction
  function drawTriangleRotated(rect: { x: number; y: number; width: number; height: number }) {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const dim = Math.min(rect.width, rect.height);
    const h = dim / 2;
    const halfBase = h * 0.866;
    // Apex points left in raw space (down visually after 90° rotation = pointing up on screen)
    const apex = { x: cx - h, y: cy };
    const bl = { x: cx + h, y: cy - halfBase };
    const br = { x: cx + h, y: cy + halfBase };
    const color = rgb(0, 0, 0);
    page.drawLine({ start: apex, end: bl, thickness: 0.75, color });
    page.drawLine({ start: bl, end: br, thickness: 0.75, color });
    page.drawLine({ start: br, end: apex, thickness: 0.75, color });
  }

  for (const instr of drawInstructions) {
    if (!instr.fieldName) continue;
    const rect = getFieldRect(form, instr.fieldName);
    if (!rect) continue;
    if (instr.shape === 'slash') drawSlashRotated(rect);
    else if (instr.shape === 'triangle') drawTriangleRotated(rect);
    else if (instr.shape === 'circle') drawCircleOnPage(page, rect); // circles are rotation-invariant
  }

  // ── T-bars for unused score cells ──
  // Draw a continuous line through unused cells with a stem at the start
  const score3 = getSetScore(state.events, setIndex);
  const winner3 = getSetWinner(score3, setIndex, state.config);
  if (winner3) {
    // On 90° rotated page: visual columns run along raw X axis
    // Visual down = increasing raw X, Visual right = increasing raw Y
    // The T-bar goes DOWN a column from the first unused cell to the end of the column block (12, 24, or 36)
    const drawTBarRange = (fieldPrefix: string, startPoint: number, endPoint: number) => {
      if (startPoint > endPoint) return;

      // For each unused cell, find which column block it's in and draw T down to end of block
      // Column blocks: 1-12, 13-24, 25-36 (each block = one visual column of 12 cells)
      const processed = new Set<number>();

      for (let pt = startPoint; pt <= endPoint; pt++) {
        const blockEnd = Math.ceil(pt / 12) * 12; // 12, 24, or 36
        const blockStart = blockEnd - 11; // 1, 13, or 25

        // Only process each column block once
        if (processed.has(blockStart)) continue;
        processed.add(blockStart);

        // Find first unused cell in this block
        const firstUnused = Math.max(startPoint, blockStart);
        const lastInBlock = Math.min(endPoint, blockEnd);

        const firstRect = getFieldRect(form, `${firstUnused}_score_${fieldPrefix}`);
        const lastRect = getFieldRect(form, `${lastInBlock}_score_${fieldPrefix}`);
        if (!firstRect || !lastRect) continue;

        const cy = firstRect.y + firstRect.height / 2; // visual horizontal center

        // Horizontal cap at top of first unused cell (visual) = line along raw Y at raw X of cell top
        page.drawLine({
          start: { x: firstRect.x, y: firstRect.y + 1 },
          end: { x: firstRect.x, y: firstRect.y + firstRect.height - 1 },
          thickness: 0.8, color: rgb(0, 0, 0),
        });

        // Vertical line going DOWN (visual) = line along raw X from first to last cell
        // Increasing raw X = visual down
        page.drawLine({
          start: { x: firstRect.x, y: cy },
          end: { x: lastRect.x + lastRect.width, y: cy },
          thickness: 0.8, color: rgb(0, 0, 0),
        });
      }
    };

    const leftFinalScore = leftTeam === 'home' ? score3.home : score3.away;
    const rightFinalScore = rightTeam === 'home' ? score3.home : score3.away;

    // T-bars go through ALL remaining cells to 36 (deciding set can go beyond 15 with win-by-2)

    // Right side: from rightFinalScore+1 to 36
    if (rightFinalScore < 36) {
      drawTBarRange('right', rightFinalScore + 1, 36);
    }

    // Left post-change: from leftFinalScore+1 to 36
    if (leftSwitchPoint && leftFinalScore > leftSwitchPoint && leftFinalScore < 36) {
      drawTBarRange('Left_post_change', leftFinalScore + 1, 36);
    } else if (!leftSwitchPoint && leftFinalScore < 36) {
      // No switch happened — use left pre-change fields up to 13, then nothing beyond
      // (left pre-change only has fields 1-13, no T-bar needed there)
    }
  }

  if (flatten) form.flatten();
  return doc;
}

// ── Main Export ──────────────────────────────────────────────

export async function fillScoresheet(state: MatchState, { flatten = true }: { flatten?: boolean } = {}): Promise<Blob> {
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
    if (meta.court) { safeSetField(form, 'court', meta.court); safeSetField(form, 'Court', meta.court); }
    if (meta.division === 'Men') safeSetCheckbox(form, 'Men', true);
    if (meta.division === 'Women') safeSetCheckbox(form, 'Women', true);
    if (meta.division === 'CoEd') safeSetCheckbox(form, 'CoEd', true);
    if (meta.category === 'Adult') safeSetCheckbox(form, 'Adult', true);
    if (meta.category === 'Junior') safeSetCheckbox(form, 'Junior', true);
    if (meta.scorer) safeSetField(form, 'Match Scorer', meta.scorer);
    if (meta.referee) { safeSetField(form, 'Match 1st Referee', meta.referee); safeSetField(form, '1st', meta.referee); }
    if (meta.downRef) safeSetField(form, 'Down Ref', meta.downRef);
    if (meta.workTeam) safeSetField(form, 'Work Team', meta.workTeam);
    if (meta.region) safeSetField(form, 'Region', meta.region);
  }

  // ── Match Time (set 1 start time) ──
  if (state.sets[0]?.startTime) {
    const d = new Date(state.sets[0].startTime);
    safeSetField(form, 'time', d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'));
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

  // ── Sanctions / Improper Requests ──
  const sanctionEvents = state.events.filter(
    (e): e is import('@/types/match').SanctionEvent => e.type === 'sanction'
  );

  // Map recipient to the symbol used on the scoresheet
  const recipientSymbol: Record<string, string> = {
    player: '#',
    coach: 'C',
    asstCoach: 'A',
    trainer: 'T',
    manager: 'M',
  };

  sanctionEvents.forEach((e, idx) => {
    if (idx >= 5) return; // max 5 rows
    const row = idx + 1;
    const teamLetter = e.team === 'home' ? 'A' : 'B';

    // Determine the symbol: 'D' for delays, player number for players, recipient symbol for others
    const isDelay = e.sanctionType === 'delay-warning' || e.sanctionType === 'delay-penalty';
    const symbol = isDelay ? 'D' : (
      e.sanctionRecipient === 'player' && e.playerNumber
        ? String(e.playerNumber)
        : (e.sanctionRecipient ? recipientSymbol[e.sanctionRecipient] || '#' : '#')
    );

    // Mark the type column with the appropriate symbol
    if (e.sanctionType === 'warning' || e.sanctionType === 'delay-warning') {
      safeSetField(form, `yellow_card_${row}`, symbol, TextAlignment.Center);
    } else if (e.sanctionType === 'penalty' || e.sanctionType === 'delay-penalty') {
      safeSetField(form, `red_card_${row}`, symbol, TextAlignment.Center);
    } else if (e.sanctionType === 'expulsion') {
      safeSetField(form, `Expulsion_${row}`, symbol, TextAlignment.Center);
    } else if (e.sanctionType === 'disqualification') {
      safeSetField(form, `Disqualified_${row}`, symbol, TextAlignment.Center);
    }

    // Team, set, and score
    safeSetField(form, `penalized_team_${row}`, teamLetter, TextAlignment.Center);
    safeSetField(form, `penalty_current_set_${row}`, String(e.setIndex + 1), TextAlignment.Center);
    safeSetField(form, `penalty_current_score_${row}`, `${e.homeScore}:${e.awayScore}`, TextAlignment.Center);

    // Player number if present
    if (e.playerNumber) {
      safeSetField(form, `penalized_player_${row}`, String(e.playerNumber), TextAlignment.Center);
    }
  });

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

  // ── Remarks ──
  const remarks: string[] = state.remarks ? [...state.remarks] : [];

  // Add sanction details to remarks
  const sanctionLabels: Record<string, string> = {
    'warning': 'Warning', 'penalty': 'Penalty',
    'delay-warning': 'Delay Warning', 'delay-penalty': 'Delay Penalty',
    'expulsion': 'Expulsion', 'disqualification': 'Disqualification',
  };
  const recipientLabels: Record<string, string> = {
    player: 'Player', coach: 'Coach', asstCoach: 'Asst Coach', trainer: 'Trainer', manager: 'Manager',
  };
  const decidingSetIndex = state.config.bestOf - 1;
  sanctionEvents.forEach((e) => {
    // Skip set 3 sanctions — they go in the deciding set PDF remarks
    if (e.setIndex === decidingSetIndex && decidingSetIndex >= 2) return;
    const teamName = e.team === 'home' ? state.homeTeam.name : state.awayTeam.name;
    const label = sanctionLabels[e.sanctionType] || e.sanctionType;
    const recipient = e.sanctionRecipient ? recipientLabels[e.sanctionRecipient] || '' : '';
    const playerStr = e.playerNumber ? ` #${e.playerNumber}` : '';
    const scoreStr = `${e.homeScore}:${e.awayScore}`;
    remarks.push(`Set ${e.setIndex + 1} (${scoreStr}): ${label} - ${teamName}${recipient ? ' ' + recipient : ''}${playerStr}`);
  });

  if (remarks.length > 0) {
    try {
      const remarksField = form.getTextField('Remarks');
      remarksField.enableMultiline();
      remarksField.setAlignment(TextAlignment.Left);
      remarksField.setFontSize(6);
      remarksField.setText(remarks.join('\n'));
    } catch {
      // fallback
      safeSetField(form, 'Remarks', remarks.join('\n'), TextAlignment.Left, 6);
    }
  }

  // ── Fill each set/team quadrant ──
  const tbarRanges: TBarRange[] = [];

  if (state.sets[0]?.homeLineup || state.sets[0]?.awayLineup || state.events.some(e => e.setIndex === 0)) {
    fillTeamSetFields(form, state, 0, 'home', getSidePrefix('left'), getSetSuffix(0), drawInstructions, tbarRanges);
    fillTeamSetFields(form, state, 0, 'away', getSidePrefix('right'), getSetSuffix(0), drawInstructions, tbarRanges);
  }

  const hasSet2Events = state.events.some(e => e.setIndex === 1);
  if (hasSet2Events) {
    fillTeamSetFields(form, state, 1, 'home', getSidePrefix('left'), getSetSuffix(1), drawInstructions, tbarRanges);
    fillTeamSetFields(form, state, 1, 'away', getSidePrefix('right'), getSetSuffix(1), drawInstructions, tbarRanges);
  }

  // ── Resolve field positions BEFORE flattening ──
  const resolvedShapes: Array<{
    pageIndex: number;
    rect: { x: number; y: number; width: number; height: number };
    shape: 'triangle' | 'circle' | 'slash';
  }> = [];

  for (const instr of drawInstructions) {
    if (instr.rect) {
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
    } else if (s.shape === 'circle') {
      drawCircleOnPage(page, s.rect);
    } else if (s.shape === 'slash') {
      drawSlashOnPage(page, s.rect);
    }
  }

  // ── Draw T-bars using coordinate map (precise, column-aware) ──
  const page0 = pages[0];
  for (const tb of tbarRanges) {
    drawTBarsOnPage(page0, tb.side, tb.setIndex, tb.startPoint, tb.endPoint);
  }

  if (flatten) form.flatten();

  // ── Merge deciding set PDF if 3rd set exists ──
  const hasDecidingSet = state.events.some(e => e.setIndex === decidingSetIndex);

  if (hasDecidingSet && decidingSetIndex >= 2) {
    const decidingDoc = await fillDecidingSetSheet(state, flatten);
    const decidingPages = await doc.copyPages(decidingDoc, decidingDoc.getPageIndices());
    for (const page of decidingPages) {
      doc.addPage(page);
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
