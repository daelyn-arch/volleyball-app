// Extract coordinates of all running score fields from the PDF
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function inspect() {
  const buf = fs.readFileSync('public/Non-deciding-two-set-scoresheet_prepared_form.pdf');
  const doc = await PDFDocument.load(buf);
  const form = doc.getForm();

  const sides = ['Left', 'Right'];
  const suffixes = ['', '_2']; // Set 1 and Set 2

  for (const suffix of suffixes) {
    const setLabel = suffix === '' ? 'Set 1' : 'Set 2';
    for (const side of sides) {
      console.log(`\n=== ${side} ${setLabel} ===`);
      for (let p = 1; p <= 36; p++) {
        const name = `${side}_${p}${suffix}`;
        try {
          const field = form.getTextField(name);
          const widgets = field.acroField.getWidgets();
          if (widgets.length > 0) {
            const rect = widgets[0].getRectangle();
            console.log(`${name}: x=${rect.x.toFixed(1)}, y=${rect.y.toFixed(1)}, w=${rect.width.toFixed(1)}, h=${rect.height.toFixed(1)}`);
          }
        } catch {
          // field doesn't exist
        }
      }
    }
  }
}

inspect().catch(console.error);
