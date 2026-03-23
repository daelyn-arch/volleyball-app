import { PDFDocument, rgb, TextAlignment, StandardFonts } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import type { MatchState, TeamSide, CourtPosition } from '@/types/match';
import {
  safeSetField,
  getFieldRect,
  drawTriangleOnPage,
} from './pdfFill';
import { getCifSetData, type CifSetData } from '@/store/cifDerived';
import { getSetScore } from '@/store/derived';
import { getSetWinner } from '@/utils/scoring';

// Service round colors: 1st = black, 2nd = red, 3rd = blue
const TERM_COLORS = [rgb(0, 0, 0), rgb(0.8, 0, 0), rgb(0, 0, 0.8)];

function getTermColor(termIndex: number) {
  return TERM_COLORS[Math.min(termIndex, TERM_COLORS.length - 1)];
}

// ── Shape helpers for service rounds ───────────────────────────

/** Draw text centered inside a circle. Returns total width consumed. */
function drawCircledText(
  page: PDFPage, font: PDFFont,
  text: string, x: number, y: number, fontSize: number,
  color = rgb(0, 0, 0),
): number {
  const w = font.widthOfTextAtSize(text, fontSize);
  const r = Math.max(w, fontSize) / 2 + 1.5;
  const cx = x + r;
  const cy = y + fontSize * 0.3;
  page.drawText(text, { x: cx - w / 2, y, size: fontSize, font, color });
  page.drawCircle({
    x: cx, y: cy, size: r,
    borderColor: color, borderWidth: 0.75,
    color: rgb(1, 1, 1), opacity: 0, borderOpacity: 1,
  });
  return r * 2 + 2;
}

/** Draw text centered inside a triangle. Returns total width consumed. */
function drawTriangledText(
  page: PDFPage, font: PDFFont,
  text: string, x: number, y: number, fontSize: number,
  color = rgb(0, 0, 0),
): number {
  const w = font.widthOfTextAtSize(text, fontSize);
  const dim = Math.max(w, fontSize) + 3;
  const h = dim / 2;
  const halfBase = h * 0.866;
  const cx = x + halfBase;
  const cy = y + fontSize * 0.3;
  page.drawText(text, { x: cx - w / 2, y, size: fontSize, font, color });
  const apex = { x: cx, y: cy + h };
  const bl = { x: cx - halfBase, y: cy - h };
  const br = { x: cx + halfBase, y: cy - h };
  page.drawLine({ start: apex, end: bl, thickness: 0.75, color });
  page.drawLine({ start: bl, end: br, thickness: 0.75, color });
  page.drawLine({ start: br, end: apex, thickness: 0.75, color });
  return halfBase * 2 + 2;
}

/** Draw text inside a rectangle/box (for penalties and foot faults). */
function drawBoxedText(
  page: PDFPage, font: PDFFont,
  text: string, x: number, y: number, fontSize: number,
  color = rgb(0, 0, 0),
): number {
  const w = font.widthOfTextAtSize(text, fontSize);
  const pad = 2;
  const boxW = w + pad * 2;
  const boxH = fontSize + pad * 2;
  page.drawText(text, { x: x + pad, y, size: fontSize, font, color });
  page.drawRectangle({
    x, y: y - pad, width: boxW, height: boxH,
    borderColor: color, borderWidth: 0.75,
    color: rgb(1, 1, 1), opacity: 0, borderOpacity: 1,
  });
  return boxW + 2;
}

/** Draw plain text. Returns width consumed. */
function drawPlainText(
  page: PDFPage, font: PDFFont,
  text: string, x: number, y: number, fontSize: number,
  color = rgb(0, 0, 0),
): number {
  const w = font.widthOfTextAtSize(text, fontSize);
  page.drawText(text, { x, y, size: fontSize, font, color });
  return w + 5;
}

/** Draw a diagonal strikethrough line over text */
function drawStrikethrough(page: PDFPage, x: number, y: number, w: number, fontSize: number) {
  page.drawLine({
    start: { x, y: y - fontSize * 0.1 },
    end: { x: x + w, y: y + fontSize * 0.7 },
    thickness: 1, color: rgb(0, 0, 0),
  });
}

// ── Running score shapes ───────────────────────────────────────

function drawCifCircle(
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number },
  color = rgb(0, 0, 0),
) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const r = (Math.min(rect.width, rect.height) / 2) * 0.9;
  page.drawCircle({
    x: cx, y: cy, size: r,
    borderColor: color, borderWidth: 1.75,
    color: rgb(1, 1, 1), opacity: 0, borderOpacity: 1,
  });
}

function drawCifSlash(
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number },
  color = rgb(0, 0, 0),
) {
  const inset = 2;
  page.drawLine({
    start: { x: rect.x + inset, y: rect.y + inset },
    end: { x: rect.x + rect.width - inset, y: rect.y + rect.height - inset },
    thickness: 1.25, color,
  });
}

function drawCifTriangle(
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number },
  color = rgb(0, 0, 0),
) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dim = Math.min(rect.width, rect.height);
  const h = dim / 2;
  const halfBase = h * 0.866;
  const apex = { x: cx, y: cy + h };
  const bl = { x: cx - halfBase, y: cy - h };
  const br = { x: cx + halfBase, y: cy - h };
  page.drawLine({ start: apex, end: bl, thickness: 0.75, color });
  page.drawLine({ start: bl, end: br, thickness: 0.75, color });
  page.drawLine({ start: br, end: apex, thickness: 0.75, color });
}

/** Draw "P" + rectangle around a running score cell (penalty point) */
function drawCifPenalty(
  page: PDFPage, font: PDFFont, fontBold: PDFFont,
  rect: { x: number; y: number; width: number; height: number },
  color = rgb(0, 0, 0),
) {
  const text = 'P';
  const fontSize = Math.min(rect.width, rect.height) * 0.6 + 2;
  const tw = fontBold.widthOfTextAtSize(text, fontSize);
  // Draw bold P to the left of the cell (shifted right 5px)
  page.drawText(text, {
    x: rect.x - tw + 4,
    y: rect.y + (rect.height - fontSize) / 2,
    size: fontSize, font: fontBold, color,
  });
  // Draw rectangle around P + number cell
  page.drawRectangle({
    x: rect.x - tw + 3, y: rect.y,
    width: rect.width + tw - 5, height: rect.height,
    borderColor: color, borderWidth: 1,
    color: rgb(1, 1, 1), opacity: 0, borderOpacity: 1,
  });
}

/** Circle a form field by name */
function circleField(form: any, page: PDFPage, fieldName: string) {
  const rect = getFieldRect(form, fieldName);
  if (!rect) return;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const r = Math.max(rect.width, rect.height) / 2 + 2;
  page.drawCircle({
    x: cx, y: cy, size: r,
    borderColor: rgb(0, 0, 0), borderWidth: 1,
    color: rgb(1, 1, 1), opacity: 0, borderOpacity: 1,
  });
}

/** Draw a rectangle around a form field by name */
function rectField(form: any, page: PDFPage, fieldName: string) {
  const rect = getFieldRect(form, fieldName);
  if (!rect) return;
  page.drawRectangle({
    x: rect.x - 2, y: rect.y - 2,
    width: rect.width + 4, height: rect.height + 4,
    borderColor: rgb(0, 0, 0), borderWidth: 1.25,
    color: rgb(1, 1, 1), opacity: 0, borderOpacity: 1,
  });
}

// ── Running Score Grid ─────────────────────────────────────────

const CIF_CELL_W = 19.44;
const CIF_CELL_H = 233.72 / 20;

const CIF_COLS: Record<string, { x: number; top: number }> = {
  home_1: { x: 449.55, top: 454.17 },
  home_2: { x: 472.24, top: 453.74 },
  away_1: { x: 494.93, top: 453.74 },
  away_2: { x: 515.88, top: 453.74 },
};

function getCifScoreCellRect(
  team: 'home' | 'away', point: number,
): { x: number; y: number; width: number; height: number } | null {
  if (point < 1 || point > 40) return null;
  const half = point <= 20 ? '1' : '2';
  const col = CIF_COLS[`${team}_${half}`];
  if (!col) return null;
  const row = point <= 20 ? point - 1 : point - 21;
  return { x: col.x, y: col.top - (row + 1) * CIF_CELL_H, width: CIF_CELL_W, height: CIF_CELL_H };
}

/** Map pointNumber → termIndex for color lookup */
function buildPointColorMap(cifData: CifSetData, team: TeamSide): Map<number, number> {
  const map = new Map<number, number>();
  const rows = team === 'home' ? cifData.homePositionRows : cifData.awayPositionRows;
  for (let pos = 1; pos <= 6; pos++) {
    const terms = rows[pos as CourtPosition];
    for (let ti = 0; ti < terms.length; ti++) {
      const term = terms[ti];
      if (term.sideoutPoint !== null) map.set(term.sideoutPoint, ti);
      for (const pt of term.servedPoints) map.set(pt, ti);
    }
  }
  return map;
}

// ── Service Terms (CIF convention) ─────────────────────────────

function fillServiceTerms(
  form: any, page: PDFPage, font: PDFFont,
  cifData: CifSetData, team: TeamSide,
) {
  const side = team === 'home' ? 'left' : 'right';
  const rows = team === 'home' ? cifData.homePositionRows : cifData.awayPositionRows;
  const penaltyPts = team === 'home' ? cifData.homePenaltyPoints : cifData.awayPenaltyPoints;
  const fontSize = 7;

  for (let pos = 1; pos <= 6; pos++) {
    const terms = rows[pos as CourtPosition];
    if (terms.length === 0) continue;

    const rect = getFieldRect(form, `service rounds ${side} team pos ${pos}`);
    if (!rect) continue;

    const upperY = rect.y + rect.height * 0.62;
    const lowerY = rect.y + rect.height * 0.18;
    const rightEdge = rect.x + rect.width - 2;
    const leftEdge = rect.x + 3;

    let x = leftEdge;
    let y = upperY;
    let full = false;

    const canFit = (w: number): boolean => {
      if (full) return false;
      if (x + w <= rightEdge) return true;
      if (y === upperY) {
        x = leftEdge;
        y = lowerY;
        return x + w <= rightEdge;
      }
      full = true;
      return false;
    };

    for (let ti = 0; ti < terms.length && !full; ti++) {
      const term = terms[ti];
      const color = getTermColor(ti);

      // Sideout point (not circled)
      if (term.sideoutPoint !== null && !full) {
        const text = String(term.sideoutPoint);
        const w = font.widthOfTextAtSize(text, fontSize) + 5;
        if (canFit(w)) {
          drawPlainText(page, font, text, x, y, fontSize, color);
          x += w;
        }
      }

      // Served points: circled, or boxed P{n} for penalties
      for (const pt of term.servedPoints) {
        if (full) break;
        if (penaltyPts.has(pt)) {
          // Penalty point → boxed "P{n}"
          const text = `P${pt}`;
          const tw = font.widthOfTextAtSize(text, fontSize);
          const w = tw + 6; // box padding
          if (canFit(w)) {
            drawBoxedText(page, font, text, x, y, fontSize, color);
            x += w;
          }
        } else if (term.isLibero) {
          // Libero served point → triangled
          const text = String(pt);
          const tw = font.widthOfTextAtSize(text, fontSize);
          const dim = Math.max(tw, fontSize) + 3;
          const halfBase = (dim / 2) * 0.866;
          const w = halfBase * 2 + 2;
          if (canFit(w)) {
            drawTriangledText(page, font, text, x, y, fontSize, color);
            x += w;
          }
        } else {
          // Normal served point → circled
          const text = String(pt);
          const tw = font.widthOfTextAtSize(text, fontSize);
          const r = Math.max(tw, fontSize) / 2 + 1.5;
          const w = r * 2 + 2;
          if (canFit(w)) {
            drawCircledText(page, font, text, x, y, fontSize, color);
            x += w;
          }
        }
      }

      // Inline events (T/Tx, S/Sx, RS)
      for (const evt of term.inlineEvents) {
        if (full) break;
        let label = '';
        if (evt.type === 'timeout') {
          label = evt.forServingTeam ? 'T' : 'Tx';
        } else if (evt.type === 'sub') {
          label = `${evt.forServingTeam ? 'S' : 'Sx'} ${evt.detail}`;
        } else if (evt.type === 'reServe') {
          label = 'RS';
        }
        if (label) {
          const w = font.widthOfTextAtSize(label, fontSize) + 5;
          if (canFit(w)) {
            drawPlainText(page, font, label, x, y, fontSize, color);
            x += w;
          }
        }
      }

      // R at end of service
      if (term.exitScore !== null && !full) {
        const rText = 'R';
        if (term.wasFootFault) {
          // Foot fault → boxed R
          const tw = font.widthOfTextAtSize(rText, fontSize);
          const w = tw + 6;
          if (canFit(w)) {
            drawBoxedText(page, font, rText, x, y, fontSize, color);
            x += w;
          }
        } else if (term.isLibero) {
          // Libero → triangled R
          const tw = font.widthOfTextAtSize(rText, fontSize);
          const dim = Math.max(tw, fontSize) + 3;
          const halfBase = (dim / 2) * 0.866;
          const w = halfBase * 2 + 2;
          if (canFit(w)) {
            drawTriangledText(page, font, rText, x, y, fontSize, color);
            x += w;
          }
        } else {
          // Normal → circled R
          const tw = font.widthOfTextAtSize(rText, fontSize);
          const r = Math.max(tw, fontSize) / 2 + 1.5;
          const w = r * 2 + 2;
          if (canFit(w)) {
            drawCircledText(page, font, rText, x, y, fontSize, color);
            x += w;
          }
        }
      }
    }
  }
}

// ── Lineup + Subs ──────────────────────────────────────────────

function drawLineupAndSubs(
  form: any, page: PDFPage, font: PDFFont,
  cifData: CifSetData, team: TeamSide,
) {
  const side = team === 'home' ? 'left' : 'right';
  const lineup = team === 'home' ? cifData.homeStartingLineup : cifData.awayStartingLineup;
  const subs = team === 'home' ? cifData.homeSubstitutions : cifData.awaySubstitutions;
  if (!lineup) return;

  const fontSize = 12;

  for (let p = 1; p <= 6; p++) {
    const rect = getFieldRect(form, `pos ${p} team ${side}`);
    if (!rect) continue;

    const startingPlayer = lineup[p as CourtPosition];
    const text = String(startingPlayer);
    const baseY = rect.y + rect.height * 0.62;
    let x = rect.x + 3;

    const tw = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, { x, y: baseY, size: fontSize, font, color: rgb(0, 0, 0) });

    const sub = subs.find(s => s.playerOut === startingPlayer);
    if (sub) {
      drawStrikethrough(page, x, baseY, tw, fontSize);
      x += tw + 3;
      page.drawText(String(sub.playerIn), { x, y: baseY, size: fontSize, font, color: rgb(0, 0, 0) });
    }
  }
}

// ── Libero triangles on Roman numerals ─────────────────────────
// Returns rects to draw AFTER flatten (so fields don't cover them)

function getLiberoTriangleRects(
  form: any, cifData: CifSetData, team: TeamSide,
): Array<{ x: number; y: number; width: number; height: number }> {
  const side = team === 'home' ? 'left' : 'right';
  const rows = team === 'home' ? cifData.homePositionRows : cifData.awayPositionRows;
  const posRoman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

  for (let pos = 1; pos <= 6; pos++) {
    const terms = rows[pos as CourtPosition];
    if (!terms.some(t => t.isLibero)) continue;
    const rect = getFieldRect(form, `${side} team ${posRoman[pos - 1]}`);
    if (rect) rects.push(rect);
  }
  return rects;
}

// ── Running Score Drawing ──────────────────────────────────────

function drawRunningScore(
  page: PDFPage, font: PDFFont, fontBold: PDFFont, state: MatchState, cifData: CifSetData,
) {
  const homeColorMap = buildPointColorMap(cifData, 'home');
  const awayColorMap = buildPointColorMap(cifData, 'away');

  for (const pt of cifData.points) {
    const rect = getCifScoreCellRect(pt.scoringTeam, pt.pointNumber);
    if (!rect) continue;

    const colorMap = pt.scoringTeam === 'home' ? homeColorMap : awayColorMap;
    const ti = colorMap.get(pt.pointNumber) ?? 0;
    const color = getTermColor(ti);

    // Penalty point → P + rectangle (no circle/slash)
    const penaltyPts = pt.scoringTeam === 'home' ? cifData.homePenaltyPoints : cifData.awayPenaltyPoints;
    if (penaltyPts.has(pt.pointNumber)) {
      drawCifPenalty(page, font, fontBold, rect, color);
    } else if (pt.wasLiberoServing && pt.wasServedPoint) {
      drawCifTriangle(page, rect, color);
    } else if (pt.wasServedPoint) {
      drawCifCircle(page, rect, color);
    } else {
      drawCifSlash(page, rect, color);
    }
  }
}

// ── Fill One CIF Set Page ──────────────────────────────────────

async function fillCifSetPage(
  doc: PDFDocument, form: any, page: PDFPage,
  state: MatchState, setIndex: number,
): Promise<Array<{ x: number; y: number; width: number; height: number }>> {
  const cifData = getCifSetData(state, setIndex);
  const setData = state.sets[setIndex];
  if (!setData) return [];

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // ── Team names ──
  safeSetField(form, 'team left', state.homeTeam.name);
  safeSetField(form, 'team 2 right', state.awayTeam.name);
  safeSetField(form, 'team 1 vs', state.homeTeam.name);
  safeSetField(form, 'team 2 vs', state.awayTeam.name);

  // ── Metadata ──
  safeSetField(form, 'date', new Date(state.createdAt).toLocaleDateString());
  if (state.metadata) {
    const m = state.metadata;
    if (m.competition) safeSetField(form, 'place', m.competition);
    if (m.scheduledTime) safeSetField(form, 'scheduled time', m.scheduledTime);
    if (m.scorer) safeSetField(form, 'scorer', m.scorer);
    if (m.referee) safeSetField(form, '1st', m.referee);
    if (m.downRef) safeSetField(form, '2nd', m.downRef);
  }
  if (setData.startTime) {
    const d = new Date(setData.startTime);
    safeSetField(form, 'start time', `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
  }
  if (setData.endTime) {
    const d = new Date(setData.endTime);
    safeSetField(form, 'finish time', `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
  }

  // ── Level ──
  if (state.metadata?.level) {
    const lvl = state.metadata.level.toLowerCase();
    if (lvl.includes('varsity') && !lvl.includes('junior')) rectField(form, page, 'varsity');
    else if (lvl.includes('jv') || lvl.includes('junior')) rectField(form, page, 'jv');
    else if (lvl.includes('frosh') || lvl.includes('soph')) rectField(form, page, 'frosh/soph');
  }

  // ── Set number ──
  circleField(form, page, `set ${setIndex + 1}`);

  // ── Serve / Receive ──
  if (cifData.firstServe) {
    safeSetField(form, 'first serve left', cifData.firstServe === 'home' ? 'X' : '');
    safeSetField(form, 'first serve right', cifData.firstServe === 'away' ? 'X' : '');
  }

  // ── Libero ──
  const homeLiberos = state.homeTeam.roster.filter(p => p.isLibero);
  const awayLiberos = state.awayTeam.roster.filter(p => p.isLibero);
  if (homeLiberos.length > 0) safeSetField(form, 'left libero', homeLiberos.map(l => l.number).join(', '), TextAlignment.Center);
  if (awayLiberos.length > 0) safeSetField(form, 'right libero', awayLiberos.map(l => l.number).join(', '), TextAlignment.Center);

  // ── Lineup + subs ──
  drawLineupAndSubs(form, page, font, cifData, 'home');
  drawLineupAndSubs(form, page, font, cifData, 'away');

  // ── Collect libero triangle rects (drawn AFTER flatten) ──
  const liberoTriangleRects = [
    ...getLiberoTriangleRects(form, cifData, 'home'),
    ...getLiberoTriangleRects(form, cifData, 'away'),
  ];

  // ── Service terms ──
  fillServiceTerms(form, page, font, cifData, 'home');
  fillServiceTerms(form, page, font, cifData, 'away');

  // ── Running score ──
  drawRunningScore(page, font, fontBold, state, cifData);

  // ── Timeouts ──
  for (const to of cifData.homeTimeouts) safeSetField(form, `timeout ${to.timeoutNumber} left`, `${to.homeScore}-${to.awayScore}`, TextAlignment.Center);
  for (const to of cifData.awayTimeouts) safeSetField(form, `timeout ${to.timeoutNumber} right`, `${to.homeScore}-${to.awayScore}`, TextAlignment.Center);

  // ── Substitution count boxes ──
  for (let i = 1; i <= cifData.homeSubstitutions.length && i <= 18; i++) safeSetField(form, `left sub ${i}`, 'X');
  for (let i = 1; i <= cifData.awaySubstitutions.length && i <= 18; i++) safeSetField(form, `right sub ${i}`, 'X');

  // ── Set result ──
  const score = getSetScore(state.events, setIndex);
  const winner = getSetWinner(score, setIndex, state.config);
  if (winner) {
    safeSetField(form, 'winning team', winner === 'home' ? state.homeTeam.name : state.awayTeam.name);
    safeSetField(form, 'losing team', winner === 'home' ? state.awayTeam.name : state.homeTeam.name);
    safeSetField(form, 'winning team score', String(winner === 'home' ? score.home : score.away), TextAlignment.Center);
    safeSetField(form, 'losing team score', String(winner === 'home' ? score.away : score.home), TextAlignment.Center);
  }

  // ── Comments / Remarks ──
  const remarks: string[] = state.remarks ? [...state.remarks] : [];
  const sanctionLabels: Record<string, string> = {
    warning: 'Warning', penalty: 'Penalty',
    'delay-warning': 'Delay Warning', 'delay-penalty': 'Delay Penalty',
    expulsion: 'Expulsion', disqualification: 'Disqualification',
  };
  const recipientLabels: Record<string, string> = {
    player: 'Player', coach: 'Coach', asstCoach: 'Asst Coach', trainer: 'Trainer', manager: 'Manager',
  };
  const sanctionEvents = state.events.filter(
    (e): e is import('@/types/match').SanctionEvent => e.type === 'sanction' && e.setIndex === setIndex
  );
  for (const e of sanctionEvents) {
    const teamName = e.team === 'home' ? state.homeTeam.name : state.awayTeam.name;
    const label = sanctionLabels[e.sanctionType] || e.sanctionType;
    const recipient = e.sanctionRecipient ? recipientLabels[e.sanctionRecipient] || '' : '';
    const playerStr = e.playerNumber ? ` #${e.playerNumber}` : '';
    remarks.push(`Set ${setIndex + 1} (${e.homeScore}:${e.awayScore}): ${label} - ${teamName}${recipient ? ' ' + recipient : ''}${playerStr}`);
  }
  if (remarks.length > 0) {
    try {
      const commentsField = form.getTextField('comments');
      commentsField.enableMultiline();
      commentsField.setAlignment(TextAlignment.Left);
      commentsField.setFontSize(6);
      // Shift down + tabs to push past the "COMMENTS:" header
      commentsField.setText(' \n\t\t\t\t\t\t\t\t\t\t\t' + remarks.join('\n'));
    } catch {
      safeSetField(form, 'comments', ' \n\t\t\t\t\t\t\t\t\t\t\t' + remarks.join('\n'), TextAlignment.Left, 6);
    }
  }

  return liberoTriangleRects;
}

// ── Main Fill Function ─────────────────────────────────────────

export async function fillCifScoresheet(
  state: MatchState, { flatten = true }: { flatten?: boolean } = {},
): Promise<Blob> {
  const templateBytes = await fetch('/cif_scoresheet_prepared_form.pdf').then(r => r.arrayBuffer());
  const output = await PDFDocument.create();

  for (let si = 0; si <= state.currentSetIndex; si++) {
    const setDoc = await PDFDocument.load(templateBytes);
    const form = setDoc.getForm();
    const page = setDoc.getPages()[0];

    const liberoRects = await fillCifSetPage(setDoc, form, page, state, si);

    if (flatten) form.flatten();

    // Draw libero triangles AFTER flatten so field backgrounds don't cover them
    for (const rect of liberoRects) {
      drawTriangleOnPage(page, rect);
    }

    const [copiedPage] = await output.copyPages(setDoc, [0]);
    output.addPage(copiedPage);
  }

  const pdfBytes = await output.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// ── Download Helper ────────────────────────────────────────────

export async function downloadCifScoresheet(state: MatchState) {
  const blob = await fillCifScoresheet(state);
  const url = URL.createObjectURL(blob);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    window.open(url, '_blank');
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = `cif_scoresheet_${state.homeTeam.name}_vs_${state.awayTeam.name}.pdf`;
    a.click();
  }
  URL.revokeObjectURL(url);
}
