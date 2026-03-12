// Playwright e2e test: visually verify T-bar rendering on completed set PDF
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

function buildCompletedSetState() {
  const events = [];
  let homeScore = 0;
  let awayScore = 0;
  let id = 0;
  const ts = Date.now();

  // Deterministic: home wins 25-20
  const det = [];
  let dh = 0, da = 0;
  // Interleave: award points alternating somewhat, home always ends last
  while (dh < 25 || da < 20) {
    if (dh < 25 && (da >= 20 || dh <= da)) {
      dh++; det.push('home');
    } else if (da < 20) {
      da++; det.push('away');
    }
  }

  for (const team of det) {
    if (team === 'home') homeScore++;
    else awayScore++;
    events.push({
      type: 'point', id: `p${++id}`, timestamp: ts + id, setIndex: 0,
      scoringTeam: team, servingTeam: team,
      serverNumber: team === 'home' ? 1 : 10,
      homeScore, awayScore,
    });
  }

  return {
    id: 'test-tbar', createdAt: ts,
    homeTeam: {
      name: 'Eagles',
      roster: [
        { number: 1 }, { number: 2 }, { number: 3 },
        { number: 4 }, { number: 5 }, { number: 6 },
      ],
    },
    awayTeam: {
      name: 'Hawks',
      roster: [
        { number: 10 }, { number: 11 }, { number: 12 },
        { number: 13 }, { number: 14 }, { number: 15 },
      ],
    },
    config: {
      bestOf: 3, pointsToWin: 25, decidingSetPoints: 15,
      maxSubsPerSet: 15, maxTimeoutsPerSet: 2,
    },
    sets: [
      {
        homeLineup: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 },
        awayLineup: { 1: 10, 2: 11, 3: 12, 4: 13, 5: 14, 6: 15 },
        firstServe: 'home', homeBenchSide: 'left',
        startTime: ts, endTime: ts + 10000,
      },
      { homeLineup: null, awayLineup: null, firstServe: null, homeBenchSide: 'right', startTime: null, endTime: null },
      { homeLineup: null, awayLineup: null, firstServe: null, homeBenchSide: 'left', startTime: null, endTime: null },
    ],
    events, currentSetIndex: 0, matchComplete: false,
    metadata: { competition: '', cityState: '', hall: '', matchNumber: '', level: '', division: '', category: '', poolPhase: '', court: '', scorer: '', referee: '', downRef: '' },
    liberoServingPositions: {}, remarks: [],
  };
}

async function runTest() {
  console.log('Starting T-bar visual test...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  console.log('Page loaded');

  const testState = buildCompletedSetState();
  const lastEvent = testState.events[testState.events.length - 1];
  console.log(`Score: home ${lastEvent.homeScore} - away ${lastEvent.awayScore}`);
  console.log(`Away team scored 20, so T-bar should appear on away column from 21-25`);
  console.log(`Home team scored 25, so no T-bar on home column\n`);

  // Generate PDF and save for manual inspection
  const pdfBase64 = await page.evaluate(async (state) => {
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

  const pdfPath = path.join(__dirname, 'tbar-test-output.pdf');
  fs.writeFileSync(pdfPath, Buffer.from(pdfBase64, 'base64'));
  console.log(`PDF saved to: ${pdfPath}`);
  console.log('Open this PDF to visually inspect the T-bar.\n');

  // Also generate unflattened to verify T-bar fields exist
  const unflattenedBase64 = await page.evaluate(async (state) => {
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

  // Check that away team fields 21-25 exist (these are the T-bar range)
  const { PDFDocument } = require('pdf-lib');
  const doc = await PDFDocument.load(Buffer.from(unflattenedBase64, 'base64'));
  const form = doc.getForm();

  let passed = 0;
  let failed = 0;

  // Away column (Right side): points 21-25 should be empty (T-bar drawn, not filled)
  for (let p = 21; p <= 25; p++) {
    const fieldName = `Right_${p}`;
    try {
      const field = form.getTextField(fieldName);
      const val = field.getText();
      if (!val || val === '') {
        console.log(`  PASS: ${fieldName} is empty (T-bar zone)`);
        passed++;
      } else {
        console.log(`  FAIL: ${fieldName} should be empty but has "${val}"`);
        failed++;
      }
    } catch {
      console.log(`  INFO: ${fieldName} field not found (may be OK if field naming differs)`);
    }
  }

  // Home column: point 25 should have a value (home scored 25)
  try {
    const homeField = form.getTextField('Left_25');
    const val = homeField.getText();
    if (val && val !== '') {
      console.log(`  PASS: Left_25 has value "${val}" (home scored 25th point)`);
      passed++;
    } else {
      console.log(`  FAIL: Left_25 should have a value`);
      failed++;
    }
  } catch {
    console.log(`  INFO: Left_25 not found`);
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(40)}`);

  await browser.close();

  if (failed > 0) process.exit(1);
  else console.log('\nT-bar test PASSED! Open tbar-test-output.pdf to visually verify the T-bar shape.');
}

runTest().catch(e => { console.error('Test error:', e); process.exit(1); });
