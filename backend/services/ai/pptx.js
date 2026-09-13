'use strict';
// Fallback when Google Slides is not connected: the same deck as a .pptx buffer (pptxgenjs).
const INK = '0A0A0B', WHITE = 'F5F5F6', MUTED = 'B9B9C2', YELLOW = 'FFD21F';
const FONT = 'Calibri';

async function build(deck) {
  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9'; // 10 x 5.625 in
  pptx.title = deck.title;

  const bar = s => s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 5.05, w: 0.75, h: 0.07, fill: { color: YELLOW }, line: { color: YELLOW } });
  const title = (s, text, opts = {}) => s.addText(text, { x: 0.5, y: 0.45, w: 9, h: 0.9, fontFace: FONT, fontSize: 28, bold: true, color: WHITE, valign: 'top', ...opts });
  const body = (s, lines, opts = {}) => s.addText(lines.map(t => ({ text: t, options: { bullet: lines.length > 1, breakLine: true } })), { x: 0.5, y: 1.5, w: 9, h: 3.3, fontFace: FONT, fontSize: 16, color: MUTED, valign: 'top', paraSpaceAfter: 6, ...opts });

  for (const sl of deck.slides) {
    const s = pptx.addSlide();
    s.background = { color: INK };
    switch (sl.layout) {
      case 'title':
      case 'closing':
        s.addText(sl.title, { x: 0.5, y: 1.7, w: 9, h: 1.2, fontFace: FONT, fontSize: 36, bold: true, color: WHITE, valign: 'bottom' });
        if (sl.subtitle) s.addText(sl.subtitle, { x: 0.5, y: 3.0, w: 9, h: 0.8, fontFace: FONT, fontSize: 16, color: MUTED, valign: 'top' });
        break;
      case 'section':
        s.addText(sl.title, { x: 0.5, y: 2.0, w: 9, h: 1.0, fontFace: FONT, fontSize: 32, bold: true, color: WHITE });
        if (sl.subtitle) s.addText(sl.subtitle, { x: 0.5, y: 3.0, w: 9, h: 0.6, fontFace: FONT, fontSize: 15, color: MUTED });
        break;
      case 'two_column':
        title(s, sl.title);
        body(s, sl.left, { w: 4.3 });
        body(s, sl.right, { x: 5.2, w: 4.3 });
        break;
      case 'big_number':
        s.addText(sl.number || sl.title, { x: 0.5, y: 1.3, w: 9, h: 1.6, fontFace: FONT, fontSize: 60, bold: true, color: YELLOW, valign: 'bottom' });
        s.addText(sl.caption || sl.bullets.join('  ·  '), { x: 0.5, y: 3.0, w: 9, h: 1.0, fontFace: FONT, fontSize: 16, color: MUTED });
        break;
      case 'quote':
        s.addText('“' + (sl.quote || sl.title) + '”', { x: 0.7, y: 1.5, w: 8.6, h: 2.4, fontFace: FONT, fontSize: 26, italic: true, color: WHITE, valign: 'middle' });
        if (sl.caption) s.addText('— ' + sl.caption, { x: 0.7, y: 3.9, w: 8.6, h: 0.5, fontFace: FONT, fontSize: 14, color: MUTED });
        break;
      default:
        title(s, sl.title);
        body(s, sl.bullets);
    }
    bar(s);
    if (sl.notes) s.addNotes(sl.notes);
  }
  return pptx.write({ outputType: 'nodebuffer' });
}

module.exports = { build };
