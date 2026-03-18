// Playwright e2e test: verify portrait mode layout on the scoring page
const { chromium } = require('playwright');

// Build a minimal match state with a few events so the log has content
function buildTestState() {
  return {
    id: 'test-portrait-1',
    createdAt: Date.now(),
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
      bestOf: 3,
      pointsToWin: 25,
      decidingSetPoints: 15,
      maxSubsPerSet: 15,
      maxTimeoutsPerSet: 2,
    },
    sets: [
      {
        homeLineup: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 },
        awayLineup: { 1: 10, 2: 11, 3: 12, 4: 13, 5: 14, 6: 15 },
        firstServe: 'home',
        homeBenchSide: 'left',
        startTime: Date.now(),
        endTime: null,
      },
      {
        homeLineup: null, awayLineup: null, firstServe: null,
        homeBenchSide: 'right', startTime: null, endTime: null,
      },
      {
        homeLineup: null, awayLineup: null, firstServe: null,
        homeBenchSide: 'left', startTime: null, endTime: null,
      },
    ],
    events: [
      {
        type: 'point', id: 'p1', timestamp: Date.now(), setIndex: 0,
        scoringTeam: 'home', servingTeam: 'home', serverNumber: 1,
        homeScore: 1, awayScore: 0,
      },
      {
        type: 'point', id: 'p2', timestamp: Date.now(), setIndex: 0,
        scoringTeam: 'away', servingTeam: 'home', serverNumber: 1,
        homeScore: 1, awayScore: 1,
      },
      {
        type: 'point', id: 'p3', timestamp: Date.now(), setIndex: 0,
        scoringTeam: 'home', servingTeam: 'away', serverNumber: 10,
        homeScore: 2, awayScore: 1,
      },
    ],
    currentSetIndex: 0,
    matchComplete: false,
    metadata: {
      competition: '', cityState: '', hall: '', matchNumber: '',
      level: '', division: '', category: '', poolPhase: '',
      court: '', scorer: '', referee: '', downRef: '',
    },
    liberoServingPositions: {},
    remarks: [],
  };
}

async function runTest() {
  console.log('Starting Playwright portrait mode test...\n');

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

  // --- PORTRAIT MODE (e.g. phone held upright: 390x844) ---
  console.log('\n=== Portrait Mode (390x844) ===');
  const portraitContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const portraitPage = await portraitContext.newPage();
  // Set localStorage before first navigation so Zustand picks it up
  await portraitContext.addInitScript((state) => {
    localStorage.setItem('volleyball-match-storage', JSON.stringify({ state, version: 0 }));
  }, buildTestState());
  await portraitPage.goto('http://192.168.1.30:5173/', { waitUntil: 'networkidle' });
  // Click Resume Match to navigate to scoring
  await portraitPage.locator('button', { hasText: 'Resume Match' }).click();
  await portraitPage.waitForSelector('[data-name="home-rotation-grid"]', { timeout: 5000 });

  // 1. No event log on scoring page at all
  const logEntries = await portraitPage.locator('.overflow-y-auto .text-lg.text-white').count();
  check('No event log on scoring page', logEntries === 0);

  // 2. Action buttons (Ref, Subs) should be visible
  const refBtn = portraitPage.locator('[data-name="ref-btn"]');
  check('Ref button is visible', await refBtn.isVisible());

  // 3. Scoresheet button should be visible and full width
  const scoresheetBtn = portraitPage.locator('[data-name="scoresheet-btn"]');
  check('Scoresheet button is visible', await scoresheetBtn.isVisible());

  // 4. Rotation cells should exist and be rendered
  const frontRow = portraitPage.locator('[data-name="home-front-row"]');
  check('Home front row is visible', await frontRow.isVisible());
  const backRow = portraitPage.locator('[data-name="home-back-row"]');
  check('Home back row is visible', await backRow.isVisible());

  // 5. Rotation grid should use significant vertical space
  const rotGrid = portraitPage.locator('[data-name="home-rotation-grid"]');
  const gridBox = await rotGrid.boundingBox();
  console.log('  INFO: rotation grid height =', gridBox?.height);
  check('Rotation grid has significant height (>150px)', gridBox && gridBox.height > 150);

  // 6. Point buttons should be taller
  const plusBtn = portraitPage.locator('[data-name="home-plus-btn"]');
  const plusBox = await plusBtn.boundingBox();
  console.log('  INFO: +button height =', plusBox?.height);
  check('Point button has significant height (>60px)', plusBox && plusBox.height > 60);

  // 7. Panel should fill most of viewport height
  const panel = portraitPage.locator('[data-name="home-panel"]');
  const panelBox = await panel.boundingBox();
  console.log('  INFO: panel height =', panelBox?.height, 'viewport =', 844);
  check('Panel fills significant viewport height (>400px)', panelBox && panelBox.height > 400);

  // --- MATCH LOG PAGE ---
  console.log('\n=== Match Log Page ===');
  const logContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const logPage = await logContext.newPage();
  await logContext.addInitScript((state) => {
    localStorage.setItem('volleyball-match-storage', JSON.stringify({ state, version: 0 }));
  }, buildTestState());
  await logPage.goto('http://192.168.1.30:5173/', { waitUntil: 'networkidle' });
  // Navigate to scoring first, then to scoresheet
  await logPage.locator('button', { hasText: 'Resume Match' }).click();
  await logPage.waitForSelector('[data-name="scoresheet-btn"]', { timeout: 5000 });
  await logPage.locator('[data-name="scoresheet-btn"]').click();
  await logPage.waitForURL('**/scoresheet', { timeout: 5000 });

  // 8. Match Log button should exist on scoresheet page
  const matchLogBtn = logPage.locator('button', { hasText: 'Match Log' });
  await matchLogBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  check('Match Log button exists on scoresheet page', await matchLogBtn.isVisible());

  // 9. Click Match Log → navigate to /match-log
  await matchLogBtn.click();
  await logPage.waitForURL('**/match-log', { timeout: 5000 });
  check('Navigated to /match-log', logPage.url().includes('/match-log'));

  // 10. Log entries should be visible on match-log page (even in portrait viewport)
  await logPage.waitForTimeout(500);
  const matchLogEntries = logPage.locator('.text-lg.text-white');
  const matchLogCount = await matchLogEntries.count();
  check('Match log entries visible on /match-log (' + matchLogCount + ')', matchLogCount > 0);

  // 11. Back button should exist
  const backBtn = logPage.locator('button', { hasText: 'Back' });
  check('Back button exists on match-log page', await backBtn.isVisible());

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(40)}`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
