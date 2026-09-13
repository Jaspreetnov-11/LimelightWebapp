'use strict';
/**
 * PDF export for every AI tool. A run's output is turned into a generic document
 *   { title, subtitle, meta: [[label, value]], sections: [{ heading, kicker, paragraphs[], bullets[], kv: [[k, v]], table: { head[], rows[][] } }] }
 * and rendered with pdfkit. White paper, black type, one yellow rule. Noto fonts cover Hindi and Punjabi.
 */
const fs = require('fs');
const path = require('path');

const FONT_DIR = path.resolve(__dirname, '..', '..', 'assets', 'fonts');
const fontPath = n => { const p = path.join(FONT_DIR, n + '.ttf'); return fs.existsSync(p) && fs.statSync(p).size > 10000 ? p : null; };
const INK = '#0A0A0B', MUTED = '#6A6A74', YELLOW = '#FFD21F', LINE = '#E6E6EA';

/* ---------- document builders, one per tool ---------- */
const KV = (label, value) => [label, value];

function docFor(tool, input, output) {
  const brief = input && input.brief ? String(input.brief) : '';
  const sec = (heading, extra = {}) => ({ heading, kicker: '', paragraphs: [], bullets: [], kv: [], table: null, ...extra });
  const d = { title: '', subtitle: '', meta: [], sections: [] };
  if (brief) d.sections.push(sec('Brief', { paragraphs: [brief] }));

  if (tool === 'prompts') {
    const p = output.pack || {};
    d.title = 'Prompt pack'; d.subtitle = p.concept || '';
    for (const t of p.targets || []) d.sections.push(sec(t.name || t.id, { kicker: 'PROMPT', paragraphs: [t.prompt, ...(t.extras || []).map(x => x.label.toUpperCase() + '\n' + x.value)], kv: (t.settings || []).map(s => KV(s.label, s.value)), bullets: t.tip ? ['Tip: ' + t.tip] : [] }));
  } else if (tool === 'content') {
    const p = output.pack || {};
    d.title = 'Social content'; d.subtitle = p.angle || '';
    for (const x of p.posts || []) d.sections.push(sec((x.platformName || x.platform) + ' · ' + x.format, { kicker: x.best_time ? 'BEST TIME ' + x.best_time : '', paragraphs: ['Hook: ' + x.hook, x.caption, (x.hashtags || []).join(' ')].filter(Boolean), kv: [KV('CTA', x.cta), KV('Visual', x.visual)].filter(k => k[1]) }));
  } else if (tool === 'script') {
    const s = output.script || {};
    d.title = s.title || 'Script'; d.subtitle = s.logline || '';
    d.meta = [KV('Duration', s.duration), KV('Scenes', String((s.scenes || []).length)), KV('Spoken words', String(s.spoken_words || ''))];
    d.sections.push(sec('Hook', { paragraphs: [s.hook] }));
    d.sections.push(sec('Scenes', { table: { head: ['Time', 'Visual', 'Audio', 'On screen', 'SFX / music'], rows: (s.scenes || []).map(sc => [sc.time, sc.visual, sc.audio, sc.on_screen_text || '', sc.sfx_music || '']) } }));
    d.sections.push(sec('Close', { kv: [KV('CTA', s.cta), KV('Music', s.music_note)].filter(k => k[1]), bullets: s.shot_list || [] }));
  } else if (tool === 'schedule') {
    const p = output.plan || {};
    d.title = p.campaign || 'Posting calendar'; d.subtitle = p.strategy || '';
    d.meta = [KV('Start', output.start || ''), KV('Posts', String((p.posts || []).length))];
    d.sections.push(sec('Calendar', { table: { head: ['Day', 'Time', 'Platform', 'Format', 'Title'], rows: (p.posts || []).map(x => ['Day ' + (x.day + 1), x.time, x.platform, x.format, x.title]) } }));
    for (const x of p.posts || []) d.sections.push(sec(`Day ${x.day + 1} · ${x.time} · ${x.platform}`, { kicker: x.pillar ? x.pillar.toUpperCase() : '', paragraphs: [x.title, x.caption, (x.hashtags || []).join(' ')].filter(Boolean), kv: x.asset ? [KV('Asset', x.asset)] : [] }));
  } else if (tool === 'ads') {
    const a = output.ads || {};
    d.title = 'Ad copy'; d.subtitle = a.strategy || '';
    for (const s of a.sets || []) {
      (s.variants || []).forEach((v, i) => d.sections.push(sec(`${s.platform} · Variant ${i + 1}`, { kicker: (v.angle || '').toUpperCase(), bullets: [...(v.headlines || []).map(h => 'Headline: ' + h), ...(v.descriptions || []).map(x => 'Description: ' + x)], paragraphs: v.primary_text ? ['Primary text: ' + v.primary_text] : [], kv: [KV('CTA', v.cta)] })));
      const k = s.keywords || {};
      const kvs = [KV('Targeting', (s.targeting || []).join('; ')), KV('Exact', (k.exact || []).join(', ')), KV('Phrase', (k.phrase || []).join(', ')), KV('Broad', (k.broad || []).join(', ')), KV('Negative', (k.negative || []).join(', ')), KV('Creative', s.creative_note)].filter(x => x[1]);
      if (kvs.length) d.sections.push(sec(s.platform + ' · Targeting & keywords', { kv: kvs }));
    }
    if (a.ab_test) d.sections.push(sec('A/B test', { paragraphs: [a.ab_test] }));
  } else if (tool === 'deck') {
    const o = output.outline || output.deck || {};
    d.title = o.title || 'Deck'; d.subtitle = o.subtitle || '';
    (o.slides || []).forEach((s, i) => d.sections.push(sec(`${i + 1}. ${s.title || (s.quote && s.quote.text) || ''}`, { kicker: (s.kind || s.kicker || '').toUpperCase(), bullets: s.points || s.bullets || [], paragraphs: [s.subtitle, s.callout, s.notes ? 'Notes: ' + s.notes : ''].filter(Boolean), kv: (s.stats || []).map(x => KV(x.value, x.label)) })));
  } else {
    d.title = tool; d.sections.push(sec('Output', { paragraphs: [JSON.stringify(output, null, 2)] }));
  }
  return d;
}

/* ---------- renderer ---------- */
function render(doc, meta = {}) {
  const PDFDocument = require('pdfkit');
  const pdf = new PDFDocument({ size: 'A4', bufferPages: true, margins: { top: 56, bottom: 56, left: 56, right: 56 }, info: { Title: doc.title, Author: 'Limelight' } });
  const chunks = [];
  pdf.on('data', c => chunks.push(c));
  const done = new Promise(res => pdf.on('end', () => res(Buffer.concat(chunks))));

  const reg = fontPath('NotoSans-Regular'), bold = fontPath('NotoSans-Bold');
  const dev = fontPath('NotoSansDevanagari-Regular'), devB = fontPath('NotoSansDevanagari-Bold'), gur = fontPath('MuktaMahee-Regular');
  const hasDev = /[ऀ-ॿ]/, hasGur = /[਀-੿]/;
  const pick = (text, b) => {
    const t = String(text || '');
    if (hasGur.test(t) && gur) return gur;
    if (hasDev.test(t) && (b ? devB || dev : dev)) return b ? (devB || dev) : dev;
    if (b) return bold || 'Helvetica-Bold';
    return reg || 'Helvetica';
  };
  const W = pdf.page.width - 112;
  // Split mixed-script text into runs so Hindi, Punjabi and Latin each get a font that has the glyphs.
  // Punctuation, digits and spaces exist in every font here, so they stay inside the current run;
  // only letters decide the script.
  const cls = ch => (hasGur.test(ch) ? 'g' : hasDev.test(ch) ? 'd' : /\p{L}/u.test(ch) ? 'o' : '');
  const runsOf = t => {
    const out = []; let cur = '', k = '';
    for (const ch of String(t)) {
      const c = cls(ch);
      if (c && k && c !== k) { out.push(cur); cur = ''; }
      if (c) k = c;
      cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  };
  const text = (t, o = {}) => {
    const runs = runsOf(t);
    const { width, ...rest } = o;
    runs.forEach((r, i) => pdf.font(pick(r, o.bold)).fontSize(o.size || 10.5).fillColor(o.color || INK).text(r, { width: width || W, lineGap: 2, ...rest, continued: i < runs.length - 1 }));
  };
  const rule = () => { pdf.moveDown(0.3); pdf.moveTo(56, pdf.y).lineTo(56 + W, pdf.y).strokeColor(LINE).lineWidth(0.5).stroke(); pdf.moveDown(0.6); };
  const ensure = h => { if (pdf.y + h > pdf.page.height - 60) pdf.addPage(); };

  // header
  pdf.rect(56, 56, 40, 4).fill(YELLOW);
  pdf.moveDown(0.8);
  text('LIMELIGHT', { size: 8, color: MUTED, characterSpacing: 3 });
  pdf.moveDown(0.4);
  text(doc.title, { size: 22, bold: true });
  if (doc.subtitle) { pdf.moveDown(0.2); text(doc.subtitle, { size: 11, color: MUTED }); }
  const metaLine = [...(doc.meta || []).filter(m => m[1]).map(m => m[0] + ': ' + m[1]), meta.by ? 'By ' + meta.by : '', meta.date ? new Date(meta.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''].filter(Boolean).join('   ·   ');
  if (metaLine) { pdf.moveDown(0.3); text(metaLine, { size: 8.5, color: MUTED }); }
  rule();

  for (const s of doc.sections || []) {
    ensure(80);
    if (s.kicker) { text(s.kicker, { size: 7.5, color: '#B08A00', characterSpacing: 2 }); pdf.moveDown(0.15); }
    text(s.heading, { size: 13, bold: true });
    pdf.moveDown(0.35);
    for (const p of s.paragraphs || []) { ensure(40); text(p); pdf.moveDown(0.45); }
    for (const b of s.bullets || []) { ensure(24); const y = pdf.y; pdf.rect(56, y + 5, 3, 3).fill(INK); pdf.x = 68; text(b, { width: W - 12 }); pdf.x = 56; pdf.moveDown(0.2); }
    for (const [k, v] of s.kv || []) { ensure(24); text(k.toUpperCase(), { size: 7.5, color: MUTED, characterSpacing: 1.5 }); text(v); pdf.moveDown(0.35); }
    if (s.table && s.table.rows.length) {
      const cols = s.table.head.length, cw = W / cols;
      const row = (cells, b) => {
        ensure(30);
        const y0 = pdf.y; let h = 0;
        cells.forEach(c => { pdf.font(pick(c, b)).fontSize(8.5); h = Math.max(h, pdf.heightOfString(String(c || ''), { width: cw - 8 }) + 2); });
        cells.forEach((c, i) => {
          const runs = runsOf(c || '');
          runs.forEach((r, k) => pdf.font(pick(r, b)).fontSize(8.5).fillColor(b ? MUTED : INK).text(r, k === 0 ? 56 + i * cw : undefined, k === 0 ? y0 : undefined, { width: cw - 8, continued: k < runs.length - 1 }));
        });
        pdf.y = y0 + h + 6; pdf.x = 56;
        pdf.moveTo(56, pdf.y - 2).lineTo(56 + W, pdf.y - 2).strokeColor(LINE).lineWidth(0.4).stroke();
      };
      row(s.table.head, true);
      for (const r of s.table.rows) row(r, false);
      pdf.moveDown(0.4);
    }
    rule();
  }

  // footer page numbers
  const range = pdf.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    pdf.switchToPage(i);
    const keep = pdf.page.margins.bottom; pdf.page.margins.bottom = 0; // write inside the margin without triggering a new page
    pdf.font(reg || 'Helvetica').fontSize(8).fillColor(MUTED).text(`${i + 1} / ${range.count}`, 56, pdf.page.height - 36, { width: W, align: 'right', lineBreak: false });
    pdf.page.margins.bottom = keep;
  }
  pdf.end();
  return done;
}

module.exports = { docFor, render };
