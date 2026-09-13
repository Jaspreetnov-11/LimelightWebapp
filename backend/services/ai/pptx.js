'use strict';
// Renders a designed deck to .pptx (pptxgenjs). Limelight system: black, white type, one yellow accent, Montserrat.
const INK = '0A0A0B', PANEL = '151517', WHITE = 'F5F5F6', MUTED = 'B9B9C2', DIM = '6A6A74', YELLOW = 'FFD21F';
const F = 'Montserrat';
const W = 10, H = 5.625; // LAYOUT_16x9 inches

async function build(deck) {
  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = deck.title;
  const total = deck.slides.length;

  const text = (s, t, o) => s.addText(t, { fontFace: F, color: WHITE, valign: 'top', margin: 0, ...o });
  const kicker = (s, k, y = 0.5) => k && text(s, k.toUpperCase(), { x: 0.6, y, w: 8.8, h: 0.3, fontSize: 10, bold: true, color: YELLOW, charSpacing: 4 });
  const title = (s, t, o = {}) => text(s, t, { x: 0.6, y: 0.85, w: 8.8, h: 1.0, fontSize: 26, bold: true, ...o });
  const list = (s, items, o = {}) => s.addText(items.map(i => ({ text: i, options: { bullet: { code: '25AA' }, breakLine: true } })), { x: 0.6, y: 2.0, w: 8.8, h: 2.9, fontFace: F, fontSize: 15, color: MUTED, valign: 'top', paraSpaceAfter: 8, margin: 0, ...o });
  const chrome = (s, i, sl) => {
    s.addShape(pptx.ShapeType.rect, { x: 0.6, y: H - 0.55, w: 0.6, h: 0.06, fill: { color: YELLOW }, line: { color: YELLOW } });
    text(s, `${i + 1} / ${total}`, { x: W - 1.6, y: H - 0.62, w: 1.0, h: 0.25, fontSize: 9, color: DIM, align: 'right' });
    if (sl.notes) s.addNotes(sl.notes);
  };

  deck.slides.forEach((sl, i) => {
    const s = pptx.addSlide();
    s.background = { color: INK };
    switch (sl.kind) {
      case 'cover': {
        kicker(s, sl.kicker || deck.subtitle ? (sl.kicker || 'Limelight') : 'Limelight', 1.6);
        text(s, sl.title, { x: 0.6, y: 1.95, w: 8.8, h: 1.6, fontSize: 40, bold: true, valign: 'top' });
        if (sl.subtitle) text(s, sl.subtitle, { x: 0.6, y: 3.6, w: 8.8, h: 0.6, fontSize: 16, color: MUTED });
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: H, fill: { color: YELLOW }, line: { color: YELLOW } });
        break;
      }
      case 'agenda': {
        kicker(s, sl.kicker || 'Agenda'); title(s, sl.title);
        sl.points.forEach((p, k) => {
          const y = 2.0 + k * 0.55;
          text(s, String(k + 1).padStart(2, '0'), { x: 0.6, y, w: 0.6, h: 0.45, fontSize: 14, bold: true, color: YELLOW });
          text(s, p, { x: 1.3, y, w: 8.1, h: 0.45, fontSize: 15, color: WHITE });
        });
        break;
      }
      case 'statement': {
        kicker(s, sl.kicker, 1.3);
        text(s, sl.title, { x: 0.6, y: 1.7, w: 8.8, h: 2.4, fontSize: 34, bold: true, valign: 'middle' });
        break;
      }
      case 'split': {
        kicker(s, sl.kicker); title(s, sl.title, { w: 5.2 });
        list(s, sl.points, { w: 5.2 });
        s.addShape(pptx.ShapeType.rect, { x: 6.3, y: 0.85, w: 3.1, h: 4.0, fill: { color: YELLOW }, line: { color: YELLOW } });
        text(s, sl.callout, { x: 6.55, y: 1.1, w: 2.6, h: 3.5, fontSize: 18, bold: true, color: INK, valign: 'middle' });
        break;
      }
      case 'stats': {
        kicker(s, sl.kicker); title(s, sl.title);
        const n = Math.min(4, sl.stats.length), gap = 0.2, cw = (8.8 - gap * (n - 1)) / n;
        sl.stats.slice(0, n).forEach((st, k) => {
          const x = 0.6 + k * (cw + gap);
          s.addShape(pptx.ShapeType.rect, { x, y: 2.1, w: cw, h: 2.5, fill: { color: PANEL }, line: { color: PANEL } });
          text(s, st.value, { x: x + 0.2, y: 2.35, w: cw - 0.4, h: 1.1, fontSize: n > 3 ? 26 : 34, bold: true, color: YELLOW, valign: 'bottom' });
          text(s, st.label, { x: x + 0.2, y: 3.55, w: cw - 0.4, h: 0.9, fontSize: 12, color: MUTED });
        });
        break;
      }
      case 'steps': {
        kicker(s, sl.kicker); title(s, sl.title);
        const n = Math.min(5, sl.steps.length), gap = 0.15, cw = (8.8 - gap * (n - 1)) / n;
        sl.steps.slice(0, n).forEach((st, k) => {
          const x = 0.6 + k * (cw + gap);
          s.addShape(pptx.ShapeType.ellipse, { x, y: 2.1, w: 0.42, h: 0.42, fill: { color: YELLOW }, line: { color: YELLOW } });
          text(s, String(k + 1), { x, y: 2.1, w: 0.42, h: 0.42, fontSize: 12, bold: true, color: INK, align: 'center', valign: 'middle' });
          s.addShape(pptx.ShapeType.line, { x: x + 0.5, y: 2.31, w: cw - 0.5, h: 0, line: { color: '2A2A30', width: 1 } });
          text(s, st.title, { x, y: 2.7, w: cw - 0.1, h: 0.6, fontSize: 13, bold: true });
          text(s, st.text, { x, y: 3.3, w: cw - 0.1, h: 1.4, fontSize: 11, color: MUTED });
        });
        break;
      }
      case 'compare': {
        kicker(s, sl.kicker); title(s, sl.title);
        [[sl.compare.left, 0.6, PANEL, WHITE, MUTED], [sl.compare.right, 5.1, YELLOW, INK, '3A3300']].forEach(([side, x, fill, tc, ic]) => {
          s.addShape(pptx.ShapeType.rect, { x, y: 2.0, w: 4.3, h: 2.7, fill: { color: fill }, line: { color: fill } });
          text(s, side.title, { x: x + 0.25, y: 2.2, w: 3.8, h: 0.4, fontSize: 14, bold: true, color: tc });
          s.addText(side.items.map(t => ({ text: t, options: { bullet: { code: '25AA' }, breakLine: true } })), { x: x + 0.25, y: 2.7, w: 3.8, h: 1.9, fontFace: F, fontSize: 12, color: ic, valign: 'top', paraSpaceAfter: 5, margin: 0 });
        });
        break;
      }
      case 'chart': {
        kicker(s, sl.kicker); title(s, sl.title);
        const c = sl.chart, type = c.type === 'pie' ? pptx.ChartType.pie : c.type === 'line' ? pptx.ChartType.line : pptx.ChartType.bar;
        const data = c.series.map(se => ({ name: se.name || 'Series', labels: c.categories, values: se.values.slice(0, c.categories.length) }));
        s.addChart(type, data, {
          x: 0.6, y: 1.95, w: 5.9, h: 2.9, chartColors: [YELLOW, 'FFFFFF', '8A8A94', 'B48CFF', '6FA8FF'],
          catAxisLabelColor: MUTED, valAxisLabelColor: MUTED, catAxisLabelFontFace: F, valAxisLabelFontFace: F, catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
          valGridLine: { color: '2A2A30', style: 'solid', size: 0.5 }, catGridLine: { style: 'none' }, showLegend: data.length > 1, legendColor: MUTED, legendFontFace: F, legendPos: 'b',
          dataLabelColor: WHITE, dataLabelFontFace: F, showValue: c.type !== 'line', dataLabelFontSize: 9, dataLabelFormatCode: '#,##0.##', valAxisLabelFormatCode: '#,##0.##', showPercent: c.type === 'pie', plotArea: { fill: { color: INK } }
        });
        if (c.takeaway) text(s, c.takeaway, { x: 6.8, y: 2.0, w: 2.6, h: 2.8, fontSize: 15, bold: true, valign: 'middle' });
        break;
      }
      case 'quote': {
        s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.5, w: 0.08, h: 2.4, fill: { color: YELLOW }, line: { color: YELLOW } });
        text(s, '“' + sl.quote.text + '”', { x: 1.0, y: 1.5, w: 8.4, h: 2.0, fontSize: 24, italic: true, valign: 'middle' });
        if (sl.quote.by) text(s, '— ' + sl.quote.by, { x: 1.0, y: 3.55, w: 8.4, h: 0.4, fontSize: 13, color: MUTED });
        break;
      }
      case 'image': {
        kicker(s, sl.kicker); title(s, sl.title, { w: 4.4 });
        if (sl.image.caption) text(s, sl.image.caption, { x: 0.6, y: 2.0, w: 4.4, h: 1.2, fontSize: 14, color: MUTED });
        s.addShape(pptx.ShapeType.rect, { x: 5.3, y: 0.85, w: 4.1, h: 4.0, fill: { color: PANEL }, line: { color: '3A3A40', width: 1, dashType: 'dash' } });
        text(s, 'IMAGE', { x: 5.3, y: 1.0, w: 4.1, h: 0.3, fontSize: 9, bold: true, color: YELLOW, align: 'center', charSpacing: 4 });
        text(s, sl.image.prompt, { x: 5.5, y: 1.4, w: 3.7, h: 3.3, fontSize: 10, color: DIM, valign: 'middle', align: 'center' });
        break;
      }
      case 'closing': {
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: H, fill: { color: YELLOW }, line: { color: YELLOW } });
        s.background = { color: YELLOW };
        text(s, (sl.kicker || 'Next step').toUpperCase(), { x: 0.6, y: 1.4, w: 8.8, h: 0.3, fontSize: 10, bold: true, color: INK, charSpacing: 4 });
        text(s, sl.title, { x: 0.6, y: 1.8, w: 8.8, h: 1.6, fontSize: 36, bold: true, color: INK });
        if (sl.subtitle || sl.points[0]) text(s, sl.subtitle || sl.points[0], { x: 0.6, y: 3.5, w: 8.8, h: 0.6, fontSize: 16, color: '3A3300' });
        text(s, 'Limelight  ·  [name]  ·  [phone]  ·  [email]', { x: 0.6, y: H - 0.7, w: 8.8, h: 0.3, fontSize: 11, color: '3A3300' });
        if (sl.notes) s.addNotes(sl.notes);
        return;
      }
      default: { // bullets
        kicker(s, sl.kicker); title(s, sl.title);
        list(s, sl.points);
      }
    }
    chrome(s, i, sl);
  });
  return pptx.write({ outputType: 'nodebuffer' });
}

module.exports = { build };
