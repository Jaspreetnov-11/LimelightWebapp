'use strict';
// PPT, two steps:
//   outline(brief)  -> the writer drafts slides (title, points, notes) for the person to approve or edit
//   design(outline) -> the designer picks a layout and visual treatment per slide, then the deck is rendered
//                      to Google Slides (when connected) or to a .pptx
const { generateJSON, S, A, AS, N } = require('./llm');
const { BRAND_RULES, WRITING_RULES } = require('./brand');
const gslides = require('./gslides');
const pptx = require('./pptx');

const COUNTS = [5, 8, 10, 12, 15];
const STYLES = ['Pitch', 'Client proposal', 'Report / review', 'Training', 'Creative presentation'];
const LANGS = ['English', 'Hindi', 'Hinglish'];

/* ---------------- step 1: outline ---------------- */

const OUTLINE_SYSTEM = `You are the strategy lead at Limelight. A client gives you a brief; you draft the slide outline: what each slide says, in order, plus what the presenter says out loud.

${BRAND_RULES}

${WRITING_RULES}
Outline craft:
- Slide 1 is the cover (title + one-line subtitle). The last slide is the close (the ask and a next step).
- One idea per slide. Titles are full sentences that state the point ("Footfall drops 40% after Diwali"), never labels ("Overview").
- points: 2-5 short lines per slide, each under 12 words. For the cover and close, points may be empty.
- Where the brief has numbers, keep them exact on their own slide. Never invent numbers; write [metric] if missing.
- notes: 2-4 sentences the presenter says on that slide, conversational, not a repeat of the points.

Return JSON only, no markdown, matching exactly:
{"title": string, "subtitle": string, "slides": [{"title": string, "points": string[], "notes": string}]}`;

function normalizeOutline(json) {
  const slides = A(json.slides).map(s => ({ title: S(s.title), points: AS(s.points), notes: S(s.notes) })).filter(s => s.title);
  if (slides.length < 2) throw new Error('too few slides');
  return { title: S(json.title) || slides[0].title, subtitle: S(json.subtitle), slides };
}

async function outline({ brief, count, style, lang, audience }) {
  const n = COUNTS.includes(Number(count)) ? Number(count) : 10;
  const st = STYLES.includes(style) ? style : 'Pitch';
  const l = LANGS.includes(lang) ? lang : 'English';
  const user = `Brief:\n${brief}\n\nDeck type: ${st}\nSlides: exactly ${n}\nLanguage: ${l}${audience ? '\nAudience: ' + S(audience) : ''}\n\nDraft the outline.`;
  const { data, provider, model } = await generateJSON(OUTLINE_SYSTEM, user, normalizeOutline);
  data.slides = data.slides.slice(0, n + 1);
  return { outline: { ...data, style: st, lang: l, brief: S(brief).slice(0, 4000) }, provider, model };
}

/* ---------------- step 2: design ---------------- */

const KINDS = ['cover', 'agenda', 'statement', 'bullets', 'split', 'stats', 'steps', 'compare', 'chart', 'quote', 'image', 'closing'];

const DESIGN_SYSTEM = `You are the presentation designer at Limelight. The outline is approved; you now decide how every slide looks, so the deck reads like a designed document, not a list of bullets.

${BRAND_RULES}

The system you design in: black slides, white type, one yellow accent per slide, generous space, Montserrat. No decoration for its own sake.

Slide kinds you can use (pick the one the content deserves):
- cover: kicker (small label), big title, subtitle.
- agenda: 3-6 numbered items.
- statement: one sentence, huge, nothing else. For the single most important point.
- bullets: title + 3-5 points. Use sparingly, never twice in a row.
- split: title + 2-4 points on the left, a yellow panel on the right carrying one short callout line.
- stats: title + 2-4 stat cards, each {value, label}. Only for numbers that exist in the outline; placeholders like [metric] are allowed.
- steps: title + 3-5 numbered steps, each {title, text}. For process, plan, timeline.
- compare: title + two panels {title, items[]} each. For before/after, us/them, option A/B.
- chart: title + a bar, line or pie chart from numbers in the outline: {type, categories[], series:[{name, values[]}]}, plus one takeaway line. Only if the outline has real numbers.
- quote: {text, by}. by may be [customer name].
- image: title + one image slot with a prompt the team will render in the Prompt studio, plus a caption. Use for mood, product, place, people.
- closing: big title (the ask), a next-step line, and a contact placeholder.

Rules:
- Keep every word from the outline that matters; you may tighten, not invent. Never add numbers.
- First slide is cover, last is closing. No two consecutive slides of the same kind. Aim for at least 5 different kinds across the deck.
- kicker is 1-3 words in caps, optional on any slide.
- notes: carry over the outline notes.

Return JSON only, no markdown, matching exactly:
{"slides": [{"kind": string, "kicker": string, "title": string, "subtitle": string, "points": string[], "callout": string, "stats": [{"value": string, "label": string}], "steps": [{"title": string, "text": string}], "compare": {"left": {"title": string, "items": string[]}, "right": {"title": string, "items": string[]}}, "chart": {"type": string, "categories": string[], "series": [{"name": string, "values": number[]}], "takeaway": string}, "quote": {"text": string, "by": string}, "image": {"prompt": string, "caption": string}, "notes": string}]}`;

function normalizeDesign(json) {
  const slides = A(json.slides).map(s => {
    const c = s.compare || {}, ch = s.chart || {}, q = s.quote || {}, im = s.image || {};
    const kind = KINDS.includes(S(s.kind)) ? S(s.kind) : 'bullets';
    const chart = { type: ['bar', 'line', 'pie'].includes(S(ch.type)) ? S(ch.type) : 'bar', categories: AS(ch.categories), series: A(ch.series).map(x => ({ name: S(x.name), values: A(x.values).map(v => N(v)) })).filter(x => x.values.length), takeaway: S(ch.takeaway) };
    return {
      kind, kicker: S(s.kicker).slice(0, 40), title: S(s.title), subtitle: S(s.subtitle), points: AS(s.points), callout: S(s.callout),
      stats: A(s.stats).map(x => ({ value: S(x.value), label: S(x.label) })).filter(x => x.value),
      steps: A(s.steps).map(x => ({ title: S(x.title), text: S(x.text) })).filter(x => x.title),
      compare: { left: { title: S(c.left && c.left.title), items: AS(c.left && c.left.items) }, right: { title: S(c.right && c.right.title), items: AS(c.right && c.right.items) } },
      chart, quote: { text: S(q.text), by: S(q.by) }, image: { prompt: S(im.prompt), caption: S(im.caption) }, notes: S(s.notes)
    };
  }).filter(s => s.title || s.quote.text || s.stats.length);
  if (slides.length < 2) throw new Error('too few slides');
  // degrade kinds whose data is missing so nothing renders empty
  for (const s of slides) {
    if (s.kind === 'stats' && !s.stats.length) s.kind = 'bullets';
    if (s.kind === 'steps' && !s.steps.length) s.kind = 'bullets';
    if (s.kind === 'compare' && !(s.compare.left.items.length && s.compare.right.items.length)) s.kind = 'bullets';
    if (s.kind === 'chart' && !(s.chart.categories.length && s.chart.series.length)) s.kind = 'stats', s.stats = s.stats.length ? s.stats : [{ value: '[metric]', label: s.title }];
    if (s.kind === 'quote' && !s.quote.text) s.kind = 'statement';
    if (s.kind === 'split' && !s.callout) s.callout = s.points[0] || '';
  }
  slides[0].kind = 'cover';
  slides[slides.length - 1].kind = slides.length > 1 ? 'closing' : slides[0].kind;
  return { slides };
}

function normalizeIncomingOutline(o) {
  const slides = A(o && o.slides).map(s => ({ title: S(s.title), points: AS(s.points), notes: S(s.notes) })).filter(s => s.title);
  if (slides.length < 2) throw Object.assign(new Error('The outline needs at least 2 slides.'), { statusCode: 400 });
  return { title: S(o.title) || slides[0].title, subtitle: S(o.subtitle), style: STYLES.includes(o.style) ? o.style : 'Pitch', lang: LANGS.includes(o.lang) ? o.lang : 'English', brief: S(o.brief).slice(0, 4000), slides: slides.slice(0, 20) };
}

async function design({ outline: raw, user }) {
  const o = normalizeIncomingOutline(raw);
  const text = o.slides.map((s, i) => `Slide ${i + 1}\nTitle: ${s.title}\nPoints:\n${s.points.map(p => '- ' + p).join('\n') || '(none)'}\nNotes: ${s.notes || '(none)'}`).join('\n\n');
  const userMsg = `Deck: ${o.title}\nSubtitle: ${o.subtitle}\nType: ${o.style}\nLanguage: ${o.lang}${o.brief ? '\nOriginal brief (for context only, do not add facts from it that the outline dropped):\n' + o.brief : ''}\n\nApproved outline:\n\n${text}\n\nDesign every slide, same order, same count (${o.slides.length}).`;
  const { data, provider, model } = await generateJSON(DESIGN_SYSTEM, userMsg, normalizeDesign);
  const deck = { title: o.title, subtitle: o.subtitle, slides: data.slides };

  if (gslides.ready()) {
    const g = await gslides.build(gslides.fromDesign(deck), user && user.email);
    return { deck, provider, model, slides: { url: g.url, id: g.id } };
  }
  const buf = await pptx.build(deck);
  const filename = (deck.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60) || 'deck') + '.pptx';
  return { deck, provider, model, pptx: { filename, base64: buf.toString('base64') } };
}

module.exports = { COUNTS, STYLES, LANGS, outline, design, googleReady: gslides.ready };
