'use client';
// AI Agent: four tools on one screen. Prompt studio, Content writing (social + scripts), Scheduling, Ads.
// All calls go through AiModel -> /api/ai/* (Gemini free tier on the server). Nothing here posts to any platform.
import { useEffect, useMemo, useState } from 'react';
import { AiModel } from '@/models';
import { useUi } from '@/controllers/UiController';
import { Chip, Icon, SectionTitle, Seg, Tabs } from '@/views/ui';

const TABS = [['prompts', 'Prompt studio'], ['content', 'Content writing'], ['schedule', 'Scheduling'], ['ads', 'Ads']];
const LS_TAB = 'lh-ai-tab', LS_SCHED = 'lh-ai-schedule';

/* ---------- small pieces ---------- */
function Sec({ n, title, right }) {
  return <div className="ai-sec"><span className="n">{n}</span><span className="sl">/</span><span>{title}</span>{right && <span className="r">{right}</span>}</div>;
}
function Tile({ on, onClick, title, sub, letter, disabled }) {
  return (
    <button type="button" className={'ai-tile' + (on ? ' on' : '')} onClick={onClick} disabled={disabled} aria-pressed={on}>
      <span className="ic">{letter}</span><span><b>{title}</b>{sub && <small>{sub}</small>}</span><span className="box"></span>
    </button>
  );
}
function Tiles({ items, value, onChange, disabled }) {
  const toggle = id => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  return <div className="ai-tiles">{items.map(t => <Tile key={t.id} on={value.includes(t.id)} onClick={() => toggle(t.id)} title={t.name} sub={t.sub || t.free} letter={t.name[0]} disabled={disabled} />)}</div>;
}
function Field({ label, children }) { return <div className="field"><label>{label}</label>{children}</div>; }
function Select({ value, onChange, options, disabled }) {
  return <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>{options.map(o => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>)}</select>;
}
function Writing({ label = 'Writing' }) {
  return <div className="ai-writing" role="status"><div className="lines"><i /><i /><i /><i /><span className="cur" /></div><p>{label}<b>.</b><b>.</b><b>.</b></p></div>;
}
function Empty({ children }) { return <div className="ai-empty">{children}</div>; }
function useCopy() {
  const { toast } = useUi();
  return async text => { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch (e) { toast('Copy blocked. Select the text and press Ctrl+C.'); } };
}
function CopyBtn({ text, children = 'Copy', small }) {
  const copy = useCopy();
  return <button type="button" className="date-btn" style={small ? { height: 28, fontSize: 11.5 } : undefined} onClick={() => copy(text)}><Icon name="copy" />{children}</button>;
}
function Brief({ value, onChange, placeholder, disabled, max = 4000 }) {
  return (
    <>
      <textarea value={value} onChange={e => onChange(e.target.value.slice(0, max))} placeholder={placeholder} disabled={disabled} style={{ minHeight: 120 }} />
      <div className="ai-meta"><span>Name the audience and the one thing they should do.</span><span>{value.length}/{max}</span></div>
    </>
  );
}
function Run({ busy, disabled, onClick, children }) {
  return <button type="button" className="btn btn-primary ai-cta" onClick={onClick} disabled={busy || disabled}><Icon name="spark" />{busy ? 'Writing…' : children}</button>;
}
function useRun(fn) {
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  const run = async (...a) => { setBusy(true); try { setOut(await fn(...a)); } catch (e) { toast(e.message || 'Failed'); } finally { setBusy(false); } };
  return { busy, out, setOut, run };
}

/* ---------- 1. Prompt studio ---------- */
function PromptsTab({ meta }) {
  const [brief, setBrief] = useState('');
  const [picked, setPicked] = useState(meta.prompts.defaults);
  const [open, setOpen] = useState({});
  const { busy, out, run } = useRun(() => AiModel.prompts({ brief, targets: picked }));
  const name = id => (meta.prompts.targets.find(t => t.id === id) || {}).name || id;
  const url = id => (meta.prompts.targets.find(t => t.id === id) || {}).url;
  const pack = out && out.pack;
  useEffect(() => { if (pack) setOpen(Object.fromEntries(pack.targets.slice(0, 2).map(t => [t.id, true]))); }, [pack]);
  const all = pack ? pack.targets.map(t => '## ' + name(t.id) + '\n' + t.prompt + t.extras.map(x => '\n\n' + x.label + ':\n' + x.value).join('')).join('\n\n') : '';
  return (
    <div className="ai-grid">
      <div className="ai-stack">
        <div className="panel ai-p"><Sec n="01" title="Your brief" /><Brief value={brief} onChange={setBrief} disabled={busy} placeholder="What do you want to create? Subject, mood, text that must appear, where it will be used…" /></div>
        <div className="panel ai-p">
          <Sec n="02" title="Select tools" right={<><span className="dot" />{picked.length} selected</>} />
          <Tiles items={meta.prompts.targets} value={picked} onChange={setPicked} disabled={busy} />
          <Run busy={busy} disabled={!brief.trim() || !picked.length} onClick={run}>Generate prompts</Run>
        </div>
      </div>
      <div className="panel ai-p">
        <div className="ai-out-h"><b style={{ fontSize: 15 }}>Your prompts</b>{pack && <Chip tone="gr">{pack.targets.length} generated</Chip>}<span className="grow" />{pack && <CopyBtn text={all}>Copy all</CopyBtn>}</div>
        {busy ? <Writing /> : !pack ? <Empty>Write a brief, pick tools, generate.<br /><small>Copy each prompt into the tool's free app.</small></Empty> : (
          <>
            <div className="ai-dir"><Icon name="spark" style={{ color: 'var(--accent)', width: 18, height: 18, flex: 'none' }} /><div><div className="lab">Creative direction</div><div>{pack.concept}</div></div></div>
            {pack.targets.map(t => (
              <div className="ai-card" key={t.id}>
                <div className="ai-card-h"><b>{name(t.id)}</b>
                  {open[t.id] ? <span className="acts"><CopyBtn text={t.prompt}>Copy prompt</CopyBtn>{url(t.id) && <a className="date-btn" href={url(t.id)} target="_blank" rel="noopener noreferrer">Open ↗</a>}</span>
                    : <button type="button" className="link" style={{ marginLeft: 'auto' }} onClick={() => setOpen(o => ({ ...o, [t.id]: true }))}>Show prompt ⌄</button>}
                </div>
                {open[t.id] && (
                  <>
                    <pre className="ai-text">{t.prompt}</pre>
                    {t.settings.length > 0 && <div className="ai-chips">{t.settings.map((s, i) => <Chip key={i} tone="gy">{s.label}: <b style={{ color: 'var(--accent)' }}>{s.value}</b></Chip>)}</div>}
                    {t.extras.map((x, i) => <div key={i}><div className="ai-lab"><span>{x.label}</span><CopyBtn text={x.value} small>Copy</CopyBtn></div><pre className="ai-text">{x.value}</pre></div>)}
                    {t.tip && <div className="ai-tip">⚡ <span>Tip: {t.tip}</span></div>}
                    <button type="button" className="link" style={{ marginTop: 8 }} onClick={() => setOpen(o => ({ ...o, [t.id]: false }))}>Hide ⌃</button>
                  </>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- 2a. Content writing: social media ---------- */
function SocialTab({ meta }) {
  const [brief, setBrief] = useState('');
  const [picked, setPicked] = useState(['instagram', 'linkedin', 'facebook']);
  const [tone, setTone] = useState('Editorial');
  const [lang, setLang] = useState('English');
  const [variants, setVariants] = useState('1');
  const { busy, out, run } = useRun(() => AiModel.content({ brief, platforms: picked, tone, lang, variants: Number(variants) }));
  const name = id => (meta.content.platforms.find(p => p.id === id) || {}).name || id;
  const pack = out && out.pack;
  const text = p => p.caption + (p.hashtags.length ? '\n\n' + p.hashtags.join(' ') : '');
  const all = pack ? pack.posts.map(p => '## ' + name(p.platform) + ' · ' + p.format + '\n' + text(p)).join('\n\n') : '';
  return (
    <div className="ai-grid">
      <div className="ai-stack">
        <div className="panel ai-p"><Sec n="01" title="Your brief" /><Brief value={brief} onChange={setBrief} disabled={busy} placeholder="What are we posting about? Product, offer, event, story, audience, what they should do…" /></div>
        <div className="panel ai-p"><Sec n="02" title="Platforms" right={<><span className="dot" />{picked.length} selected</>} /><Tiles items={meta.content.platforms} value={picked} onChange={setPicked} disabled={busy} /></div>
        <div className="panel ai-p">
          <Sec n="03" title="Style" />
          <div className="ai-fields">
            <Field label="Tone"><Select value={tone} onChange={setTone} options={meta.content.tones} disabled={busy} /></Field>
            <Field label="Language"><Select value={lang} onChange={setLang} options={meta.content.langs} disabled={busy} /></Field>
            <Field label="Posts / platform"><Select value={variants} onChange={setVariants} options={['1', '2', '3']} disabled={busy} /></Field>
          </div>
          <Run busy={busy} disabled={!brief.trim() || !picked.length} onClick={run}>Generate content</Run>
        </div>
      </div>
      <div className="panel ai-p">
        <div className="ai-out-h"><b style={{ fontSize: 15 }}>Your posts</b>{pack && <Chip tone="gr">{pack.posts.length} posts</Chip>}<span className="grow" />{pack && <CopyBtn text={all}>Copy all</CopyBtn>}</div>
        {busy ? <Writing /> : !pack ? <Empty>Brief, platforms, style, generate.</Empty> : (
          <>
            <div className="ai-dir"><Icon name="spark" style={{ color: 'var(--accent)', width: 18, height: 18, flex: 'none' }} /><div><div className="lab">Angle</div><div>{pack.angle}</div></div></div>
            {pack.posts.map((p, i) => (
              <div className="ai-card" key={i}>
                <div className="ai-card-h"><b>{name(p.platform)}</b><Chip tone="gy">{p.format}</Chip>{p.best_time && <Chip tone="gy">{p.best_time}</Chip>}<span className="acts"><CopyBtn text={text(p)}>Copy post</CopyBtn></span></div>
                <div className="ai-tip">Hook: <span style={{ color: 'var(--text)' }}>{p.hook}</span></div>
                <pre className="ai-text">{p.caption}</pre>
                {p.hashtags.length > 0 && <div className="ai-chips">{p.hashtags.map((h, k) => <Chip key={k} tone="pu">{h}</Chip>)}</div>}
                <div className="ai-chips"><Chip tone="gy">CTA: <b style={{ color: 'var(--accent)' }}>{p.cta}</b></Chip></div>
                {p.visual && <div className="ai-meta" style={{ marginTop: 8 }}><span>Visual: {p.visual}</span></div>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- 2b. Content writing: scripts ---------- */
function ScriptTab({ meta }) {
  const [brief, setBrief] = useState('');
  const [type, setType] = useState('reel');
  const [duration, setDuration] = useState('30s');
  const [lang, setLang] = useState('English');
  const [tone, setTone] = useState('Editorial');
  const { busy, out, run } = useRun(() => AiModel.script({ brief, type, duration, lang, tone }));
  const s = out && out.script;
  const all = s ? [s.title, s.logline, '', 'HOOK: ' + s.hook, '', ...s.scenes.map(sc => `[${sc.time}]\nVISUAL: ${sc.visual}\nAUDIO: ${sc.audio}${sc.on_screen_text ? '\nON SCREEN: ' + sc.on_screen_text : ''}${sc.sfx_music ? '\nSFX/MUSIC: ' + sc.sfx_music : ''}`), '', 'CTA: ' + s.cta].join('\n') : '';
  return (
    <div className="ai-grid">
      <div className="ai-stack">
        <div className="panel ai-p"><Sec n="01" title="Your brief" /><Brief value={brief} onChange={setBrief} disabled={busy} placeholder="What is the film about? Product, story, who speaks, key message, must-show moments…" /></div>
        <div className="panel ai-p">
          <Sec n="02" title="Format" />
          <div className="ai-fields">
            <Field label="Type"><Select value={type} onChange={setType} options={meta.script.types.map(t => [t.id, t.name])} disabled={busy} /></Field>
            <Field label="Duration"><Select value={duration} onChange={setDuration} options={meta.script.durations} disabled={busy} /></Field>
            <Field label="Language"><Select value={lang} onChange={setLang} options={meta.script.langs} disabled={busy} /></Field>
            <Field label="Tone"><Select value={tone} onChange={setTone} options={meta.script.tones} disabled={busy} /></Field>
          </div>
          <Run busy={busy} disabled={!brief.trim()} onClick={run}>Write script</Run>
        </div>
      </div>
      <div className="panel ai-p">
        <div className="ai-out-h"><b style={{ fontSize: 15 }}>{s ? s.title : 'Your script'}</b>{s && <Chip tone="gr">{s.duration} · {s.scenes.length} scenes</Chip>}{s && s.spoken_words > 0 && <Chip tone="gy">~{s.spoken_words} spoken words</Chip>}<span className="grow" />{s && <CopyBtn text={all}>Copy script</CopyBtn>}</div>
        {busy ? <Writing /> : !s ? <Empty>Brief, type, duration, write.</Empty> : (
          <>
            <div className="ai-dir"><Icon name="spark" style={{ color: 'var(--accent)', width: 18, height: 18, flex: 'none' }} /><div><div className="lab">Logline</div><div>{s.logline}</div></div></div>
            <div className="ai-tip">Hook: <span style={{ color: 'var(--text)' }}>{s.hook}</span></div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ai-scenes"><thead><tr><th>Time</th><th>Visual</th><th>Audio</th><th>On screen</th><th>SFX / music</th></tr></thead>
                <tbody>{s.scenes.map((sc, i) => <tr key={i}><td className="t">{sc.time}</td><td>{sc.visual}</td><td>{sc.audio}</td><td>{sc.on_screen_text || '—'}</td><td>{sc.sfx_music || '—'}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="ai-chips"><Chip tone="pu">CTA: {s.cta}</Chip>{s.music_note && <Chip tone="gy">Music: {s.music_note}</Chip>}</div>
            {s.shot_list.length > 0 && <><div className="ai-lab"><span>Shot list</span></div><ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--t2)' }}>{s.shot_list.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
          </>
        )}
      </div>
    </div>
  );
}

function ContentTab({ meta }) {
  const [mode, setMode] = useState('social');
  return (
    <div className="ai-stack">
      <div className="ai-head"><Seg items={[['social', 'Social media'], ['script', 'Script writing']]} value={mode} onChange={setMode} /><span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{mode === 'social' ? 'Captions, hooks, hashtags and CTA per platform.' : 'Time-coded script for reels, videos, ad films and explainers.'}</span></div>
      {mode === 'social' ? <SocialTab meta={meta} /> : <ScriptTab meta={meta} />}
    </div>
  );
}

/* ---------- 3. Scheduling ---------- */
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, d) => { const t = new Date(iso + 'T00:00:00'); t.setDate(t.getDate() + d); return t; };
const pad = n => String(n).padStart(2, '0');
const fmtDay = d => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
function gcal(d, time, title, details) {
  const m = /(\d{1,2}):(\d{2})/.exec(time); const s = new Date(d); s.setHours(m ? Number(m[1]) : 19, m ? Number(m[2]) : 0, 0, 0); const e = new Date(s.getTime() + 30 * 60000);
  const f = x => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${f(s)}/${f(e)}&details=${encodeURIComponent(details)}`;
}
function csv(plan, start) {
  const q = s => '"' + String(s).replace(/"/g, '""') + '"';
  const rows = [['date', 'time', 'platform', 'format', 'pillar', 'title', 'caption', 'hashtags', 'asset']];
  for (const p of plan.posts) { const d = addDays(start, p.day); rows.push([`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, p.time, p.platform, p.format, p.pillar, p.title, p.caption, p.hashtags.join(' '), p.asset]); }
  return rows.map(r => r.map(q).join(',')).join('\n');
}
function ScheduleTab({ meta }) {
  const [brief, setBrief] = useState('');
  const [picked, setPicked] = useState(['instagram', 'facebook', 'linkedin']);
  const [start, setStart] = useState(today());
  const [days, setDays] = useState('14');
  const [perWeek, setPerWeek] = useState('3');
  const [lang, setLang] = useState('English');
  const [saved, setSaved] = useState(null);
  const [openIdx, setOpenIdx] = useState(null);
  const name = id => (meta.content.platforms.find(p => p.id === id) || {}).name || id;
  useEffect(() => { try { const raw = localStorage.getItem(LS_SCHED); if (raw) setSaved(JSON.parse(raw)); } catch (e) { /* ignore */ } }, []);
  const persist = next => { setSaved(next); try { next ? localStorage.setItem(LS_SCHED, JSON.stringify(next)) : localStorage.removeItem(LS_SCHED); } catch (e) { /* ignore */ } };
  const { busy, run } = useRun(async () => { const r = await AiModel.schedule({ brief, platforms: picked, days: Number(days), perWeek: Number(perWeek), lang, start }); persist({ plan: r.plan, start: r.start, done: {} }); setOpenIdx(null); return r; });
  const groups = useMemo(() => { if (!saved) return []; const m = new Map(); saved.plan.posts.forEach((p, i) => { if (!m.has(p.day)) m.set(p.day, []); m.get(p.day).push({ i, p }); }); return [...m.entries()].sort((a, b) => a[0] - b[0]); }, [saved]);
  const doneCount = saved ? Object.values(saved.done).filter(Boolean).length : 0;
  const text = p => p.caption + (p.hashtags.length ? '\n\n' + p.hashtags.join(' ') : '');
  return (
    <div className="ai-grid">
      <div className="ai-stack">
        <div className="panel ai-p"><Sec n="01" title="Campaign brief" /><Brief value={brief} onChange={setBrief} disabled={busy} placeholder="What is the campaign? Launch, festival, offer, event. Who is it for, key dates…" /></div>
        <div className="panel ai-p"><Sec n="02" title="Platforms" right={<><span className="dot" />{picked.length} selected</>} /><Tiles items={meta.content.platforms} value={picked} onChange={setPicked} disabled={busy} /></div>
        <div className="panel ai-p">
          <Sec n="03" title="Plan" />
          <div className="ai-fields">
            <Field label="Start date"><input type="date" value={start} onChange={e => setStart(e.target.value)} disabled={busy} /></Field>
            <Field label="Length"><Select value={days} onChange={setDays} options={[['7', '7 days'], ['14', '14 days'], ['30', '30 days']]} disabled={busy} /></Field>
            <Field label="Posts / week / platform"><Select value={perWeek} onChange={setPerWeek} options={['1', '2', '3', '4', '5', '7']} disabled={busy} /></Field>
            <Field label="Language"><Select value={lang} onChange={setLang} options={meta.content.langs} disabled={busy} /></Field>
          </div>
          <Run busy={busy} disabled={!brief.trim() || !picked.length} onClick={run}>Build calendar</Run>
          <div className="ai-meta"><span>Posting happens in each platform's app. Meta Business Suite schedules Instagram and Facebook free; the CSV imports into Buffer, Later or a sheet.</span></div>
        </div>
      </div>
      <div className="panel ai-p">
        <div className="ai-out-h"><b style={{ fontSize: 15 }}>{saved ? saved.plan.campaign : 'Your calendar'}</b>{saved && <Chip tone="gr">{doneCount}/{saved.plan.posts.length} posted</Chip>}<span className="grow" />
          {saved && <><a className="date-btn" href={'data:text/csv;charset=utf-8,' + encodeURIComponent(csv(saved.plan, saved.start))} download={saved.plan.campaign.replace(/\s+/g, '-').toLowerCase() + '-calendar.csv'}><Icon name="down" />Export CSV</a><button type="button" className="date-btn" onClick={() => persist(null)}>Clear</button></>}
        </div>
        {busy ? <Writing label="Planning" /> : !saved ? <Empty>Your calendar appears here.<br /><small>It stays saved in this browser, with a posted checkbox per item.</small></Empty> : (
          <>
            <div className="ai-dir"><Icon name="spark" style={{ color: 'var(--accent)', width: 18, height: 18, flex: 'none' }} /><div><div className="lab">Strategy</div><div>{saved.plan.strategy}</div></div></div>
            {groups.map(([day, items]) => { const d = addDays(saved.start, day); return (
              <div className="ai-day" key={day}>
                <div className="ai-day-h"><span>{fmtDay(d)}</span><i /><span>Day {day + 1}</span></div>
                {items.map(({ i, p }) => { const done = !!saved.done[i]; const isOpen = openIdx === i; return (
                  <div className={'ai-post' + (done ? ' done' : '')} key={i}>
                    <div className="ai-post-row"><span className="time">{p.time}</span><span className="title">{p.title}</span><Chip tone="gy">{name(p.platform)}</Chip><Chip tone="gy">{p.format}</Chip>
                      <label><input type="checkbox" checked={done} onChange={e => persist({ ...saved, done: { ...saved.done, [i]: e.target.checked } })} /> posted</label>
                      <button type="button" className="link" onClick={() => setOpenIdx(isOpen ? null : i)}>{isOpen ? 'Hide ⌃' : 'Open ⌄'}</button>
                    </div>
                    {isOpen && (
                      <div style={{ marginTop: 8 }}>
                        <pre className="ai-text" style={{ marginTop: 0 }}>{p.caption}</pre>
                        {p.hashtags.length > 0 && <div className="ai-chips">{p.hashtags.map((h, k) => <Chip key={k} tone="pu">{h}</Chip>)}</div>}
                        <div className="ai-chips"><Chip tone="gy">Pillar: {p.pillar}</Chip>{p.asset && <Chip tone="gy">Asset: {p.asset}</Chip>}</div>
                        <div className="ai-chips" style={{ gap: 8 }}><CopyBtn text={text(p)}>Copy caption</CopyBtn><a className="date-btn" href={gcal(d, p.time, name(p.platform) + ': ' + p.title, text(p))} target="_blank" rel="noopener noreferrer"><Icon name="cal" />Google Calendar</a></div>
                      </div>
                    )}
                  </div>
                ); })}
              </div>
            ); })}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- 4. Ads ---------- */
function AdsTab({ meta }) {
  const [brief, setBrief] = useState('');
  const [picked, setPicked] = useState(['meta', 'google_search']);
  const [objective, setObjective] = useState('Leads');
  const [budget, setBudget] = useState('');
  const [audience, setAudience] = useState('');
  const [lang, setLang] = useState('English');
  const { busy, out, run } = useRun(() => AiModel.ads({ brief, platforms: picked, objective, budget, audience, lang }));
  const name = id => (meta.ads.platforms.find(p => p.id === id) || {}).name || id;
  const a = out && out.ads;
  const vText = v => ['Angle: ' + v.angle, 'Headlines:', ...v.headlines.map(h => '  - ' + h), 'Primary text:', v.primary_text, 'Descriptions:', ...v.descriptions.map(d => '  - ' + d), 'CTA: ' + v.cta].join('\n');
  const all = a ? a.sets.map(s => '## ' + name(s.platform) + '\n' + s.variants.map(vText).join('\n\n') + (s.targeting.length ? '\n\nTargeting:\n' + s.targeting.map(t => '  - ' + t).join('\n') : '')).join('\n\n') : '';
  return (
    <div className="ai-grid">
      <div className="ai-stack">
        <div className="panel ai-p"><Sec n="01" title="Your brief" /><Brief value={brief} onChange={setBrief} disabled={busy} placeholder="What are we advertising? Offer, product, who it is for, what makes it different, landing page…" /></div>
        <div className="panel ai-p"><Sec n="02" title="Platforms" right={<><span className="dot" />{picked.length} selected</>} /><Tiles items={meta.ads.platforms} value={picked} onChange={setPicked} disabled={busy} /></div>
        <div className="panel ai-p">
          <Sec n="03" title="Campaign" />
          <div className="ai-fields">
            <Field label="Objective"><Select value={objective} onChange={setObjective} options={meta.ads.objectives} disabled={busy} /></Field>
            <Field label="Monthly budget (optional)"><input type="text" value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g. ₹30,000" disabled={busy} /></Field>
            <Field label="Language"><Select value={lang} onChange={setLang} options={meta.ads.langs} disabled={busy} /></Field>
          </div>
          <Field label="Audience notes (optional)"><textarea value={audience} onChange={e => setAudience(e.target.value)} placeholder="Who exactly, where, what they already tried…" disabled={busy} style={{ minHeight: 70 }} /></Field>
          <Run busy={busy} disabled={!brief.trim() || !picked.length} onClick={run}>Write ads</Run>
        </div>
      </div>
      <div className="panel ai-p">
        <div className="ai-out-h"><b style={{ fontSize: 15 }}>Your ads</b>{a && <Chip tone="gr">{a.sets.reduce((n, s) => n + s.variants.length, 0)} variants</Chip>}<span className="grow" />{a && <CopyBtn text={all}>Copy all</CopyBtn>}</div>
        {busy ? <Writing /> : !a ? <Empty>Brief, platforms, objective, write.<br /><small>Paste into Ads Manager or Google Ads.</small></Empty> : (
          <>
            <div className="ai-dir"><Icon name="spark" style={{ color: 'var(--accent)', width: 18, height: 18, flex: 'none' }} /><div><div className="lab">Strategy</div><div>{a.strategy}</div></div></div>
            {a.sets.map((s, i) => (
              <div key={i}>
                <div className="ai-lab" style={{ marginTop: 14 }}><span>{name(s.platform)}</span></div>
                {s.variants.map((v, k) => (
                  <div className="ai-card" key={k}>
                    <div className="ai-card-h"><b>Variant {k + 1}</b><Chip tone="pu">{v.angle}</Chip><span className="acts"><CopyBtn text={vText(v)}>Copy</CopyBtn></span></div>
                    {v.headlines.length > 0 && <><div className="ai-lab"><span>Headlines</span></div><ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13.5 }}>{v.headlines.map((h, j) => <li key={j}>{h}</li>)}</ul></>}
                    {v.primary_text && <><div className="ai-lab"><span>Primary text</span></div><pre className="ai-text" style={{ marginTop: 4 }}>{v.primary_text}</pre></>}
                    {v.descriptions.length > 0 && <><div className="ai-lab"><span>Descriptions</span></div><ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--t2)' }}>{v.descriptions.map((d, j) => <li key={j}>{d}</li>)}</ul></>}
                    <div className="ai-chips"><Chip tone="gy">CTA: <b style={{ color: 'var(--accent)' }}>{v.cta}</b></Chip></div>
                  </div>
                ))}
                {s.targeting.length > 0 && <><div className="ai-lab"><span>Targeting</span></div><div className="ai-chips" style={{ marginTop: 6 }}>{s.targeting.map((t, j) => <Chip key={j} tone="bl">{t}</Chip>)}</div></>}
                {['exact', 'phrase', 'broad', 'negative'].some(k => s.keywords[k].length > 0) && (
                  <>
                    <div className="ai-lab"><span>Keywords</span><CopyBtn text={['exact', 'phrase', 'broad', 'negative'].map(k => k.toUpperCase() + ':\n' + s.keywords[k].join('\n')).join('\n\n')} small>Copy</CopyBtn></div>
                    {['exact', 'phrase', 'broad', 'negative'].map(k => s.keywords[k].length > 0 && <div className="ai-chips" key={k} style={{ marginTop: 6 }}><Chip tone={k === 'negative' ? 'pk' : 'gy'}>{k}</Chip>{s.keywords[k].map((w, j) => <Chip key={j} tone={k === 'negative' ? 'pk' : 'bl'}>{w}</Chip>)}</div>)}
                  </>
                )}
                {s.creative_note && <div className="ai-tip">⚡ <span>Creative: {s.creative_note}</span></div>}
              </div>
            ))}
            {a.ab_test && <div className="ai-tip" style={{ marginTop: 14 }}>⚡ <span>A/B: {a.ab_test}</span></div>}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- screen ---------- */
export function AiAgentScreen() {
  const [tab, setTab] = useState('prompts');
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { try { const t = localStorage.getItem(LS_TAB); if (t && TABS.some(x => x[0] === t)) setTab(t); } catch (e) { /* ignore */ } }, []);
  useEffect(() => { AiModel.meta().then(setMeta).catch(e => setErr(e.message || 'Could not load')); }, []);
  const pick = t => { setTab(t); try { localStorage.setItem(LS_TAB, t); } catch (e) { /* ignore */ } };
  const live = meta && meta.provider !== 'none';
  return (
    <div className="content">
      <div className="ai-head">
        <SectionTitle>AI Agent</SectionTitle>
        {meta && <Chip tone={live ? 'gr' : 'or'}>{live ? 'Live · ' + (meta.provider === 'gemini' ? 'Gemini' : 'Claude') : 'No key · add GEMINI_API_KEY in .env'}</Chip>}
      </div>
      <Tabs items={TABS} value={tab} onChange={pick} />
      {err && <div className="panel ai-p" style={{ color: 'var(--danger)' }}>{err}</div>}
      {!meta && !err && <Writing label="Loading" />}
      {meta && tab === 'prompts' && <PromptsTab meta={meta} />}
      {meta && tab === 'content' && <ContentTab meta={meta} />}
      {meta && tab === 'schedule' && <ScheduleTab meta={meta} />}
      {meta && tab === 'ads' && <AdsTab meta={meta} />}
    </div>
  );
}
