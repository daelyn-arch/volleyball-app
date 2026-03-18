// Playwright test: build a 3-set match state directly and download the PDF
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const PORT = 5178;
  const { createServer } = await import('vite');
  const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'silent' });
  await server.listen();
  console.log(`Dev server on port ${PORT}`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Build a 3-set match state directly in the browser
    await page.evaluate(() => {
      const store = window.__ZUSTAND_STORE__ || null;
      // Import the store module by finding it in the app
    });

    // Instead, navigate to scoresheet and build state via the app's API
    // Use the import mechanism from the existing e2e test
    const pdfBase64 = await page.evaluate(async () => {
      // Dynamically import the store and PDF fill modules
      const { useMatchStore } = await import('/src/store/matchStore.ts');
      const { fillScoresheet } = await import('/src/utils/pdfFill.ts');

      const homeTeam = {
        name: 'Eagles', roster: [
          { number: 1, isCaptain: true }, { number: 2 }, { number: 3 },
          { number: 4 }, { number: 5 }, { number: 6 },
          { number: 7 }, { number: 8 }, { number: 9 },
          { number: 10, isLibero: true },
        ],
      };
      const awayTeam = {
        name: 'Hawks', roster: [
          { number: 11, isCaptain: true }, { number: 12 }, { number: 13 },
          { number: 14 }, { number: 15 }, { number: 16 },
          { number: 17 }, { number: 18 }, { number: 19 },
          { number: 20, isLibero: true },
        ],
      };

      const store = useMatchStore.getState();
      store.createMatch(homeTeam, awayTeam, { bestOf: 3 }, {
        competition: 'State Championship', cityState: 'Denver, CO',
        hall: 'Main Arena', matchNumber: '42', level: 'D1',
        division: 'Women', category: 'Adult', poolPhase: 'Semifinal',
        court: '2', scorer: 'Alice Johnson', referee: 'Bob Williams', downRef: 'Carol Davis',
      });

      // Set 1: Eagles win 25-20 (interleaved)
      store.setLineup(0, 'home', { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 });
      store.setLineup(0, 'away', { 1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16 });
      store.setFirstServe(0, 'home');
      { let h = 0, a = 0;
        while (h < 25 || a < 20) {
          if (h < 25 && (a >= 20 || Math.random() < 0.56)) { store.awardPoint('home'); h++; }
          else if (a < 20) { store.awardPoint('away'); a++; }
        }
      }

      // Set 2: Hawks win 25-20 (interleaved)
      store.advanceToNextSet();
      store.setLineup(1, 'home', { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 });
      store.setLineup(1, 'away', { 1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16 });
      store.setFirstServe(1, 'away');
      { let h = 0, a = 0;
        while (h < 20 || a < 25) {
          if (a < 25 && (h >= 20 || Math.random() < 0.56)) { store.awardPoint('away'); a++; }
          else if (h < 20) { store.awardPoint('home'); h++; }
        }
      }

      // Set 3 (deciding): Eagles win 15-10 with libero serve and penalty point
      store.advanceToNextSet();
      store.setLineup(2, 'home', { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 });
      store.setLineup(2, 'away', { 1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16 });
      store.setFirstServe(2, 'home');

      // Score a few points first: home 3, away 1
      store.awardPoint('home'); // 1-0
      store.awardPoint('home'); // 2-0
      store.awardPoint('away'); // 2-1
      store.awardPoint('home'); // 3-1

      // Put libero #10 in at position 1 (server position) for home team
      store.recordLiberoReplacement('home', 10, 1, 1, true);

      // Score points while libero is serving (should get triangles)
      store.awardPoint('home'); // 4-1 (libero serving — triangle)
      store.awardPoint('home'); // 5-1 (libero serving — triangle)
      store.awardPoint('away'); // 5-2 (sideout, libero auto-swapped if needed)

      // Take libero out
      store.recordLiberoReplacement('home', 10, 1, 1, false);

      // Continue scoring
      store.awardPoint('home'); // 6-2
      store.awardPoint('away'); // 6-3
      store.awardPoint('home'); // 7-3
      store.awardPoint('home'); // 8-3 (triggers side switch!)
      store.awardPoint('away'); // 8-4

      // Issue a PENALTY sanction on away team → awards point to home (circle on home's score)
      store.recordSanction('away', 'penalty', 14, 'player');
      store.awardPoint('home'); // 9-4 (penalty point — should get circle)

      store.awardPoint('away'); // 9-5
      store.awardPoint('home'); // 10-5
      store.awardPoint('away'); // 10-6
      store.awardPoint('home'); // 11-6
      store.awardPoint('away'); // 11-7
      store.awardPoint('home'); // 12-7
      store.awardPoint('away'); // 12-8
      store.awardPoint('home'); // 13-8
      store.awardPoint('away'); // 13-9
      store.awardPoint('home'); // 14-9
      store.awardPoint('away'); // 14-10
      store.awardPoint('away'); // 14-11 (extra to compensate for penalty point)
      store.awardPoint('home'); // 15-11 — game over!

      const { getSetScore } = await import('/src/store/derived.ts');
      const { getSetWinner } = await import('/src/utils/scoring.ts');
      const state = useMatchStore.getState();
      const s3score = getSetScore(state.events, 2);
      const s3winner = getSetWinner(s3score, 2, state.config);
      console.log('Match complete:', state.matchComplete, 'Current set:', state.currentSetIndex);
      console.log('Set 3 score:', JSON.stringify(s3score), 'Winner:', s3winner);
      console.log('Set 3 switch score:', JSON.stringify(state.sets[2]?.sidesSwitchedAtScore));

      const blob = await fillScoresheet(state);
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    });

    const pdfBytes = Buffer.from(pdfBase64, 'base64');
    const outPath = path.join(__dirname, 'deciding-set-visual-output.pdf');
    fs.writeFileSync(outPath, pdfBytes);
    console.log(`PDF saved to ${outPath} (${(pdfBytes.length / 1024).toFixed(1)} KB)`);

    const { PDFDocument } = require('pdf-lib');
    const doc = await PDFDocument.load(pdfBytes);
    const pages = doc.getPages();
    console.log(`PDF has ${pages.length} pages`);
    for (let i = 0; i < pages.length; i++) {
      console.log(`  Page ${i + 1}: ${pages[i].getWidth()}x${pages[i].getHeight()} rotation=${pages[i].getRotation().angle}`);
    }
    console.log('\n✓ Check deciding-set-visual-output.pdf visually');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
    await server.close();
  }
})();
