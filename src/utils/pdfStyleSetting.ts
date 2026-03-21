export type PdfStyle = 'official' | 'custom';

const KEY = 'pdfStyle';

export function getPdfStyle(): PdfStyle {
  return (localStorage.getItem(KEY) as PdfStyle) || 'official';
}

export function setPdfStyle(style: PdfStyle) {
  localStorage.setItem(KEY, style);
}

export function togglePdfStyle(): PdfStyle {
  const next: PdfStyle = getPdfStyle() === 'official' ? 'custom' : 'official';
  setPdfStyle(next);
  return next;
}
