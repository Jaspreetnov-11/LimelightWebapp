'use strict';
/**
 * One text-in, JSON-out call for the AI Agent page.
 *   gemini    - free tier, used whenever GEMINI_API_KEY is set
 *   anthropic - used when only ANTHROPIC_API_KEY is set
 *   none      - the services return demo output
 */
const env = require('../../config/env');
const AppError = require('../../utils/appError');

function provider() {
  if (env.GEMINI_API_KEY) return { provider: 'gemini', model: env.GEMINI_MODEL };
  if (env.ANTHROPIC_API_KEY) return { provider: 'anthropic', model: env.ANTHROPIC_MODEL };
  return { provider: 'none', model: '' };
}

async function gemini(system, user, model) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.8 }
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AppError('Gemini ' + res.status + ': ' + ((data.error && data.error.message) || res.statusText), 502);
  const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  const text = parts.map(p => p.text || '').join('');
  if (!text) throw new AppError('Gemini returned no text.', 502);
  return text;
}

let anthropic = null;
async function claude(system, user, model) {
  if (!anthropic) { const Anthropic = require('@anthropic-ai/sdk'); anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }); }
  const res = await anthropic.messages.create({ model, max_tokens: 16000, system, messages: [{ role: 'user', content: user }] });
  if (res.stop_reason === 'refusal') throw new AppError('Claude declined this brief.', 502);
  const block = (res.content || []).find(b => b.type === 'text');
  if (!block) throw new AppError('Claude returned no text.', 502);
  return block.text;
}

function parseJSON(raw) {
  const text = String(raw).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let json;
  try { json = JSON.parse(text); } catch (e) {
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a < 0 || b < 0) throw new AppError('The model returned text that is not JSON. Try again.', 502);
    json = JSON.parse(text.slice(a, b + 1));
  }
  // Some responses wrap the object in a single top-level key; unwrap that.
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const keys = Object.keys(json);
    if (keys.length === 1 && json[keys[0]] && typeof json[keys[0]] === 'object' && !Array.isArray(json[keys[0]])) json = json[keys[0]];
  }
  return json;
}

/**
 * @param {string} system   system prompt (ends with the exact JSON shape)
 * @param {string} user     user turn
 * @param {(json:any)=>any} normalize  turns the raw object into the exact shape the UI expects; throw to reject
 */
async function generateJSON(system, user, normalize) {
  const p = provider();
  if (p.provider === 'none') throw new AppError('No AI key configured. Add GEMINI_API_KEY (free) to .env.', 503);
  const call = p.provider === 'gemini' ? gemini : claude;
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await call(system, user, p.model);
      return { data: normalize(parseJSON(raw)), provider: p.provider, model: p.model };
    } catch (e) {
      lastErr = e;
      if (e instanceof AppError && e.statusCode === 502 && /Gemini \d+|Claude/.test(e.message)) throw e; // API errors: do not retry
    }
  }
  throw lastErr instanceof AppError ? lastErr : new AppError('The model answered in the wrong shape twice. Try again.', 502);
}

// tiny coercers for normalizers
const S = v => (v == null ? '' : String(v)).trim();
const A = v => (Array.isArray(v) ? v : []);
const AS = v => A(v).map(S).filter(Boolean);
const N = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const KV = v => A(v).map(x => ({ label: S(x && x.label), value: S(x && x.value) })).filter(x => x.label && x.value);

module.exports = { provider, generateJSON, S, A, AS, N, KV };
