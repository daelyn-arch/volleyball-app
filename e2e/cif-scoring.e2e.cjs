// Playwright e2e test: CIF scoresheet flow
// Tests: scoresheet type selection, scoring page with CIF match, CIF scoresheet view,
//        running score marks, navigation
const { chromium } = require('playwright');

function buildTestState() {
  return {
    id: 'test-cif-1',
    createdAt: Date.now(),
    scoresheetType: 'cif',
    homeTeam: {
      name: 'Eagles',
      roster: [
        { number: 1 }, { number: 2 }, { number: 3 },
        { number: 4 }, { number: 5 }, { number: 6 },
        { number: 7 }, { number: 8 },
        { number: 10, isLibero: true },
      ],
    },
    awayTeam: {
      name: 'Hawks',
      roster: [
        { number: 11 }, { number: 12 }, { number: 13 },
        { number: 14 }, { number: 15 }, { number: 16 },
        { number: 17 },
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
        firstServe: 'home',
        homeBenchSide: 'left',
        startTime: Date.now(),
        endTime: null,
        sidesSwitchedAtScore: null,
      },
      {
        homeLineup: null, awayLineup: null, firstServe: null,
        homeBenchSide: 'right', startTime: null, endTime: null,
        sidesSwitchedAtScore: null,
      },
      {
        homeLineup: null, awayLineup: null, firstServe: null,
        homeBenchSide: 'left', startTime: null, endTime: null,
        sidesSwitchedAtScore: null,
      },
    ],
    events: [
      // Home serves, Home scores (served point)
      { type: 'point', id: 'p1', timestamp: Date.now(), setIndex: 0,
        scoringTeam: 'home', servingTeam: 'home', serverNumber: 1,
        homeScore: 1, awayScore: 0 },
      // Home serves, Home scores again
      { type: 'point', id: 'p2', timestamp: Date.now(), setIndex: 0,
        scoringTeam: 'home', servingTeam: 'home', serverNumber: 1,
        homeScore: 2, awayScore: 0 },
      // Home serves, Away scores (sideout)
      { type: 'point', id: 'p3', timestamp: Date.now(), setIndex: 0,
        scoringTeam: 'away', servingTeam: 'home', serverNumber: 1,
        homeScore: 2, awayScore: 1 },
      // Away serves, Away scores
      { type: 'point', id: 'p4', timestamp: Date.now(), setIndex: 0,
        scoringTeam: 'away', servingTeam: 'away', serverNumber: 12,
        homeScore: 2, awayScore: 2 },
      // Away serves, Home scores (sideout)
      { type: 'point', id: 'p5', timestamp: Date.now(), setIndex: 0,
        scoringTeam: 'home', servingTeam: 'away', serverNumber: 12,
        homeScore: 3, awayScore: 2 },
      // Sub: home team subs #7 for #3
      { type: 'substitution', id: 's1', timestamp: Date.now(), setIndex: 0,
        team: 'home', playerIn: 7, playerOut: 3,
        homeScore: 3, awayScore: 2, subNumber: 1 },
      // Home serves, Home scores
      { type: 'point', id: 'p6', timestamp: Date.now(), setIndex: 0,
        scoringTeam: 'home', servingTeam: 'home', serverNumber: 2,
        homeScore: 4, awayScore: 2 },
      // Timeout: away team
      { type: 'timeout', id: 't1', timestamp: Date.now(), setIndex: 0,
        team: 'away', homeScore: 4, awayScore: 2, timeoutNumber: 1 },
      // Home serves, Away scores (sideout)
      { type: 'point', id: 'p7', timestamp: Date.now(), setIndex: 0,
        scoringTeam: 'away', servingTeam: 'home', serverNumber: 2,
        homeScore: 4, awayScore: 3 },
    ],
    currentSetIndex: 0,
    matchComplete: false,
    metadata: {
      competition: '', cityState: '', hall: '', matchNumber: '',
      level: '', division: '', category: '', poolPhase: '',
      court: '', scorer: '', referee: '', downRef: '', workTeam: '', region: '',
    },
    liberoServingPositions: {},
    remarks: [],
    syncedAt: null,
  };
}

async function runTest() {
  console.log('Starting CIF scoresheet e2e tests...\n');

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

  // ============================================================
  // TEST 1: Scoresheet Type Selection Page
  // ============================================================
  console.log('\n=== Test 1: Scoresheet Type Selection ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5173/#/scoresheet-type');
    await page.waitForLoadState('networkidle');

    const usavBtn = page.locator('button', { hasText: 'USAV' });
    const cifBtn = page.locator('button', { hasText: 'CIF' });

    check('USAV button visible', await usavBtn.isVisible());
    check('CIF button visible', await cifBtn.isVisible());

    // Click CIF and verify it navigates to setup
    await cifBtn.click();
    await page.waitForURL('**/#/setup');
    check('CIF click navigates to /setup', page.url().includes('/setup'));

    await ctx.close();
  }

  // ============================================================
  // TEST 2: Scoring page works with CIF match data
  // ============================================================
  console.log('\n=== Test 2: Scoring Page with CIF match ===');
  {
    const state = buildTestState();
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();
    await ctx.addInitScript((s) => {
      localStorage.setItem('volleyball-match-storage', JSON.stringify({ state: s, version: 0 }));
    }, state);
    await page.goto('http://localhost:5173/#/scoring');
    await page.waitForLoadState('networkidle');

    // Score display
    const scoreText = await page.locator('body').innerText();
    check('Shows home team name', scoreText.includes('Eagles'));
    check('Shows away team name', scoreText.includes('Hawks'));

    // Point buttons
    const homePlusBtn = page.locator('button', { hasText: '+ Eagles' });
    const awayPlusBtn = page.locator('button', { hasText: '+ Hawks' });
    check('Home point button visible', await homePlusBtn.isVisible());
    check('Away point button visible', await awayPlusBtn.isVisible());

    // Scoresheet button
    const scoresheetBtn = page.locator('button', { hasText: 'Scoresheet' }).first();
    check('Scoresheet button visible', await scoresheetBtn.isVisible());

    await ctx.close();
  }

  // ============================================================
  // TEST 3: Scoring from scoring page works with CIF match
  // ============================================================
  console.log('\n=== Test 3: Live scoring with CIF match ===');
  {
    const state = buildTestState();
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();
    await ctx.addInitScript((s) => {
      localStorage.setItem('volleyball-match-storage', JSON.stringify({ state: s, version: 0 }));
    }, state);
    await page.goto('http://localhost:5173/#/scoring');
    await page.waitForLoadState('networkidle');

    // Click home point button
    await page.locator('button', { hasText: '+ Eagles' }).click();
    await page.waitForTimeout(200);

    // Verify scoresheetType is still cif after scoring
    const typeAfterScoring = await page.evaluate(() => {
      const raw = localStorage.getItem('volleyball-match-storage');
      return JSON.parse(raw).state?.scoresheetType;
    });
    check('scoresheetType still "cif" after scoring', typeAfterScoring === 'cif');

    await ctx.close();
  }

  // ============================================================
  // TEST 4: CIF Scoresheet View Page
  // ============================================================
  console.log('\n=== Test 4: CIF Scoresheet View Page ===');
  {
    const state = buildTestState();
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();
    await ctx.addInitScript((s) => {
      localStorage.setItem('volleyball-match-storage', JSON.stringify({ state: s, version: 0 }));
    }, state);
    await page.goto('http://localhost:5173/#/cif-scoresheet');
    await page.waitForLoadState('networkidle');

    // Header
    const headerText = await page.locator('body').innerText();
    check('View page shows "CIF Scoresheet" title', headerText.includes('CIF Scoresheet'));

    // PDF button
    const pdfBtn = page.locator('button', { hasText: 'PDF' });
    check('PDF button visible', await pdfBtn.isVisible());

    // Back button
    const backBtn = page.locator('button', { hasText: 'Back' });
    check('Back button visible', await backBtn.isVisible());

    // CIF sheet content
    const sheet = page.locator('.bg-white.rounded-lg');
    check('CIF sheet rendered in view page', await sheet.isVisible());

    // Navigate back — should go to /scoresheet (NOT /cif-scoring)
    await backBtn.click();
    await page.waitForURL('**/#/scoresheet');
    check('Back navigates to /scoresheet', page.url().includes('/scoresheet') && !page.url().includes('cif-scoresheet'));

    await ctx.close();
  }

  // ============================================================
  // TEST 5: Navigation flow (New Match → Type → Setup)
  // ============================================================
  console.log('\n=== Test 5: Full navigation flow ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    // Clear any existing match state
    await ctx.addInitScript(() => {
      localStorage.removeItem('volleyball-match-storage');
    });
    await page.goto('http://localhost:5173/#/');
    await page.waitForLoadState('networkidle');

    // Click New Match
    const newMatchBtn = page.locator('button', { hasText: 'New Match' });
    check('New Match button visible', await newMatchBtn.isVisible());
    await newMatchBtn.click();
    await page.waitForURL('**/#/scoresheet-type');
    check('New Match navigates to /scoresheet-type', page.url().includes('/scoresheet-type'));

    // Choose CIF
    await page.locator('button', { hasText: 'CIF' }).click();
    await page.waitForURL('**/#/setup');
    check('CIF selection navigates to /setup', page.url().includes('/setup'));

    // Back button goes to scoresheet type
    await page.locator('button', { hasText: '←' }).click();
    await page.waitForURL('**/#/scoresheet-type');
    check('Setup back button goes to /scoresheet-type', page.url().includes('/scoresheet-type'));

    // Back to home
    await page.locator('button', { hasText: '←' }).click();
    await page.waitForTimeout(500);
    check('Type page back button goes to home', page.url().endsWith('#/'));

    await ctx.close();
  }

  // ============================================================
  // TEST 6: Resume CIF match goes to /scoring (same as USAV)
  // ============================================================
  console.log('\n=== Test 6: Resume CIF match routing ===');
  {
    const state = buildTestState();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await ctx.addInitScript((s) => {
      localStorage.setItem('volleyball-match-storage', JSON.stringify({ state: s, version: 0 }));
    }, state);
    await page.goto('http://localhost:5173/#/');
    await page.waitForLoadState('networkidle');

    const resumeBtn = page.locator('button', { hasText: 'Resume Match' });
    check('Resume Match button visible', await resumeBtn.isVisible());
    await resumeBtn.click();
    await page.waitForURL('**/#/scoring');
    check('Resume navigates to /scoring for CIF match', page.url().includes('/scoring'));

    await ctx.close();
  }

  // ============================================================
  // TEST 7: USAV match also resumes to /scoring
  // ============================================================
  console.log('\n=== Test 7: USAV resume routing ===');
  {
    const state = buildTestState();
    state.scoresheetType = 'usav';
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await ctx.addInitScript((s) => {
      localStorage.setItem('volleyball-match-storage', JSON.stringify({ state: s, version: 0 }));
    }, state);
    await page.goto('http://localhost:5173/#/');
    await page.waitForLoadState('networkidle');

    const resumeBtn = page.locator('button', { hasText: 'Resume Match' });
    await resumeBtn.click();
    await page.waitForURL('**/#/scoring');
    check('USAV resume goes to /scoring', page.url().includes('/scoring'));

    await ctx.close();
  }

  // ============================================================
  // TEST 8: Scoresheet view shows CIF PDF button for CIF match
  // ============================================================
  console.log('\n=== Test 8: Scoresheet view CIF PDF button ===');
  {
    const state = buildTestState();
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();
    await ctx.addInitScript((s) => {
      localStorage.setItem('volleyball-match-storage', JSON.stringify({ state: s, version: 0 }));
    }, state);
    await page.goto('http://localhost:5173/#/scoresheet');
    await page.waitForLoadState('networkidle');

    const cifPdfBtn = page.locator('button', { hasText: 'CIF Scoresheet PDF' });
    check('CIF Scoresheet PDF button visible on scoresheet page', await cifPdfBtn.isVisible());

    // Click it — should navigate to /cif-scoresheet
    await cifPdfBtn.click();
    await page.waitForURL('**/#/cif-scoresheet');
    check('CIF PDF button navigates to /cif-scoresheet', page.url().includes('/cif-scoresheet'));

    await ctx.close();
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
