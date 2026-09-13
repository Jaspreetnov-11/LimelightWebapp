'use strict';
// Scheduling: a 7/14/30-day posting calendar with a caption per slot.
const { generateJSON, S, A, AS, N } = require('./llm');
const { BRAND_RULES, WRITING_RULES } = require('./brand');
const content = require('./content.service');

const SYSTEM = `You are the social media manager at Limelight. A client gives you a campaign brief, a date range, platforms and a cadence; you build the full posting calendar with ready captions.

${BRAND_RULES}

${WRITING_RULES}
Planning:
- Define 3-4 content pillars that ladder to the brief. Rotate them so no pillar repeats on consecutive days on the same platform.
- Spread posts evenly across the range at the cadence asked. Never two posts on the same platform on the same day. Weekday evenings for Instagram and Facebook (18:30-20:30 IST), weekday mornings for LinkedIn (08:30-10:00 IST), lunchtime for X (12:30-13:30 IST). Shorts and Reels on Fridays and weekends.
- Vary formats across the week. Open with a strong hook post, put the key announcement in the first third, close with a wrap-up.
- Every caption is complete and pasteable. asset is a one-line brief for the designer or videographer.

Return JSON only, no markdown, matching exactly:
{"campaign": string, "strategy": string, "posts": [{"day": number, "time": string, "platform": string, "format": string, "pillar": string, "title": string, "caption": string, "hashtags": string[], "asset": string}]}`;

function normalize(valid, days) {
  return json => {
    const posts = A(json.posts).map(p => ({ day: Math.round(N(p.day)), time: S(p.time) || '19:00', platform: S(p.platform), format: S(p.format), pillar: S(p.pillar), title: S(p.title), caption: S(p.caption), hashtags: AS(p.hashtags), asset: S(p.asset) }))
      .filter(p => valid.has(p.platform) && p.day >= 0 && p.day < days && p.caption)
      .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
    if (!posts.length) throw new Error('no posts');
    return { campaign: S(json.campaign) || 'Campaign', strategy: S(json.strategy), posts };
  };
}

async function build({ brief, platforms, days, perWeek, lang, start, context = '' }) {
  const ids = AS(platforms).filter(id => content.PLATFORM_GUIDE.some(p => p.id === id));
  const chosen = (ids.length ? ids : ['instagram', 'facebook', 'linkedin']).map(id => content.PLATFORM_GUIDE.find(p => p.id === id));
  const d = [7, 14, 30].includes(Number(days)) ? Number(days) : 14;
  const pw = Math.min(7, Math.max(1, Number(perWeek) || 3));
  const l = content.LANGS.includes(lang) ? lang : 'English';
  const st = /^\d{4}-\d{2}-\d{2}$/.test(String(start || '')) ? String(start) : new Date().toISOString().slice(0, 10);
  const total = Math.max(1, Math.round((d / 7) * pw * chosen.length));
  const blocks = chosen.map(p => `### ${p.id} (${p.name})\n${p.guidance}`);
  const user = `Campaign brief:\n${brief}${context}\n\nStart date: ${st} (day 0)\nLength: ${d} days\nCadence: ${pw} posts per platform per week, so about ${total} posts in total\nLanguage: ${l}\n\nPlatforms, using each id exactly:\n\n${blocks.join('\n\n')}`;
  const { data, provider, model } = await generateJSON(SYSTEM, user, normalize(new Set(chosen.map(p => p.id)), d));
  return { plan: data, start: st, provider, model };
}

module.exports = { build };
