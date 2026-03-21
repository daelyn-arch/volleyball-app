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

// ── Shape helpers for service rounds ───────────────────────────

// Service round colors: 1st = black, 2nd = red, 3rd = blue
const TERM_COLORS = [rgb(0, 0, 0), rgb(0.8, 0, 0), rgb(0, 0, 0.8)];

function getTermColor(termIndex: number) {
  return TERM_COLORS[Math.min(termIndex, TERM_COLORS.length - 1)];
}

/** Draw text, then a circle around it. Returns total width consumed. */
function drawCircledText(
  page: PDFPage, font: PDFFont,
  text: string, x: number, y: number, fontSize: number,
  color = rgb(0, 0, 0),
): number {
  const w = font.widthOfTextAtSize(text, fontSize);
  page.drawText(text, { x, y, size: fontSize, font, color });
  const cx = x + w / 2;
  const cy = y + fontSize * 0.3;
  const r = Math.max(w, fontSize) / 2 + 1.5;
  page.drawCircle({
    x: cx, y: cy, size: r,
    borderColor: color, borderWidth: 0.75,
    color: rgb(1, 1, 1), opacity: 0, borderOpacity: 1,
  });
  return r * 2 + 2;
}

/** Draw text, then a triangle around it. Returns total width consumed. */
function drawTriangledText(
  page: PDFPage, font: PDFFont,
  text: string, x: number, y: number, fontSize: number,
  color = rgb(0, 0, 0),
): number {
  const w = font.widthOfTextAtSize(text, fontSize);
  page.drawText(text, { x, y, size: fontSize, font, color });
  const cx = x + w / 2;
  const cy = y + fontSize * 0.3;
  const dim = Math.max(w, fontSize) + 3;
  const h = dim / 2;
  const halfBase = h * 0.866;
  const apex = { x: cx, y: cy + h };
  const bl = { x: cx - halfBase, y: cy - h };
  const br = { x: cx + halfBase, y: cy - h };
  page.drawLine({ start: apex, end: bl, thickness: 0.75, color });
  page.drawLine({ start: bl, end: br, thickness: 0.75, color });
  page.drawLine({ start: br, end: apex, thickness: 0.75, color });
  return halfBase * 2 + 2;
}

/** Draw plain text. Returns width consumed. */
function drawPlainText(
  page: PDFPage, font: PDFFont,
  text: string, x: number, y: number, fontSize: number,
  color = rgb(0, 0, 0),
): number {
  const w = font.widthOfTextAtSize(text, fontSize);
  page.drawText(text, { x, y, size: fontSize, font, color });
  return w + 2;
}

/** Draw a diagonal strikethrough line over text */
function drawStrikethrough(page: PDFPage, x: number, y: number, w: number, fontSize: number) {
  page.drawLine({
    start: { x, y: y - fontSize * 0.1 },
    end: { x: x + w, y: y + fontSize * 0.7 },
    thickness: 1, color: rgb(0, 0, 0),
  });
}

// ── CIF Circle for running score ───────────────────────────────

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

/** Build map: pointNumber → termIndex for a team (to determine color) */
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

/** Draw a circle around a form field by name */
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

// ── Service Terms (CIF convention) ─────────────────────────────
// Each served point → circled number
// End of service → circled R (or triangled R if libero)
// Inline events → T/Tx (timeout), S/Sx (sub)

function fillServiceTerms(
  form: any, page: PDFPage, font: PDFFont,
  cifData: CifSetData, team: TeamSide,
) {
  const side = team === 'home' ? 'left' : 'right';
  const rows = team === 'home' ? cifData.homePositionRows : cifData.awayPositionRows;
  const fontSize = 7;

  for (let pos = 1; pos <= 6; pos++) {
    const terms = rows[pos as CourtPosition];
    if (terms.length === 0) continue;

    const rect = getFieldRect(form, `service rounds ${side} team pos ${pos}`);
    if (!rect) continue;

    const upperY = rect.y + rect.height * 0.62;
    const lowerY = rect.y + rect.height * 0.18;
    const rightEdge = rect.x + rect.width - 2;

    let x = rect.x + 3;
    let y = upperY;

    const advance = (w: number) => {
      x += w;
      if (x > rightEdge && y === upperY) {
        x = rect.x + 3;
        y = lowerY;
      }
    };

    for (let ti = 0; ti < terms.length; ti++) {
      const term = terms[ti];
      const color = getTermColor(ti); // black → red → blue

      // Draw sideout point (not circled — gained while receiving)
      if (term.sideoutPoint !== null) {
        const w = drawPlainText(page, font, String(term.sideoutPoint), x, y, fontSize, color);
        advance(w);
      }

      // Draw each served point number with circle
      for (const pt of term.servedPoints) {
        const w = drawCircledText(page, font, String(pt), x, y, fontSize, color);
        advance(w);
      }

      // Draw inline events (T/Tx for timeouts, S/Sx #in/#out for subs)
      for (const evt of term.inlineEvents) {
        let label = '';
        if (evt.type === 'timeout') {
          label = evt.forServingTeam ? 'T' : 'Tx';
        } else if (evt.type === 'sub') {
          const prefix = evt.forServingTeam ? 'S' : 'Sx';
          label = `${prefix} ${evt.detail}`;
        }
        if (label) {
          const w = drawPlainText(page, font, label, x, y, fontSize, color);
          advance(w);
        }
      }

      // Draw R at end of service (if service ended)
      if (term.exitScore !== null) {
        if (term.isLibero) {
          const w = drawTriangledText(page, font, 'R', x, y, fontSize, color);
          advance(w);
        } else {
          const w = drawCircledText(page, font, 'R', x, y, fontSize, color);
          advance(w);
        }
      }
    }
  }
}

// ── Lineup + Subs in pos fields ────────────────────────────────

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

    // Draw starting player number
    const tw = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, { x, y: baseY, size: fontSize, font, color: rgb(0, 0, 0) });

    // Check if this player was subbed out
    const sub = subs.find(s => s.playerOut === startingPlayer);
    if (sub) {
      // Strikethrough the original number
      drawStrikethrough(page, x, baseY, tw, fontSize);
      // Draw the sub player number next to it
      x += tw + 3;
      page.drawText(String(sub.playerIn), { x, y: baseY, size: fontSize, font, color: rgb(0, 0, 0) });
    }
  }
}

// ── Libero triangle on Roman numerals ──────────────────────────

function drawLiberoTriangles(
  form: any, page: PDFPage,
  cifData: CifSetData, team: TeamSide,
) {
  const side = team === 'home' ? 'left' : 'right';
  const rows = team === 'home' ? cifData.homePositionRows : cifData.awayPositionRows;
  const posRoman = ['I', 'II', 'III', 'IV', 'V', 'VI'];

  for (let pos = 1; pos <= 6; pos++) {
    const terms = rows[pos as CourtPosition];
    const hadLiberoServe = terms.some(t => t.isLibero);
    if (!hadLiberoServe) continue;

    const fieldName = `${side} team ${posRoman[pos - 1]}`;
    const rect = getFieldRect(form, fieldName);
    if (!rect) continue;
    drawTriangleOnPage(page, rect);
  }
}

// ── Running Score Drawing ──────────────────────────────────────

function drawRunningScore(
  page: PDFPage, state: MatchState, cifData: CifSetData, _setIndex: number,
) {
  // Build color maps for both teams
  const homeColorMap = buildPointColorMap(cifData, 'home');
  const awayColorMap = buildPointColorMap(cifData, 'away');

  for (const pt of cifData.points) {
    const rect = getCifScoreCellRect(pt.scoringTeam, pt.pointNumber);
    if (!rect) continue;

    const colorMap = pt.scoringTeam === 'home' ? homeColorMap : awayColorMap;
    const ti = colorMap.get(pt.pointNumber) ?? 0;
    const color = getTermColor(ti);

    if (pt.wasLiberoServing && pt.wasServedPoint) {
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
) {
  const cifData = getCifSetData(state, setIndex);
  const setData = state.sets[setIndex];
  if (!setData) return;

  const font = await doc.embedFont(StandardFonts.Helvetica);

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

  // ── Level (circle the matching field) ──
  if (state.metadata?.level) {
    const lvl = state.metadata.level.toLowerCase();
    if (lvl.includes('varsity') && !lvl.includes('junior')) circleField(form, page, 'varsity');
    else if (lvl.includes('jv') || lvl.includes('junior')) circleField(form, page, 'jv');
    else if (lvl.includes('frosh') || lvl.includes('soph')) circleField(form, page, 'frosh/soph');
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

  // ── Lineup + subs in pos fields ──
  drawLineupAndSubs(form, page, font, cifData, 'home');
  drawLineupAndSubs(form, page, font, cifData, 'away');

  // ── Libero triangles on Roman numerals ──
  drawLiberoTriangles(form, page, cifData, 'home');
  drawLiberoTriangles(form, page, cifData, 'away');

  // ── Service terms (circled points, R markers, inline events) ──
  fillServiceTerms(form, page, font, cifData, 'home');
  fillServiceTerms(form, page, font, cifData, 'away');

  // ── Running score ──
  drawRunningScore(page, state, cifData, setIndex);

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
    await fillCifSetPage(setDoc, form, page, state, si);
    if (flatten) form.flatten();
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
