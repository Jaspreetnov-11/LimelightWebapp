'use strict';
// PPT: brief -> deck outline (Gemini/Claude) -> Google Slides link, or a .pptx when Slides is not connected.
const { generateJSON, S, A, AS } = require('./llm');
const { BRAND_RULES, WRITING_RULES } = require('./brand');
const gslides = require('./gslides');
const pptx = require('./pptx');

const COUNTS = [5, 8, 10, 12, 15];
const STYLES = ['Pitch', 'Client proposal', 'Report / review', 'Training', 'Creative presentation'];
const LANGS = ['English', 'Hindi', 'Hinglish'];
const LAYOUTS = ['title', 'section', 'bullets', 'two_column', 'big_number', 'quote', 'closing'];

const SYSTEM = `You are the strategy lead at Limelight. A client gives you a brief; you write a complete slide deck: the outline, every slide's text, and the speaker notes.

${BRAND_RULES}

${WRITING_RULES}
Deck craft:
- Slide 1 is layout "title" (title + one-line subtitle). Last slide is "closing" (the ask, and a next step).
- One idea per slide. Titles are full sentences that state the point ("Footfall drops 40% after Diwali"), never labels ("Overview").
- "bullets": 3-5 bullets, each under 12 words. "two_column": left and right lists with 2-4 items each, and the title says what is being compared. "big_number": one number or short stat plus a caption. "quote": one line plus who said it (or [customer name]). "section": a divider with a subtitle.
- Use 1-2 section slides for decks of 10 or more.
- notes: 2-4 sentences the presenter says on that slide, conversational, not a repeat of the bullets.
- Never invent numbers; if the brief has none, use a bracketed placeholder like [metric].

Return JSON only, no markdown, matching exactly:
{"title": string, "subtitle": string, "slides": [{"layout": "title"|"section"|"bullets"|"two_column"|"big_number"|"quote"|"closing", "title": string, "subtitle": string, "bullets": string[], "left": string[], "right": string[], "number": string, "caption": string, "quote": string, "notes": string}]}`;

function normalize(json) {
  const slides = A(json.slides).map(s => ({
    layout: LAYOUTS.includes(S(s.layout)) ? S(s.layout) : 'bullets',
    title: S(s.title), subtitle: S(s.subtitle), bullets: AS(s.bullets), left: AS(s.left), right: AS(s.right),
    number: S(s.number), caption: S(s.caption), quote: S(s.quote), notes: S(s.notes)
  })).filter(s => s.title || s.quote || s.number);
  if (slides.length < 2) throw new Error('too few slides');
  if (slides[0].layout !== 'title') slides.unshift({ layout: 'title', title: S(json.title), subtitle: S(json.subtitle), bullets: [], left: [], right: [], number: '', caption: '', quote: '', notes: '' });
  return { title: S(json.title) || slides[0].title || 'Deck', subtitle: S(json.subtitle), slides };
}

async function make({ brief, count, style, lang, audience, user }) {
  const n = COUNTS.includes(Number(count)) ? Number(count) : 10;
  const st = STYLES.includes(style) ? style : 'Pitch';
  const l = LANGS.includes(lang) ? lang : 'English';
  const userMsg = `Brief:\n${brief}\n\nDeck type: ${st}\nSlides: exactly ${n}\nLanguage: ${l}${audience ? '\nAudience: ' + S(audience) : ''}\n\nWrite the deck.`;
  const { data: deck, provider, model } = await generateJSON(SYSTEM, userMsg, normalize);
  deck.slides = deck.slides.slice(0, n + 2);

  if (gslides.ready()) {
    const g = await gslides.build(deck, user && user.email);
    return { deck, provider, model, slides: { url: g.url, id: g.id } };
  }
  const buf = await pptx.build(deck);
  const filename = deck.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60) || 'deck';
  return { deck, provider, model, pptx: { filename: filename + '.pptx', base64: buf.toString('base64') } };
}

module.exports = { COUNTS, STYLES, LANGS, make, googleReady: gslides.ready };
