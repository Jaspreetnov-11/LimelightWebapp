'use strict';
// Prompt studio: one brief -> a ready-to-paste prompt per AI tool, each in that tool's grammar.
const { generateJSON, S, A, AS, KV } = require('./llm');
const { BRAND_RULES } = require('./brand');

const TARGETS = [
  { id: 'gpt_image', name: 'ChatGPT · GPT Image', kind: 'image', url: 'https://chatgpt.com/', free: 'A few images a day on the free plan',
    guidance: 'Natural prose, 60-150 words, one paragraph. Lead with medium and subject, then composition, lighting, palette, mood, and where empty space sits. Any text that must appear goes in double quotes exactly once, with the script named. Say the aspect in words (square, tall portrait, wide). End with one sentence of what to leave out.', extras: [] },
  { id: 'nano_banana', name: 'Gemini · Nano Banana', kind: 'image', url: 'https://gemini.google.com/', free: 'Free in the Gemini app',
    guidance: "Conversational instruction, 40-120 words. Start with 'Create an image of…' for new work, or 'Using the attached image, …' for edits, and say what must stay unchanged. Strong at consistency, edits and realistic light; keep on-image text to two or three words. Name camera, lens and lighting for photo looks. Ask for exactly one image and give the aspect ratio (1:1, 9:16, 16:9).", extras: [] },
  { id: 'ideogram', name: 'Ideogram', kind: 'image', url: 'https://ideogram.ai/', free: 'Daily free credits',
    guidance: 'Best for posters with text. Put the headline in double quotes in the first sentence, then typography (weight, style, placement), layout, palette, background. 40-90 words. Under 6 words of on-image text renders reliably.', extras: [] },
  { id: 'higgsfield', name: 'Higgsfield', kind: 'video', url: 'https://higgsfield.ai/', free: 'Free credits on signup',
    guidance: 'One continuous shot, 5-8 seconds, present tense, 40-80 words. Order: subject and action, camera move (slow dolly in, orbit, crane up, handheld push, whip pan), lens and lighting, mood. Name a Higgsfield camera preset when one fits. No on-screen text, no cuts. If image-to-video, describe only the motion and camera.', extras: [] },
  { id: 'kling', name: 'Kling', kind: 'video', url: 'https://klingai.com/', free: 'Daily free credits',
    guidance: 'Text-to-video, 5 or 10 seconds, 40-90 words. Describe the scene fully, then the single action, then camera movement and lighting. Avoid fast cuts and text. Give aspect ratio and duration.', extras: [] },
  { id: 'suno', name: 'Suno', kind: 'music', url: 'https://suno.com/', free: 'About 10 songs a day free',
    guidance: 'Two parts. STYLE (under 200 characters): genre, mood, tempo in BPM, key instruments, vocal type, language. No artist names. LYRICS: section tags [Intro] [Verse] [Chorus] [Bridge] [Outro]; short singable lines; for Hindi or Punjabi write in the script the singer should pronounce; hook 4-6 words repeated. Instrumental: [Instrumental] only. Also a short TITLE.', extras: ['title', 'style', 'lyrics'] },
  { id: 'elevenlabs', name: 'ElevenLabs', kind: 'voice', url: 'https://elevenlabs.io/', free: '10 minutes a month free',
    guidance: 'A voiceover script ready to paste, 75-150 words. Short sentences, pauses marked with … or line breaks, numbers as words, brand names spelled as pronounced. Before the script, a one-line VOICE note: gender, age, tone, pace, language and accent.', extras: ['voice', 'script'] }
];
const DEFAULT_TARGETS = ['gpt_image', 'nano_banana', 'higgsfield', 'suno'];
const byId = id => TARGETS.find(t => t.id === id);

const SYSTEM = `You are the creative director at Limelight. A client gives you one brief; you write a ready-to-paste prompt for each AI tool they choose. Every prompt carries the same idea, but each is written in the grammar that tool responds to.

${BRAND_RULES}

Craft:
- One idea for the whole pack. Decide it first, write it as the concept, then express it per tool.
- Be concrete. Subject, action, composition, light, palette, mood. Never "beautiful", "stunning", "high quality".
- Text inside images is a liability. Fewest words, in double quotes, script named.
- Fill settings with what the user should set in that tool's interface, and extras only where the tool guidance lists them.

Return JSON only, no markdown, matching exactly:
{"concept": string, "targets": [{"id": string, "prompt": string, "settings": [{"label": string, "value": string}], "extras": [{"label": string, "value": string}], "tip": string}]}`;

function normalize(ids) {
  return json => {
    const map = new Map(A(json.targets).map(t => [S(t.id), t]));
    const targets = ids.map(id => map.get(id)).filter(Boolean).map(t => ({ id: S(t.id), prompt: S(t.prompt), settings: KV(t.settings), extras: KV(t.extras), tip: S(t.tip) }));
    if (!targets.length) throw new Error('no targets');
    return { concept: S(json.concept), targets };
  };
}

async function write({ brief, targets }) {
  const ids = AS(targets).filter(byId);
  const chosen = (ids.length ? ids : DEFAULT_TARGETS).map(byId);
  const blocks = chosen.map(t => `### ${t.id} (${t.name}, ${t.kind})\n${t.guidance}` + (t.extras.length ? `\nRequired extras (use these exact labels): ${t.extras.join(', ')}` : ''));
  const user = `Brief:\n${brief}\n\nWrite one entry per tool, in this order, using each id exactly:\n\n${blocks.join('\n\n')}`;
  const { data, provider, model } = await generateJSON(SYSTEM, user, normalize(chosen.map(t => t.id)));
  return { pack: data, provider, model };
}

module.exports = { TARGETS: TARGETS.map(({ id, name, kind, url, free }) => ({ id, name, kind, url, free })), DEFAULT_TARGETS, write };
