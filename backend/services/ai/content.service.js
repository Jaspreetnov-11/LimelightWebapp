'use strict';
// Content writing, social media: captions, hooks, hashtags, CTA per platform.
const { generateJSON, S, A, AS } = require('./llm');
const { BRAND_RULES, WRITING_RULES } = require('./brand');

const PLATFORMS = [
  { id: 'instagram', name: 'Instagram', sub: 'Feed · Reels · Stories', guidance: "Caption up to 2,200 characters, but the first 125 carry the hook (shown before 'more'). Short lines with breaks. 5-8 hashtags at the end, mixed reach. Emojis sparingly and on-brand. For Reels the hook is the spoken or on-screen first line; end with a save/share ask." },
  { id: 'facebook', name: 'Facebook', sub: 'Page posts', guidance: '40-120 words, conversational, a question drives comments. 0-3 hashtags.' },
  { id: 'linkedin', name: 'LinkedIn', sub: 'Posts · Articles', guidance: "Professional but human, first person. A one-line hook, then short paragraphs separated by blank lines, 120-200 words. 3-5 hashtags. No clickbait. End with a point of view or a real question." },
  { id: 'x', name: 'X (Twitter)', sub: 'Posts · Threads', guidance: 'Under 280 characters, one idea, punchy. 0-2 hashtags. If a thread is warranted, give 3-5 numbered posts with the payoff in post 1.' },
  { id: 'youtube_shorts', name: 'YouTube Shorts', sub: 'Titles · Descriptions', guidance: 'Title under 60 characters, keyword first. Description 2-3 lines with #Shorts plus 2-4 hashtags. Hook is the spoken first line, under 8 words.' },
  { id: 'whatsapp', name: 'WhatsApp', sub: 'Status · Broadcast', guidance: 'Reads like a message from a person: 40-80 words, plain text, at most 2 emojis, no hashtags, one link at most, a soft ask at the end.' }
];
const TONES = ['Editorial', 'Warm', 'Bold', 'Playful', 'Corporate'];
const LANGS = ['English', 'Hindi', 'Hinglish', 'Punjabi'];
const byId = id => PLATFORMS.find(p => p.id === id);

const SYSTEM = `You are the content lead at Limelight. A client gives you one brief; you write ready-to-post copy for each social platform they choose, all carrying one angle, each in that platform's own rhythm.

${BRAND_RULES}

${WRITING_RULES}
- Decide the angle first, then write every post from it. No two platforms get the same text reworded.
- Hashtags only where the platform uses them, no spaces, no more than the platform norm.
- visual is a note for the designer, not a prompt.

Return JSON only, no markdown, matching exactly:
{"angle": string, "posts": [{"platform": string, "format": string, "hook": string, "caption": string, "cta": string, "hashtags": string[], "visual": string, "best_time": string}]}`;

function normalize(valid) {
  return json => {
    const posts = A(json.posts).map(p => ({ platform: S(p.platform), format: S(p.format), hook: S(p.hook), caption: S(p.caption), cta: S(p.cta), hashtags: AS(p.hashtags), visual: S(p.visual), best_time: S(p.best_time) }))
      .filter(p => valid.has(p.platform) && p.caption);
    if (!posts.length) throw new Error('no posts');
    return { angle: S(json.angle), posts };
  };
}

async function write({ brief, platforms, tone, lang, variants, context = '' }) {
  const ids = AS(platforms).filter(byId);
  const chosen = (ids.length ? ids : ['instagram', 'linkedin', 'facebook']).map(byId);
  const t = TONES.includes(tone) ? tone : 'Editorial';
  const l = LANGS.includes(lang) ? lang : 'English';
  const n = Math.min(3, Math.max(1, Number(variants) || 1));
  const blocks = chosen.map(p => `### ${p.id} (${p.name})\n${p.guidance}`);
  const user = `Brief:\n${brief}${context}\n\nTone: ${t}\nLanguage: ${l}\nPosts per platform: ${n}${n > 1 ? ' (each a different format or hook)' : ''}\n\nPlatforms, in this order, using each id exactly:\n\n${blocks.join('\n\n')}`;
  const { data, provider, model } = await generateJSON(SYSTEM, user, normalize(new Set(chosen.map(p => p.id))));
  return { pack: data, provider, model };
}

module.exports = { PLATFORMS: PLATFORMS.map(({ id, name, sub }) => ({ id, name, sub })), PLATFORM_GUIDE: PLATFORMS, TONES, LANGS, write };
