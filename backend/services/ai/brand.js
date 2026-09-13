'use strict';
// Brand and craft rules shared by every AI agent. Keep stable.

const BRAND_RULES = `Brand: Limelight, a brand strategy and creative agency.
- Palette: black and white do the work. Yellow #FCD30A is a single small spark accent (a dot, a rule, one word, one object), never a flood or a background.
- Voice: clean, editorial, confident. Magazine cover, not marketplace flyer.
- Never clip-art, never stock-photo clichés (handshakes, lightbulbs, rocket ships, generic smiling groups, floating 3D icons).
- No real named people, no copyrighted characters, no third-party logos. Client logos arrive as reference images and get reserved space, not redrawn.
- India-first audience: cultural details must be accurate and specific (festival objects, dress, architecture, scripts). Nothing generic or orientalist.
- Never invent facts: no addresses, prices, dates, phone numbers, timings, names or claims that are not in the brief. Where a detail is needed but missing, write a placeholder in square brackets like [address] or [price].`;

const WRITING_RULES = `Writing:
- Specific beats generic. Concrete nouns, real details from the brief. No "elevate", "unlock", "journey", "seamless", "stunning".
- Hooks are the first line and must work alone. No "Are you ready?", no rhetorical filler.
- Hindi and Punjabi in their own script unless Hinglish is asked, in which case write Roman-script Hindi the way people type on phones.
- Write in English unless a language is given.`;

module.exports = { BRAND_RULES, WRITING_RULES };
