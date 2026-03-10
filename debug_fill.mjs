import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

// Load the prepared form
const buf = fs.readFileSync('public/Non-deciding-two-set-scoresheet_prepared_form.pdf');
const doc = await PDFDocument.load(buf);
const form = doc.getForm();

console.log('Fields in public/ copy:', form.getFields().length);

// Try filling a few fields
let successes = 0;
let failures = 0;

const testFields = [
  ['Team Left', 'Eagles'],
  ['Team Right', 'Hawks'],
  ['Left_P1', '7'],
  ['Left_P2', '12'],
  ['Left_1', '5'],
  ['Left_timeout_1', '10-8'],
  ['left_1_score_service_round_1', '7'],
];

for (const [name, value] of testFields) {
  try {
    const field = form.getTextField(name);
    field.setText(value);
    successes++;
    console.log('OK: ' + name + ' = ' + value);
  } catch (e) {
    failures++;
    console.log('FAIL: ' + name + ' - ' + e.message);
  }
}

console.log('\nSuccesses:', successes, 'Failures:', failures);

// Save and check
const pdfBytes = await doc.save();
fs.writeFileSync('debug_output.pdf', pdfBytes);
console.log('\nSaved debug_output.pdf - open it to check if fields are filled');

// Also try without flatten
const doc2 = await PDFDocument.load(buf);
const form2 = doc2.getForm();
for (const [name, value] of testFields) {
  try {
    form2.getTextField(name).setText(value);
  } catch {}
}
form2.flatten();
const pdfBytes2 = await doc2.save();
fs.writeFileSync('debug_output_flattened.pdf', pdfBytes2);
console.log('Saved debug_output_flattened.pdf (with flatten)');
