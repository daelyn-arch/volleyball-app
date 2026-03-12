// Playwright e2e test: verify sanctions section of the PDF is correctly filled
const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');

// Build a mock MatchState with various sanction types
function buildTestState() {
  return {
    id: 'test-match-1',
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
      // Initial points to build a score
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

      // Sanction 1: delay warning on home team (set 1, score 1:1)
      {
        type: 'sanction', id: 's1', timestamp: Date.now(), setIndex: 0,
        team: 'home', sanctionType: 'delay-warning',
        homeScore: 1, awayScore: 1,
      },

      // Sanction 2: player warning on away team, player #11 (set 1, score 1:1)
      {
        type: 'sanction', id: 's2', timestamp: Date.now(), setIndex: 0,
        team: 'away', sanctionType: 'warning', sanctionRecipient: 'player',
        playerNumber: 11, homeScore: 1, awayScore: 1,
      },

      // Sanction 3: coach penalty on home team (set 1, score 1:1)
      {
        type: 'sanction', id: 's3', timestamp: Date.now(), setIndex: 0,
        team: 'home', sanctionType: 'penalty', sanctionRecipient: 'coach',
        homeScore: 1, awayScore: 1,
      },
      { type: 'point', id: 'p3', timestamp: Date.now(), setIndex: 0,
        scoringTeam: 'away', servingTeam: 'away', serverNumber: 10,
        homeScore: 1, awayScore: 2, },

      // Sanction 4: asst coach expulsion on away team (set 1, score 1:2)
      {
        type: 'sanction', id: 's4', timestamp: Date.now(), setIndex: 0,
        team: 'away', sanctionType: 'expulsion', sanctionRecipient: 'asstCoach',
        homeScore: 1, awayScore: 2,
      },
      { type: 'point', id: 'p4', timestamp: Date.now(), setIndex: 0,
        scoringTeam: 'home', servingTeam: 'away', serverNumber: 10,
        homeScore: 2, awayScore: 2, },

      // Sanction 5: trainer disqualification on home team (set 1, score 2:2)
      {
        type: 'sanction', id: 's5', timestamp: Date.now(), setIndex: 0,
        team: 'home', sanctionType: 'disqualification', sanctionRecipient: 'trainer',
        homeScore: 2, awayScore: 2,
      },
      { type: 'point', id: 'p5', timestamp: Date.now(), setIndex: 0,
        scoringTeam: 'away', servingTeam: 'away', serverNumber: 10,
        homeScore: 2, awayScore: 3, },
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

// Expected values per sanction row — uses YOUR field names:
// yellow_card, red_card, Expulsion, Disqualified, penalized_team, penalty_current_set, penalty_current_score
const EXPECTED = [
  // Row 1: delay warning, home (A), set 1, score 1:1
  {
    yellow_card: 'D', red_card: null, Expulsion: null, Disqualified: null,
    penalized_team: 'A', penalty_current_set: '1', penalty_current_score: '1:1',
  },
  // Row 2: player warning (#), away (B), set 1, score 1:1
  {
    yellow_card: '11', red_card: null, Expulsion: null, Disqualified: null,
    penalized_team: 'B', penalty_current_set: '1', penalty_current_score: '1:1',
  },
  // Row 3: coach penalty (C), home (A), set 1, score 1:1
  {
    yellow_card: null, red_card: 'C', Expulsion: null, Disqualified: null,
    penalized_team: 'A', penalty_current_set: '1', penalty_current_score: '1:1',
  },
  // Row 4: asst coach expulsion (A), away (B), set 1, score 1:2
  {
    yellow_card: null, red_card: null, Expulsion: 'A', Disqualified: null,
    penalized_team: 'B', penalty_current_set: '1', penalty_current_score: '1:2',
  },
  // Row 5: trainer disqualification (T), home (A), set 1, score 2:2
  {
    yellow_card: null, red_card: null, Expulsion: null, Disqualified: 'T',
    penalized_team: 'A', penalty_current_set: '1', penalty_current_score: '2:2',
  },
];

async function runTest() {
  console.log('Starting Playwright sanctions PDF test...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  console.log('Page loaded');

  const testState = buildTestState();
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

  console.log('PDF generated, size:', Math.round(pdfBase64.length * 0.75 / 1024), 'KB');

  const pdfBytes = Buffer.from(pdfBase64, 'base64');
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();

  function getFieldValue(name) {
    try {
      return form.getTextField(name).getText() || null;
    } catch {
      return null;
    }
  }

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < EXPECTED.length; i++) {
    const row = i + 1;
    const expected = EXPECTED[i];
    console.log(`\n--- Row ${row} ---`);

    for (const [colBase, expectedValue] of Object.entries(expected)) {
      const fieldName = `${colBase}_${row}`;
      const actual = getFieldValue(fieldName);

      if (expectedValue === null) {
        if (actual === null || actual === '' || actual === undefined) {
          passed++;
        } else {
          console.log(`  FAIL: ${fieldName} expected empty, got "${actual}"`);
          failed++;
        }
      } else {
        if (actual === expectedValue) {
          console.log(`  PASS: ${fieldName} = "${actual}"`);
          passed++;
        } else {
          console.log(`  FAIL: ${fieldName} expected "${expectedValue}", got "${actual}"`);
          failed++;
        }
      }
    }
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(40)}`);

  await browser.close();

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\nAll sanctions PDF tests PASSED!');
  }
}

runTest().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
