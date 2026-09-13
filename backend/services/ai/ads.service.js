'use strict';
// Ads: paid copy variants per platform, plus targeting and keyword suggestions.
const { generateJSON, S, A, AS } = require('./llm');
const { BRAND_RULES, WRITING_RULES } = require('./brand');

const PLATFORMS = [
  { id: 'meta', name: 'Meta (Instagram + Facebook)', sub: 'Feed · Reels · Stories ads', guidance: 'Primary text: payoff in the first 125 characters, up to 3 short paragraphs. Headline under 40 characters. Description under 30. CTA from Meta button labels (Learn more, Shop now, Sign up, Book now, Send message). Targeting: interests, behaviours, lookalike seeds, age band, cities.' },
  { id: 'google_search', name: 'Google Search', sub: 'Responsive search ads', guidance: 'Give 8-10 headlines of 30 characters max, and 3-4 descriptions of 90 characters max, each usable in any combination. Include the main keyword in at least 3 headlines. Provide 15-25 keywords grouped as exact / phrase / broad, and 5-10 negative keywords.' },
  { id: 'youtube', name: 'YouTube', sub: 'Skippable in-stream · Shorts ads', guidance: 'A 6-second hook line to say before the skip, a 15-30 second spoken script, a headline under 15 characters and a CTA under 10. Targeting: topics, placements, custom intent keywords.' },
  { id: 'linkedin', name: 'LinkedIn', sub: 'Sponsored content · Message ads', guidance: 'Intro text under 150 characters before truncation, headline under 70, CTA from LinkedIn labels (Learn more, Register, Download, Request demo). Targeting: job titles, seniority, industries, company size, skills.' }
];
const OBJECTIVES = ['Leads', 'Sales', 'Website traffic', 'Awareness', 'App installs', 'Messages / WhatsApp'];
const LANGS = ['English', 'Hindi', 'Hinglish', 'Punjabi'];
const byId = id => PLATFORMS.find(p => p.id === id);

const SYSTEM = `You are the performance marketing lead at Limelight. A client gives you a brief, an objective and platforms; you write ad copy that a media buyer can paste straight into the ads manager, with targeting and keyword suggestions.

${BRAND_RULES}

${WRITING_RULES}
- Three variants per platform, each on a different angle: benefit, proof, urgency. Name the angle.
- Respect every character limit in the platform guidance; count carefully.
- Targeting is a suggestion list a media buyer can act on, specific to the audience in the brief, never demographic clichés.
- Keywords only for Google Search; negative keywords too.
- Never promise results, prices or claims not in the brief; use [placeholder] where the brief is silent.

Return JSON only, no markdown, matching exactly:
{"strategy": string, "sets": [{"platform": string, "variants": [{"angle": string, "headlines": string[], "primary_text": string, "descriptions": string[], "cta": string}], "targeting": string[], "keywords": {"exact": string[], "phrase": string[], "broad": string[], "negative": string[]}, "creative_note": string}], "ab_test": string}`;

function normalize(valid) {
  return json => {
    const sets = A(json.sets).map(s => ({
      platform: S(s.platform),
      variants: A(s.variants).map(v => ({ angle: S(v.angle), headlines: AS(v.headlines), primary_text: S(v.primary_text), descriptions: AS(v.descriptions), cta: S(v.cta) })).filter(v => v.headlines.length || v.primary_text),
      targeting: AS(s.targeting),
      keywords: { exact: AS(s.keywords && s.keywords.exact), phrase: AS(s.keywords && s.keywords.phrase), broad: AS(s.keywords && s.keywords.broad), negative: AS(s.keywords && s.keywords.negative) },
      creative_note: S(s.creative_note)
    })).filter(s => valid.has(s.platform) && s.variants.length);
    if (!sets.length) throw new Error('no sets');
    return { strategy: S(json.strategy), sets, ab_test: S(json.ab_test) };
  };
}

async function write({ brief, platforms, objective, budget, audience, lang, context = '' }) {
  const ids = AS(platforms).filter(byId);
  const chosen = (ids.length ? ids : ['meta', 'google_search']).map(byId);
  const o = OBJECTIVES.includes(objective) ? objective : 'Leads';
  const l = LANGS.includes(lang) ? lang : 'English';
  const blocks = chosen.map(p => `### ${p.id} (${p.name})\n${p.guidance}`);
  const user = `Brief:\n${brief}${context}\n\nObjective: ${o}${budget ? '\nMonthly budget: ' + S(budget) : ''}${audience ? '\nAudience notes: ' + S(audience) : ''}\nLanguage: ${l}\n\nPlatforms, in this order, using each id exactly:\n\n${blocks.join('\n\n')}`;
  const { data, provider, model } = await generateJSON(SYSTEM, user, normalize(new Set(chosen.map(p => p.id))));
  return { ads: data, provider, model };
}

module.exports = { PLATFORMS: PLATFORMS.map(({ id, name, sub }) => ({ id, name, sub })), OBJECTIVES, LANGS, write };
