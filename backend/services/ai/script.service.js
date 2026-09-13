'use strict';
// Content writing, scripts: reels, YouTube, ad films, explainers, with a time-coded scene table.
const { generateJSON, S, A, AS, N } = require('./llm');
const { BRAND_RULES, WRITING_RULES } = require('./brand');

const TYPES = [
  { id: 'reel', name: 'Reel / Short', note: 'Vertical 9:16. Hook in the first 2 seconds, one idea, fast cuts every 2-4 s, on-screen captions for sound-off viewing.' },
  { id: 'youtube', name: 'YouTube video', note: 'Horizontal 16:9. Cold open hook, then a promise, then sections with chapter titles, end screen CTA.' },
  { id: 'ad_film', name: 'Ad film', note: 'Story-led. Setup, tension, product as the turn, one line of brand voice at the end. Product name spoken once, shown twice.' },
  { id: 'explainer', name: 'Explainer', note: 'Problem, how it works in 3 steps, proof, CTA. Plain words, one visual metaphor carried through.' },
  { id: 'testimonial', name: 'Testimonial', note: 'Interview style. Questions the interviewer asks, sample answer beats, b-roll suggestions. Never fabricate a real person; write [customer name].' },
  { id: 'voiceover', name: 'Voiceover only', note: 'Audio-first narration over stills or footage. Written to be read aloud, with breath marks (…) and numbers as words.' }
];
const DURATIONS = ['15s', '30s', '45s', '60s', '90s', '2 min', '3 min', '5 min', '10 min'];
const LANGS = ['English', 'Hindi', 'Hinglish', 'Punjabi'];
const TONES = ['Editorial', 'Warm', 'Bold', 'Playful', 'Corporate', 'Emotional'];
const byId = id => TYPES.find(t => t.id === id);

const SYSTEM = `You are the head of film at Limelight. A client gives you a brief, a format and a running time; you write a production-ready script, timed to the second.

${BRAND_RULES}

${WRITING_RULES}
- Spoken words: roughly 2.3 words per second in English, 2 per second in Hindi. The total spoken text must fit the duration with breathing room; never overfill.
- Every scene has a time range that starts where the previous one ends and the last one ends exactly at the duration.
- visual is what the camera sees (shot size, movement, subject, light). audio is the exact words spoken (VO or dialogue, with the speaker named) or "music only". on_screen_text is only the words that appear as captions or titles, verbatim.
- The hook is the first scene. The CTA is the last.

Return JSON only, no markdown, matching exactly:
{"title": string, "logline": string, "hook": string, "scenes": [{"start": number, "end": number, "visual": string, "audio": string, "on_screen_text": string, "sfx_music": string}], "cta": string, "shot_list": string[], "music_note": string, "spoken_words": number}`;

function toSeconds(d) {
  const m = /^(\d+)\s*(s|min)$/.exec(d);
  if (!m) return 30;
  return m[2] === 'min' ? Number(m[1]) * 60 : Number(m[1]);
}
const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

function normalize(total) {
  return json => {
    const scenes = A(json.scenes).map(sc => ({ start: N(sc.start), end: N(sc.end), visual: S(sc.visual), audio: S(sc.audio), on_screen_text: S(sc.on_screen_text), sfx_music: S(sc.sfx_music) })).filter(sc => sc.visual || sc.audio);
    if (!scenes.length) throw new Error('no scenes');
    scenes.forEach(sc => { sc.start = Math.min(sc.start, total); sc.end = Math.min(Math.max(sc.end, sc.start), total); sc.time = fmt(sc.start) + ' – ' + fmt(sc.end); });
    return { title: S(json.title), logline: S(json.logline), hook: S(json.hook), scenes, cta: S(json.cta), shot_list: AS(json.shot_list), music_note: S(json.music_note), spoken_words: N(json.spoken_words), duration: fmt(total) };
  };
}

async function write({ brief, type, duration, lang, tone, platform, context = '' }) {
  const t = byId(type) || TYPES[0];
  const d = DURATIONS.includes(duration) ? duration : '30s';
  const total = toSeconds(d);
  const l = LANGS.includes(lang) ? lang : 'English';
  const tn = TONES.includes(tone) ? tone : 'Editorial';
  const user = `Brief:\n${brief}${context}\n\nFormat: ${t.name}. ${t.note}\nDuration: ${d} (${total} seconds total; the last scene ends at ${total})\nLanguage of spoken words and captions: ${l}\nTone: ${tn}${platform ? '\nPlatform: ' + S(platform) : ''}\n\nWrite the script.`;
  const { data, provider, model } = await generateJSON(SYSTEM, user, normalize(total));
  return { script: data, provider, model };
}

module.exports = { TYPES: TYPES.map(({ id, name }) => ({ id, name })), DURATIONS, LANGS, TONES, write };
