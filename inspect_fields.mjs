import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

const buf = fs.readFileSync('Non-deciding-two-set-scoresheet_prepared_form.pdf');
const doc = await PDFDocument.load(buf);
const form = doc.getForm();
const fields = form.getFields();

const left = fields.filter(f => f.getName().match(/^[Ll]eft/)).map(f => f.getName()).sort();
const other = fields.filter(f => {
  const n = f.getName();
  return !n.match(/^[Ll]eft/) && !n.match(/^left/);
}).map(f => f.getName());

console.log('=== LEFT TEAM SET 1 ===');

const lineup = left.filter(n => /^Left_P\d/.test(n));
const runningScore = left.filter(n => /^Left_\d+$/.test(n));
const serviceRounds = left.filter(n => /service_round/.test(n));
const subEntries = left.filter(n => /sub/.test(n) && !/score/.test(n) && !/^Left_sub_\d+$/.test(n));
const subScores = left.filter(n => /sub.*score/.test(n));
const subCount = left.filter(n => /^Left_sub_\d+$/.test(n));
const timeouts = left.filter(n => /timeout/.test(n));
const liberos = left.filter(n => /Libero/.test(n));
const others = left.filter(n => /^(Left_CAPTAIN|Team Left|Start_Time|End_Time)/.test(n));

const cats = [
  ['Lineup (P1-P6)', lineup],
  ['Running Score', runningScore],
  ['Service Rounds', serviceRounds],
  ['Sub Entries', subEntries],
  ['Sub Scores', subScores],
  ['Sub Count Boxes', subCount],
  ['Timeouts', timeouts],
  ['Liberos', liberos],
  ['Other Left', others],
];

for (const [cat, names] of cats) {
  console.log('\n' + cat + ' (' + names.length + '):');
  names.forEach(n => console.log('  ' + n));
}

console.log('\n=== MATCH METADATA (' + other.length + ') ===');
other.forEach(n => console.log('  ' + n));
