// Playwright e2e test: Full CIF flow end-to-end
// Simulates: New Match → CIF → Setup → Lineup → Scoring → Scoresheet → CIF view
// The scoring page is the SAME for both USAV and CIF; only the PDF button differs.
const { chromium } = require('playwright');

async function runTest() {
  console.log('Starting CIF full flow e2e test...\n');

  const browser = await chromium.launch({ headless: true });
  let passed = 0;
  let failed = 0;

  function check(label, condition) {
    if (condition) {
      console.log(`  PASS: ${label}`);
      passed++;
    } else {
      console.log(`  FAIL: ${label}`);
      failed++;
    }
  }

  let ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  let page = await ctx.newPage();

  // Clear any prior state
  await ctx.addInitScript(() => {
    localStorage.removeItem('volleyball-match-storage');
    localStorage.removeItem('volleyball-match-history');
  });

  // ============================================================
  // STEP 1: Home Page → New Match
  // ============================================================
  console.log('\n=== Step 1: Home → New Match ===');
  await page.goto('http://localhost:5173/#/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  await page.locator('button', { hasText: 'New Match' }).click();
  await page.waitForURL('**/#/scoresheet-type');
  check('Navigated to scoresheet type page', page.url().includes('scoresheet-type'));

  // ============================================================
  // STEP 2: Select CIF
  // ============================================================
  console.log('\n=== Step 2: Select CIF ===');
  await page.locator('button', { hasText: 'CIF' }).click();
  await page.waitForURL('**/#/setup');
  check('Navigated to setup page', page.url().includes('setup'));

  // Verify scoresheetType is set to 'cif' in localStorage
  const typeAfterSelect = await page.evaluate(() => {
    const raw = localStorage.getItem('volleyball-match-storage');
    if (!raw) return null;
    return JSON.parse(raw).state?.scoresheetType;
  });
  check('scoresheetType is "cif" after selection', typeAfterSelect === 'cif');

  // ============================================================
  // STEP 3: Setup — fill team names
  // ============================================================
  console.log('\n=== Step 3: Setup with team names ===');

  await page.locator('input[placeholder="Team Name"]').first().fill('Eagles');
  await page.locator('input[placeholder="Team Name"]').last().fill('Hawks');

  // Click "Set Lineups"
  await page.locator('button', { hasText: 'Set Lineups' }).click();
  await page.waitForURL('**/#/lineup/0');
  check('Navigated to lineup page', page.url().includes('lineup/0'));

  // Verify scoresheetType is STILL 'cif' after createMatch
  const typeAfterCreate = await page.evaluate(() => {
    const raw = localStorage.getItem('volleyball-match-storage');
    if (!raw) return null;
    return JSON.parse(raw).state?.scoresheetType;
  });
  check('scoresheetType is STILL "cif" after createMatch', typeAfterCreate === 'cif');

  // ============================================================
  // STEP 4: Load pre-built state and go to scoring page
  // ============================================================
  console.log('\n=== Step 4: Scoring page with CIF match ===');

  // Close old context, create new one with complete state pre-injected
  await ctx.close();

  const fullState = {
    id: 'test-cif-flow', createdAt: Date.now(), scoresheetType: 'cif',
    homeTeam: { name: 'Eagles', roster: [
      { number: 1 }, { number: 2 }, { number: 3 },
      { number: 4 }, { number: 5 }, { number: 6 },
    ]},
    awayTeam: { name: 'Hawks', roster: [
      { number: 11 }, { number: 12 }, { number: 13 },
      { number: 14 }, { number: 15 }, { number: 16 },
    ]},
    config: { bestOf: 3, pointsToWin: 25, decidingSetPoints: 15, maxSubsPerSet: 15, maxTimeoutsPerSet: 2 },
    sets: [
      { homeLineup: {1:1,2:2,3:3,4:4,5:5,6:6}, awayLineup: {1:11,2:12,3:13,4:14,5:15,6:16},
        firstServe: 'home', homeBenchSide: 'left', startTime: Date.now(), endTime: null, sidesSwitchedAtScore: null },
      { homeLineup: null, awayLineup: null, firstServe: null, homeBenchSide: 'right', startTime: null, endTime: null, sidesSwitchedAtScore: null },
      { homeLineup: null, awayLineup: null, firstServe: null, homeBenchSide: 'left', startTime: null, endTime: null, sidesSwitchedAtScore: null },
    ],
    events: [], currentSetIndex: 0, matchComplete: false,
    metadata: { competition:'',cityState:'',hall:'',matchNumber:'',level:'',division:'',category:'',poolPhase:'',court:'',scorer:'',referee:'',downRef:'',workTeam:'',region:'' },
    liberoServingPositions: {}, remarks: [], syncedAt: null,
  };

  const ctx2 = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  page = await ctx2.newPage();
  await ctx2.addInitScript((s) => {
    localStorage.setItem('volleyball-match-storage', JSON.stringify({ state: s, version: 0 }));
  }, fullState);

  // Navigate to /scoring (the ONE scoring page for all match types)
  await page.goto('http://localhost:5173/#/scoring');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  check('On /scoring page', page.url().includes('/scoring'));

  // ============================================================
  // STEP 5: Score some points
  // ============================================================
  console.log('\n=== Step 5: Score points ===');

  const homeBtn = page.locator('button', { hasText: '+ Eagles' });
  const awayBtn = page.locator('button', { hasText: '+ Hawks' });

  await homeBtn.click(); await page.waitForTimeout(150);
  await homeBtn.click(); await page.waitForTimeout(150);
  await awayBtn.click(); await page.waitForTimeout(150);
  await homeBtn.click(); await page.waitForTimeout(150);
  await awayBtn.click(); await page.waitForTimeout(150);

  // Verify scoresheetType still cif
  const typeAfterScoring = await page.evaluate(() => {
    const raw = localStorage.getItem('volleyball-match-storage');
    return JSON.parse(raw).state?.scoresheetType;
  });
  check('scoresheetType still "cif" after scoring', typeAfterScoring === 'cif');

  // ============================================================
  // STEP 6: Scoresheet → CIF Scoresheet PDF button → CIF view
  // ============================================================
  console.log('\n=== Step 6: Scoring → Scoresheet → CIF view ===');

  const scoresheetBtn = page.locator('button', { hasText: 'Scoresheet' }).first();
  await scoresheetBtn.click();
  await page.waitForTimeout(500);

  // Should be on /scoresheet (the shared scoresheet view)
  check('On /scoresheet page', page.url().includes('/scoresheet') && !page.url().includes('cif-scoresheet'));

  // Should see CIF Scoresheet PDF button (not USAV)
  const cifPdfBtn = page.locator('button', { hasText: 'CIF Scoresheet PDF' });
  check('CIF Scoresheet PDF button visible', await cifPdfBtn.isVisible());

  // Click it to go to CIF scoresheet view
  await cifPdfBtn.click();
  await page.waitForURL('**/#/cif-scoresheet');
  check('Navigated to /cif-scoresheet', page.url().includes('cif-scoresheet'));

  // Verify CIF scoresheet view page content
  const viewText = await page.locator('body').innerText();
  check('Shows "CIF Scoresheet" title', viewText.includes('CIF Scoresheet'));
  check('Has PDF button', viewText.includes('PDF'));
  check('Has Back button', viewText.includes('Back'));

  // CIF sheet content
  const cifSheetInView = page.locator('.bg-white.rounded-lg');
  check('CIF sheet rendered in view page', await cifSheetInView.count() > 0);

  await page.screenshot({ path: 'e2e/cif-flow-scoresheet-view.png' });
  console.log('  Screenshot: e2e/cif-flow-scoresheet-view.png');

  // ============================================================
  // STEP 7: Back button returns to /scoresheet (NOT /cif-scoring)
  // ============================================================
  console.log('\n=== Step 7: Back button → /scoresheet ===');

  await page.locator('button', { hasText: 'Back' }).click();
  await page.waitForURL('**/#/scoresheet');
  const backUrl = page.url();
  check('Back returns to /scoresheet', backUrl.includes('/scoresheet') && !backUrl.includes('cif-scoresheet'));

  // ============================================================
  // STEP 8: Leave button goes home
  // ============================================================
  console.log('\n=== Step 8: Leave → Home ===');

  await page.locator('button', { hasText: 'Leave' }).click();
  await page.waitForTimeout(500);
  check('Leave goes to home', page.url().endsWith('#/'));

  // ============================================================
  // STEP 9: Resume match should go to /scoring (not /cif-scoring)
  // ============================================================
  console.log('\n=== Step 9: Resume → /scoring ===');

  await page.goto('http://localhost:5173/#/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const resumeBtn = page.locator('button', { hasText: 'Resume Match' });
  if (await resumeBtn.count() > 0) {
    await resumeBtn.click();
    await page.waitForURL('**/#/scoring');
    check('Resume goes to /scoring', page.url().includes('/scoring'));
  } else {
    check('Resume Match button exists', false);
  }

  // ============================================================
  // Summary
  // ============================================================
  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`========================================`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTest().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});
