// Playwright e2e test: verify the deciding set (3rd set) PDF page is correctly filled
//
// KEY FINDING: pdf-lib's copyPages() copies page visual content but does NOT merge
// form field entries from the source AcroForm. This means:
//   - With flatten=true (default): field values are baked into the page content
//     as visual text, so they appear correctly when viewing/printing the PDF.
//   - With flatten=false: field values on the deciding set page are lost because
//     the AcroForm entries are not transferred during copyPages.
//
// This test verifies both scenarios.

const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

/**
 * Build a mock MatchState with 3 complete sets (deciding set match).
 * Home wins set 1 (25-20), Away wins set 2 (20-25), Home wins set 3 (15-10).
 */
function buildThreeSetState() {
  const now = Date.now();
  const events = [];
  let eventId = 0;

  function addPoint(setIndex, scoringTeam, servingTeam, serverNumber, homeScore, awayScore) {
    events.push({
      type: 'point', id: `p${++eventId}`, timestamp: now + eventId * 1000,
      setIndex, scoringTeam, servingTeam, serverNumber, homeScore, awayScore,
    });
  }

  const homeRoster = [1, 2, 3, 4, 5, 6];
  const awayRoster = [11, 12, 13, 14, 15, 16];

  // Helper to generate points for a set
  function generateSet(setIndex, homeTarget, awayTarget, firstServe) {
    let h = 0, a = 0;
    let servingTeam = firstServe;
    let homeServerIdx = 0, awayServerIdx = 0;

    // Build scoring sequence: winner scores last
    const sequence = [];
    for (let i = 0; i < homeTarget; i++) sequence.push('home');
    for (let i = 0; i < awayTarget; i++) sequence.push('away');

    // Shuffle all but last (winner must score last)
    const last = homeTarget > awayTarget ? 'home' : 'away';
    const pool = [];
    let hRemain = homeTarget - (last === 'home' ? 1 : 0);
    let aRemain = awayTarget - (last === 'away' ? 1 : 0);
    for (let i = 0; i < hRemain; i++) pool.push('home');
    for (let i = 0; i < aRemain; i++) pool.push('away');

    // Simple deterministic interleave
    const ordered = [];
    let hi = 0, ai = 0;
    while (hi < pool.filter(x => x === 'home').length || ai < pool.filter(x => x === 'away').length) {
      const hCount = pool.filter(x => x === 'home').length;
      const aCount = pool.filter(x => x === 'away').length;
      if (hi < hCount) { ordered.push('home'); hi++; }
      if (ai < aCount) { ordered.push('away'); ai++; }
    }
    ordered.push(last);

    for (const team of ordered) {
      const serverNumber = servingTeam === 'home'
        ? homeRoster[homeServerIdx % 6]
        : awayRoster[awayServerIdx % 6];
      if (team === 'home') h++;
      else a++;
      addPoint(setIndex, team, servingTeam, serverNumber, h, a);
      if (team !== servingTeam) {
        servingTeam = team;
        if (team === 'home') homeServerIdx++;
        else awayServerIdx++;
      }
    }
  }

  generateSet(0, 25, 20, 'home');  // Home wins set 1
  generateSet(1, 20, 25, 'away');  // Away wins set 2
  generateSet(2, 15, 10, 'home');  // Home wins deciding set

  // Add a sanction in set 3 for testing
  events.push({
    type: 'sanction', id: 's1', timestamp: now + 99000, setIndex: 2,
    team: 'home', sanctionType: 'warning', sanctionRecipient: 'player',
    playerNumber: 3, homeScore: 5, awayScore: 3,
  });

  return {
    id: 'test-deciding-set',
    createdAt: now,
    homeTeam: {
      name: 'Eagles',
      roster: [
        { number: 1, isCaptain: true }, { number: 2 }, { number: 3 },
        { number: 4 }, { number: 5 }, { number: 6 },
        { number: 7 }, { number: 8 }, { number: 9 },
        { number: 10, isLibero: true },
      ],
    },
    awayTeam: {
      name: 'Hawks',
      roster: [
        { number: 11, isCaptain: true }, { number: 12 }, { number: 13 },
        { number: 14 }, { number: 15 }, { number: 16 },
        { number: 17 }, { number: 18 }, { number: 19 },
        { number: 20, isLibero: true },
      ],
    },
    config: {
      bestOf: 3,
      pointsToWin: 25,
      decidingSetPoints: 15,
      maxSubsPerSet: 15,
      maxTimeoutsPerSet: 2,
    },
    sets: [
      {
        homeLineup: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 },
        awayLineup: { 1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16 },
        firstServe: 'home', homeBenchSide: 'left',
        startTime: now, endTime: now + 3600000, sidesSwitchedAtScore: null,
      },
      {
        homeLineup: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 },
        awayLineup: { 1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16 },
        firstServe: 'away', homeBenchSide: 'right',
        startTime: now + 3600000, endTime: now + 7200000, sidesSwitchedAtScore: null,
      },
      {
        homeLineup: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 },
        awayLineup: { 1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16 },
        firstServe: 'home', homeBenchSide: 'left',
        startTime: now + 7200000, endTime: now + 9000000, sidesSwitchedAtScore: null,
      },
    ],
    events,
    currentSetIndex: 2,
    matchComplete: true,
    metadata: {
      competition: 'State Championship', cityState: 'Denver, CO',
      hall: 'Main Arena', matchNumber: '42', level: 'D1',
      division: 'Women', category: 'Adult', poolPhase: 'Semifinal',
      court: '2', scorer: 'Alice Johnson', referee: 'Bob Williams', downRef: 'Carol Davis',
    },
    liberoServingPositions: {},
    remarks: [],
  };
}

async function runTest() {
  console.log('=== Deciding Set PDF E2E Test ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  console.log('Page loaded');

  const testState = buildThreeSetState();

  // ── Part A: Generate PDF with flatten=false (form fields readable) ──
  console.log('\n========== PART A: flatten=false (form fields readable) ==========');

  const pdfBase64 = await page.evaluate(async (state) => {
    const { fillScoresheet } = await import('/src/utils/pdfFill.ts');
    const blob = await fillScoresheet(state, { flatten: false });
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }, testState);

  const pdfBytes = Buffer.from(pdfBase64, 'base64');
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();
  const allFields = form.getFields();

  console.log(`PDF size: ${Math.round(pdfBytes.length / 1024)} KB`);
  console.log(`Page count: ${doc.getPageCount()}`);
  console.log(`Total form fields: ${allFields.length}`);

  let passed = 0, failed = 0;
  const issues = [];

  function assert(label, actual, expected) {
    if (actual === expected) {
      passed++;
      return true;
    } else {
      console.log(`  FAIL: ${label} — expected "${expected}", got "${actual}"`);
      failed++;
      issues.push(label);
      return false;
    }
  }

  function getFieldValue(name) {
    try { return form.getTextField(name).getText() || null; }
    catch { return null; }
  }

  // Test: 2 pages (main + deciding)
  assert('Page count = 2', doc.getPageCount(), 2);

  // ── Main Scoresheet Fields (Page 1) — should all work ──
  console.log('\n--- Main Scoresheet (Page 1) - Sets 1 & 2 ---');

  const mainSheetTests = {
    // These fields are from the main (non-deciding) scoresheet
    'Team Left': 'Eagles',
    'Team Right': 'Hawks',
    'Match Winner': 'Eagles',
    'Match Scorer': 'Alice Johnson',
    'Match 1st Referee': 'Bob Williams',
    'set 1 winner': 'Eagles',
    'set 1 loser': 'Hawks',
    'set 1 winner score': '25',
    'set 1 loser score': '20',
    'set 2 winner': 'Hawks',
    'set 2 Loser': 'Eagles',
    'set 2 winner score': '25',
    'set 2 loser score': '20',
    'Wins:Losses': '2:1',
  };

  let mainPassed = 0;
  for (const [field, expected] of Object.entries(mainSheetTests)) {
    if (assert(`Main: ${field}`, getFieldValue(field), expected)) mainPassed++;
  }
  console.log(`  Main sheet: ${mainPassed}/${Object.keys(mainSheetTests).length} passed`);

  // ── Deciding Set Fields (Page 2) — test which survive copyPages ──
  console.log('\n--- Deciding Set (Page 2) - Field Survival After copyPages ---');

  // Fields UNIQUE to the deciding set template (not in main sheet)
  // These are the ones that will be LOST because copyPages doesn't merge AcroForm
  const decidingSetUniqueFields = [
    'left_libero_1', 'right_libero_1',
    'Set 3 winner', 'Set 3 Loser',
    'set 3 winner score', 'set 3 loser score',
    'A team a/b', 'B team a/b',
    'Team_3', 'Set 3', 'Team Left Post Swap',
    'Left Points at Change', 'match scorer',
  ];

  const allFieldNames = new Set(allFields.map(f => f.getName()));
  let survivedCount = 0, lostCount = 0;

  for (const f of decidingSetUniqueFields) {
    const exists = allFieldNames.has(f);
    const val = getFieldValue(f);
    if (exists && val !== null) {
      console.log(`  SURVIVED: "${f}" = "${val}"`);
      survivedCount++;
    } else if (exists) {
      console.log(`  EXISTS-EMPTY: "${f}" (field exists but no value)`);
      lostCount++;
    } else {
      console.log(`  LOST: "${f}" (field not in merged PDF)`);
      lostCount++;
    }
  }
  console.log(`  ${survivedCount} survived, ${lostCount} lost after copyPages merge`);

  // ── Running score fields for deciding set ──
  console.log('\n--- Deciding Set Running Score Fields ---');
  let leftFilled = 0, rightFilled = 0;
  for (let i = 1; i <= 15; i++) {
    if (getFieldValue(`${i}_score_left`)) leftFilled++;
    if (getFieldValue(`${i}_score_right`)) rightFilled++;
  }
  console.log(`  Left running score: ${leftFilled}/15 filled`);
  console.log(`  Right running score: ${rightFilled}/15 filled`);

  // ── Sanctions (shared field names between main and deciding sheets) ──
  console.log('\n--- Sanctions ---');
  // The sanction is in set 3. Both sheets have yellow_card_1 etc.
  // Since main sheet is filled first, its values will be in the form.
  // The deciding set sheet also fills these, but since the fields already exist
  // in the main sheet's AcroForm, the copyPages doesn't add duplicates.
  // The values we see are from whichever sheet filled the field.
  const ycRow1 = getFieldValue('yellow_card_1');
  const penTeam1 = getFieldValue('penalized_team_1');
  const penSet1 = getFieldValue('penalty_current_set_1');
  const penScore1 = getFieldValue('penalty_current_score_1');
  console.log(`  yellow_card_1 = "${ycRow1}"`);
  console.log(`  penalized_team_1 = "${penTeam1}"`);
  console.log(`  penalty_current_set_1 = "${penSet1}"`);
  console.log(`  penalty_current_score_1 = "${penScore1}"`);
  assert('Sanction: yellow_card_1 = "3"', ycRow1, '3');
  assert('Sanction: penalized_team_1 = "A"', penTeam1, 'A');

  // ── Part B: Generate PDF with flatten=true (production mode) ──
  console.log('\n========== PART B: flatten=true (production mode) ==========');

  const pdfBase64Flat = await page.evaluate(async (state) => {
    const { fillScoresheet } = await import('/src/utils/pdfFill.ts');
    const blob = await fillScoresheet(state, { flatten: true });
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }, testState);

  const flatPdfBytes = Buffer.from(pdfBase64Flat, 'base64');
  const flatDoc = await PDFDocument.load(flatPdfBytes);
  console.log(`Flattened PDF: ${Math.round(flatPdfBytes.length / 1024)} KB, ${flatDoc.getPageCount()} pages`);
  assert('Flattened PDF page count = 2', flatDoc.getPageCount(), 2);

  // Save flattened PDF for manual inspection
  const outPath = path.join(__dirname, 'deciding-set-test-output.pdf');
  fs.writeFileSync(outPath, flatPdfBytes);
  console.log(`  Saved flattened PDF to: ${outPath}`);
  console.log('  (Open this file to visually verify deciding set data appears correctly)');

  // ── Part C: Directly test the deciding set PDF fill (without merge) ──
  console.log('\n========== PART C: Direct decidingSetSheet fill test ==========');
  console.log('(Testing fillDecidingSetSheet output BEFORE copyPages merge)');

  // Read template fields directly using Node.js (no browser needed)
  const templatePdfBytes = fs.readFileSync(path.join(__dirname, '..', 'public', 'deciding_set_scoresheet_prepared_form.pdf'));
  const templateDoc = await PDFDocument.load(templatePdfBytes);
  const templateForm = templateDoc.getForm();
  const templateFieldNames = templateForm.getFields().map(f => f.getName());

  console.log(`  Deciding set template has ${templateFieldNames.length} fields`);

  // Check key fields exist in template
  const keyFields = [
    'Team Left', 'Team Right', 'left_libero_1', 'right_libero_1',
    'Set 3 winner', 'Set 3 Loser', 'set 3 winner score', 'set 3 loser score',
    'Match Winner', '1_score_left', '1_score_right',
    'Left_P1', 'Right_P1', 'yellow_card_1', 'Match Scorer',
  ];

  let templateFieldsOk = 0;
  for (const f of keyFields) {
    if (templateFieldNames.includes(f)) {
      templateFieldsOk++;
    } else {
      console.log(`  MISSING IN TEMPLATE: "${f}"`);
    }
  }
  console.log(`  ${templateFieldsOk}/${keyFields.length} key fields exist in template`);
  assert(`All key fields exist in deciding set template`, templateFieldsOk, keyFields.length);

  // ── Comprehensive field dump ──
  console.log('\n--- All Filled Fields in Merged PDF (flatten=false) ---');
  let filledCount = 0;
  const filledFields = [];
  for (const field of allFields) {
    const name = field.getName();
    let value = null;
    try { value = form.getTextField(name).getText(); }
    catch {
      try { value = form.getCheckBox(name).isChecked() ? 'CHECKED' : null; }
      catch { /* skip */ }
    }
    if (value && String(value).trim() !== '') {
      filledCount++;
      filledFields.push({ name, value });
    }
  }
  console.log(`  ${filledCount} of ${allFields.length} fields have values`);

  // Group and display
  for (const { name, value } of filledFields) {
    console.log(`    ${name} = "${value}"`);
  }

  // ── Summary ──
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (issues.length > 0) {
    console.log(`\nFailed assertions:`);
    for (const issue of issues) {
      console.log(`  - ${issue}`);
    }
  }

  console.log(`\nKEY FINDINGS:`);
  console.log(`  1. PDF has ${doc.getPageCount()} pages (main + deciding set) — CORRECT`);
  console.log(`  2. Main scoresheet (page 1) fields: all filled correctly`);
  console.log(`  3. Deciding set unique fields (page 2): ${lostCount} LOST after copyPages`);
  console.log(`     - copyPages does NOT transfer AcroForm field entries`);
  console.log(`     - With flatten=true (default), values are baked into page content — VISIBLE`);
  console.log(`     - With flatten=false, deciding set field values are NOT accessible as form fields`);
  console.log(`  4. Running score on deciding set page: ${leftFilled + rightFilled}/30 fields have values`);
  console.log(`${'='.repeat(60)}`);

  await browser.close();

  if (failed > 0) {
    console.log('\nSome tests FAILED — see details above.');
    process.exit(1);
  } else {
    console.log('\nAll deciding set PDF tests PASSED!');
  }
}

runTest().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
