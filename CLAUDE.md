# Project Instructions

## PDF Scoresheet

- The scoresheet PDF template is `public/Non-deciding-two-set-scoresheet_prepared_form.pdf`
- All form fields in the PDF are created manually using **Adobe Acrobat's Prepare Form** feature — NEVER add fields programmatically
- When new fields are needed, tell the user to add them in Adobe. Do not create fields via pdf-lib or any script.
- The `fillScoresheet()` function in `src/utils/pdfFill.ts` fills existing fields using `safeSetField()` — it should only SET values, never CREATE fields
- If a field name doesn't exist, `safeSetField` silently skips it. Check field names match the PDF exactly.
- A copy of the prepared form with the latest fields lives at the project root for reference

### Sanctions field names (5 rows)
- `yellow_card_1` through `yellow_card_5` — W (Warn) column
- `red_card_1` through `red_card_5` — P (Penalty) column
- `Expulsion_1` through `Expulsion_5` — E (Expel) column (capital E)
- `Disqualified_1` through `Disqualified_5` — D (DisQ) column (capital D)
- `penalized_team_1` through `penalized_team_5` — Team A/B column
- `penalty_current_set_1` through `penalty_current_set_5` — SET column
- `penalty_current_score_1` through `penalty_current_score_5` — SCORE column

## Tech Stack
- React 19 + Vite + TypeScript
- Zustand (persist middleware) for state management
- Tailwind CSS 4
- pdf-lib for PDF form filling (read-only — never create form fields)

## Testing
- Unit tests: `npx vitest run` (src/**/*.test.ts)
- E2e tests: `node e2e/sanctions-pdf.e2e.cjs` (Playwright, requires dev server running)
- Type check: `npx tsc --noEmit`
