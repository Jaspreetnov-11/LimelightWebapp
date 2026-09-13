'use strict';
// Reference files -> plain text the agents can read. PDF, Word, text, markdown, CSV, JSON. Images are not read.
const fs = require('fs');
const path = require('path');
const AppError = require('../../utils/appError');

const MAX_CHARS = 60000;          // stored per file
const PER_REF_IN_PROMPT = 8000;   // sent to the model per reference

async function extract(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const buf = fs.readFileSync(file.path);
  let text = '';
  if (ext === '.pdf') {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buf });
    try { text = (await parser.getText()).text || ''; } finally { if (parser.destroy) await parser.destroy().catch(() => {}); }
  } else if (ext === '.docx') {
    const mammoth = require('mammoth');
    text = (await mammoth.extractRawText({ buffer: buf })).value || '';
  } else if (['.txt', '.md', '.csv', '.json', '.html', '.htm'].includes(ext)) {
    text = buf.toString('utf8');
    if (ext === '.html' || ext === '.htm') text = text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
  } else {
    throw new AppError('Only PDF, Word (.docx), text, markdown, CSV, JSON or HTML files can be read as references.', 400);
  }
  text = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) throw new AppError('No readable text found in that file (scanned PDFs need OCR first).', 400);
  return { text: text.slice(0, MAX_CHARS), kind: ext.slice(1) };
}

/** Builds the block appended to the user turn. */
function contextBlock(rows) {
  if (!rows || !rows.length) return '';
  const parts = rows.map(r => `--- ${r.name} ---\n${String(r.text).slice(0, PER_REF_IN_PROMPT)}`);
  return `\n\nReference material uploaded by the team (use its facts, names, numbers and tone; it outranks your assumptions; never contradict it):\n\n${parts.join('\n\n')}`;
}

module.exports = { extract, contextBlock };
