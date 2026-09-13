'use client';
// AI Agent: four tools on one screen. Prompt studio, Content writing (social + scripts), Scheduling, Ads.
// All calls go through AiModel -> /api/ai/* (Gemini free tier on the server). Nothing here posts to any platform.
import { useEffect, useMemo, useState } from 'react';
import { AiModel, EmployeeModel } from '@/models';
import { useUi } from '@/controllers/UiController';
import { Chip, Icon, SectionTitle, Seg, Tabs } from '@/views/ui';

const TABS = [['prompts', 'Prompt studio'], ['content', 'Content writing'], ['schedule', 'Scheduling'], ['ads', 'Ads'], ['deck', 'PPT'], ['history', 'History']];
const TOOL_LABEL = { prompts: 'Prompts', content: 'Social', script: 'Script', schedule: 'Schedule', ads: 'Ads', deck: 'PPT' };
const MIME = { pdf: 'application/pdf', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
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
  return <button type="button" className="btn btn-primary ai-cta" onClick={onClick} disabled={busy || disabled}>{busy ? 'Writing…' : children}</button>;
}
function useRun(fn) {
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  const run = async (...a) => { setBusy(true); try { setOut(await fn(...a)); } catch (e) { toast(e.message || 'Failed'); } finally { setBusy(false); } };
  return { busy, out, setOut, run };
}
function downloadB64(base64, filename, mime) {
  const bytes = atob(base64); const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
/** "Download PDF" for any saved run. */
function PdfBtn({ id, small }) {
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  if (!id) return null;
  const go = async () => { setBusy(true); try { const r = await AiModel.runPdf(id); downloadB64(r.base64, r.filename, MIME.pdf); } catch (e) { toast(e.message || 'PDF failed'); } finally { setBusy(false); } };
  return <button type="button" className="date-btn" style={small ? { height: 28, fontSize: 11.5 } : undefined} onClick={go} disabled={busy}><Icon name="down" />{busy ? 'Preparing…' : 'PDF'}</button>;
}
/** Reference files (PDF, Word, text) the agent reads alongside the brief. Shared list per staff member. */
function RefPicker({ value, onChange, disabled }) {
  const { toast } = useUi();
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = () => AiModel.references().then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const toggle = id => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  const onFile = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    setBusy(true);
    try { const r = await AiModel.referenceUpload(f); await load(); onChange([...value, r.id]); toast('Added: ' + r.name + ' (' + Math.round(r.chars / 1000) + 'k characters)'); }
    catch (err) { toast(err.message || 'Upload failed'); }
    finally { setBusy(false); }
  };
  const remove = async id => { try { await AiModel.referenceDelete(id); onChange(value.filter(x => x !== id)); load(); } catch (err) { toast(err.message || 'Failed'); } };
  return (
    <div>
      <div className="ai-lab" style={{ marginTop: 4 }}><span>References {value.length > 0 && <span style={{ color: 'var(--accent)' }}>· {value.length} attached</span>}</span>
        <label className="date-btn" style={{ height: 28, fontSize: 11.5, cursor: disabled || busy ? 'default' : 'pointer', opacity: disabled ? .5 : 1 }}><Icon name="file" />{busy ? 'Reading…' : 'Upload file'}<input type="file" accept=".pdf,.docx,.txt,.md,.csv,.json,.html" hidden disabled={disabled || busy} onChange={onFile} /></label>
      </div>
      {list.length === 0 ? <div className="ai-meta" style={{ marginTop: 6 }}><span>Brand guidelines, past decks, client notes: upload once, attach to any brief.</span></div> : (
        <div className="ai-chips" style={{ marginTop: 6 }}>
          {list.map(r => (
            <span key={r.id} className={'pill' + (value.includes(r.id) ? ' on' : '')} style={{ height: 28, fontSize: 11.5, paddingRight: 6 }} title={r.kind + ' · ' + r.chars + ' characters'}>
              <button type="button" onClick={() => !disabled && toggle(r.id)} style={{ background: 'none', border: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}>{r.name.length > 28 ? r.name.slice(0, 26) + '…' : r.name}</button>
              <button type="button" onClick={() => remove(r.id)} aria-label="Remove" style={{ background: 'none', border: 0, color: 'inherit', opacity: .6, cursor: 'pointer', padding: '0 2px', fontSize: 12 }}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- 1. Prompt studio ---------- */
function PromptsTab({ meta }) {
  const [brief, setBrief] = useState('');
  const [picked, setPicked] = useState(meta.prompts.defaults);
  const [refs, setRefs] = useState([]);
  const [open, setOpen] = useState({});
  const { busy, out, run } = useRun(() => AiModel.prompts({ brief, targets: picked, refs }));
  const name = id => (meta.prompts.targets.find(t => t.id === id) || {}).name || id;
  const url = id => (meta.prompts.targets.find(t => t.id === id) || {}).url;
  const pack = out && out.pack;
  useEffect(() => { if (pack) setOpen(Object.fromEntries(pack.targets.slice(0, 2).map(t => [t.id, true]))); }, [pack]);
  const all = pack ? pack.targets.map(t => '## ' + name(t.id) + '\n' + t.prompt + t.extras.map(x => '\n\n' + x.label + ':\n' + x.value).join('')).join('\n\n') : '';
  return (
    <div className="ai-grid">
      <div className="ai-stack">
        <div className="panel ai-p"><Sec n="01" title="Your brief" /><Brief value={brief} onChange={setBrief} disabled={busy} placeholder="What do you want to create? Subject, mood, text that must appear, where it will be used…" /><RefPicker value={refs} onChange={setRefs} disabled={busy} /></div>
        <div className="panel ai-p">
          <Sec n="02" title="Select tools" right={<><span className="dot" />{picked.length} selected</>} />
          <Tiles items={meta.prompts.targets} value={picked} onChange={setPicked} disabled={busy} />
          <Run busy={busy} disabled={!brief.trim() || !picked.length} onClick={run}>Generate prompts</Run>
        </div>
      </div>
      <div className="panel ai-p">
        <div className="ai-out-h"><b style={{ fontSize: 15 }}>Your prompts</b>{pack && <Chip tone="gr">{pack.targets.length} generated</Chip>}<span className="grow" />{pack && <PdfBtn id={out.runId} />}{pack && <CopyBtn text={all}>Copy all</CopyBtn>}</div>
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
  const [refs, setRefs] = useState([]);
  const { busy, out, run } = useRun(() => AiModel.content({ brief, platforms: picked, tone, lang, variants: Number(variants), refs }));
  const name = id => (meta.content.platforms.find(p => p.id === id) || {}).name || id;
  const pack = out && out.pack;
  const text = p => p.caption + (p.hashtags.length ? '\n\n' + p.hashtags.join(' ') : '');
  const all = pack ? pack.posts.map(p => '## ' + name(p.platform) + ' · ' + p.format + '\n' + text(p)).join('\n\n') : '';
  return (
    <div className="ai-grid">
      <div className="ai-stack">
        <div className="panel ai-p"><Sec n="01" title="Your brief" /><Brief value={brief} onChange={setBrief} disabled={busy} placeholder="What are we posting about? Product, offer, event, story, audience, what they should do…" /><RefPicker value={refs} onChange={setRefs} disabled={busy} /></div>
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
        <div className="ai-out-h"><b style={{ fontSize: 15 }}>Your posts</b>{pack && <Chip tone="gr">{pack.posts.length} posts</Chip>}<span className="grow" />{pack && <PdfBtn id={out.runId} />}{pack && <CopyBtn text={all}>Copy all</CopyBtn>}</div>
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
  const [refs, setRefs] = useState([]);
  const { busy, out, run } = useRun(() => AiModel.script({ brief, type, duration, lang, tone, refs }));
  const s = out && out.script;
  const all = s ? [s.title, s.logline, '', 'HOOK: ' + s.hook, '', ...s.scenes.map(sc => `[${sc.time}]\nVISUAL: ${sc.visual}\nAUDIO: ${sc.audio}${sc.on_screen_text ? '\nON SCREEN: ' + sc.on_screen_text : ''}${sc.sfx_music ? '\nSFX/MUSIC: ' + sc.sfx_music : ''}`), '', 'CTA: ' + s.cta].join('\n') : '';
  return (
    <div className="ai-grid">
      <div className="ai-stack">
        <div className="panel ai-p"><Sec n="01" title="Your brief" /><Brief value={brief} onChange={setBrief} disabled={busy} placeholder="What is the film about? Product, story, who speaks, key message, must-show moments…" /><RefPicker value={refs} onChange={setRefs} disabled={busy} /></div>
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
        <div className="ai-out-h"><b style={{ fontSize: 15 }}>{s ? s.title : 'Your script'}</b>{s && <Chip tone="gr">{s.duration} · {s.scenes.length} scenes</Chip>}{s && s.spoken_words > 0 && <Chip tone="gy">~{s.spoken_words} spoken words</Chip>}<span className="grow" />{s && <PdfBtn id={out.runId} />}{s && <CopyBtn text={all}>Copy script</CopyBtn>}</div>
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
  const [refs, setRefs] = useState([]);
  const name = id => (meta.content.platforms.find(p => p.id === id) || {}).name || id;
  const { toast } = useUi();
  // The calendar and its posted ticks live in the workspace database (the latest schedule run of this person).
  useEffect(() => { AiModel.scheduleLatest().then(r => { if (r && r.plan) setSaved(r); }).catch(() => {}); }, []);
  const persist = next => {
    const prev = saved;
    setSaved(next);
    if (!next && prev && prev.runId) AiModel.runDelete(prev.runId).catch(e => toast(e.message || 'Could not clear'));
    else if (next && next.runId && prev && prev.runId === next.runId) AiModel.runState(next.runId, next.done).catch(e => toast(e.message || 'Could not save'));
  };
  const { busy, run } = useRun(async () => { const r = await AiModel.schedule({ brief, platforms: picked, days: Number(days), perWeek: Number(perWeek), lang, start, refs }); persist({ plan: r.plan, start: r.start, done: {}, runId: r.runId }); setOpenIdx(null); return r; });
  const groups = useMemo(() => { if (!saved) return []; const m = new Map(); saved.plan.posts.forEach((p, i) => { if (!m.has(p.day)) m.set(p.day, []); m.get(p.day).push({ i, p }); }); return [...m.entries()].sort((a, b) => a[0] - b[0]); }, [saved]);
  const doneCount = saved ? Object.values(saved.done).filter(Boolean).length : 0;
  const text = p => p.caption + (p.hashtags.length ? '\n\n' + p.hashtags.join(' ') : '');
  return (
    <div className="ai-grid">
      <div className="ai-stack">
        <div className="panel ai-p"><Sec n="01" title="Campaign brief" /><Brief value={brief} onChange={setBrief} disabled={busy} placeholder="What is the campaign? Launch, festival, offer, event. Who is it for, key dates…" /><RefPicker value={refs} onChange={setRefs} disabled={busy} /></div>
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
          {saved && <><PdfBtn id={saved.runId} /><a className="date-btn" href={'data:text/csv;charset=utf-8,' + encodeURIComponent(csv(saved.plan, saved.start))} download={saved.plan.campaign.replace(/\s+/g, '-').toLowerCase() + '-calendar.csv'}><Icon name="down" />CSV</a><button type="button" className="date-btn" onClick={() => { if (window.confirm('Remove this calendar? It is deleted from history too.')) persist(null); }}>Clear</button></>}
        </div>
        {busy ? <Writing label="Planning" /> : !saved ? <Empty>Your calendar appears here.<br /><small>Saved to the workspace with a posted checkbox per item.</small></Empty> : (
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
  const [refs, setRefs] = useState([]);
  const { busy, out, run } = useRun(() => AiModel.ads({ brief, platforms: picked, objective, budget, audience, lang, refs }));
  const name = id => (meta.ads.platforms.find(p => p.id === id) || {}).name || id;
  const a = out && out.ads;
  const vText = v => ['Angle: ' + v.angle, 'Headlines:', ...v.headlines.map(h => '  - ' + h), 'Primary text:', v.primary_text, 'Descriptions:', ...v.descriptions.map(d => '  - ' + d), 'CTA: ' + v.cta].join('\n');
  const all = a ? a.sets.map(s => '## ' + name(s.platform) + '\n' + s.variants.map(vText).join('\n\n') + (s.targeting.length ? '\n\nTargeting:\n' + s.targeting.map(t => '  - ' + t).join('\n') : '')).join('\n\n') : '';
  return (
    <div className="ai-grid">
      <div className="ai-stack">
        <div className="panel ai-p"><Sec n="01" title="Your brief" /><Brief value={brief} onChange={setBrief} disabled={busy} placeholder="What are we advertising? Offer, product, who it is for, what makes it different, landing page…" /><RefPicker value={refs} onChange={setRefs} disabled={busy} /></div>
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
        <div className="ai-out-h"><b style={{ fontSize: 15 }}>Your ads</b>{a && <Chip tone="gr">{a.sets.reduce((n, s) => n + s.variants.length, 0)} variants</Chip>}<span className="grow" />{a && <PdfBtn id={out.runId} />}{a && <CopyBtn text={all}>Copy all</CopyBtn>}</div>
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

/* ---------- 5. PPT ---------- */
const downloadBase64 = (base64, filename) => downloadB64(base64, filename, MIME.pptx);
const KIND_LABEL = { cover: 'Cover', agenda: 'Agenda', statement: 'Statement', bullets: 'Points', split: 'Split + callout', stats: 'Stat cards', steps: 'Steps', compare: 'Compare', chart: 'Chart', quote: 'Quote', image: 'Image slot', closing: 'Closing' };

function DeckTab({ meta }) {
  const { toast } = useUi();
  const [brief, setBrief] = useState('');
  const [count, setCount] = useState('10');
  const [style, setStyle] = useState('Pitch');
  const [lang, setLang] = useState('English');
  const [audience, setAudience] = useState('');
  const [refs, setRefs] = useState([]);
  const [outline, setOutline] = useState(null);   // step 1 result, editable
  const [design, setDesign] = useState(null);     // step 2 result
  const [stage, setStage] = useState('idle');     // idle | outlining | review | designing | done

  async function draft() {
    setStage('outlining'); setDesign(null);
    try { const r = await AiModel.deck({ brief, count: Number(count), style, lang, audience, refs }); setOutline(r.outline); setStage('review'); }
    catch (e) { toast(e.message || 'Failed'); setStage(outline ? 'review' : 'idle'); }
  }
  async function approve() {
    setStage('designing');
    try { const r = await AiModel.deckDesign(outline); setDesign(r); setStage('done'); }
    catch (e) { toast(e.message || 'Failed'); setStage('review'); }
  }
  const editSlide = (i, patch) => setOutline(o => ({ ...o, slides: o.slides.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));
  const removeSlide = i => setOutline(o => ({ ...o, slides: o.slides.filter((_, k) => k !== i) }));
  const addSlide = i => setOutline(o => { const s = [...o.slides]; s.splice(i + 1, 0, { title: 'New slide', points: [], notes: '' }); return { ...o, slides: s }; });
  const move = (i, d) => setOutline(o => { const s = [...o.slides]; const j = i + d; if (j < 0 || j >= s.length) return o; [s[i], s[j]] = [s[j], s[i]]; return { ...o, slides: s }; });

  const busy = stage === 'outlining' || stage === 'designing';
  const deck = design && design.deck;
  const outlineText = outline ? outline.slides.map((s, i) => `${i + 1}. ${s.title}${s.points.length ? '\n   - ' + s.points.join('\n   - ') : ''}${s.notes ? '\n   Notes: ' + s.notes : ''}`).join('\n\n') : '';

  return (
    <div className="ai-grid">
      <div className="ai-stack">
        <div className="panel ai-p"><Sec n="01" title="Your brief" /><Brief value={brief} onChange={setBrief} disabled={busy} placeholder="What is the deck for? Client, offer, problem, proof, numbers you have, what you want them to decide…" /><RefPicker value={refs} onChange={setRefs} disabled={busy} /></div>
        <div className="panel ai-p">
          <Sec n="02" title="Deck" right={meta.deck.google ? <><span className="dot" />Google Slides connected</> : 'Google Slides not connected · .pptx download'} />
          <div className="ai-fields">
            <Field label="Slides"><Select value={count} onChange={setCount} options={meta.deck.counts.map(String)} disabled={busy} /></Field>
            <Field label="Type"><Select value={style} onChange={setStyle} options={meta.deck.styles} disabled={busy} /></Field>
            <Field label="Language"><Select value={lang} onChange={setLang} options={meta.deck.langs} disabled={busy} /></Field>
          </div>
          <Field label="Audience (optional)"><input type="text" value={audience} onChange={e => setAudience(e.target.value)} placeholder="e.g. CMO of a Punjab tourism board" disabled={busy} /></Field>
          <Run busy={stage === 'outlining'} disabled={busy || !brief.trim()} onClick={draft}>{outline ? 'Redo outline' : 'Draft outline'}</Run>
          <div className="ai-meta"><span>Step 1 drafts the outline. You approve or edit it, then the designer builds the slides.</span></div>
        </div>
      </div>

      <div className="panel ai-p">
        {stage === 'outlining' && <Writing label="Outlining" />}
        {stage === 'designing' && <Writing label="Designing" />}
        {stage === 'idle' && <Empty>Brief, slide count, type, draft.<br /><small>{meta.deck.google ? 'After approval you get a Google Slides link you can edit.' : 'After approval you get a designed .pptx.'}</small></Empty>}

        {stage === 'review' && outline && (
          <>
            <div className="ai-out-h"><b style={{ fontSize: 15 }}>Outline</b><Chip tone="or">Review · {outline.slides.length} slides</Chip><span className="grow" /><CopyBtn text={outlineText}>Copy</CopyBtn></div>
            <div className="ai-fields" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Title"><input type="text" value={outline.title} onChange={e => setOutline({ ...outline, title: e.target.value })} /></Field>
              <Field label="Subtitle"><input type="text" value={outline.subtitle} onChange={e => setOutline({ ...outline, subtitle: e.target.value })} /></Field>
            </div>
            {outline.slides.map((s, i) => (
              <div className="ai-card" key={i}>
                <div className="ai-card-h"><Chip tone="gy">{i + 1}</Chip><input type="text" value={s.title} onChange={e => editSlide(i, { title: e.target.value })} style={{ flex: 1, minWidth: 160, height: 36, fontWeight: 600 }} />
                  <span className="acts"><button type="button" className="mini-btn" title="Move up" onClick={() => move(i, -1)}>↑</button><button type="button" className="mini-btn" title="Move down" onClick={() => move(i, 1)}>↓</button><button type="button" className="mini-btn" title="Add slide after" onClick={() => addSlide(i)}>+</button><button type="button" className="mini-btn" title="Remove" onClick={() => removeSlide(i)}>✕</button></span>
                </div>
                <textarea value={s.points.join('\n')} onChange={e => editSlide(i, { points: e.target.value.split('\n') })} placeholder="One point per line" style={{ minHeight: 64, marginTop: 8, fontSize: 13 }} />
                <textarea value={s.notes} onChange={e => editSlide(i, { notes: e.target.value })} placeholder="Speaker notes (optional)" style={{ minHeight: 44, marginTop: 6, fontSize: 12.5, color: 'var(--muted)' }} />
              </div>
            ))}
            <button type="button" className="btn btn-primary ai-cta" onClick={approve} disabled={outline.slides.filter(s => s.title.trim()).length < 2}>Approve outline &amp; design slides</button>
          </>
        )}

        {stage === 'done' && deck && (
          <>
            <div className="ai-out-h"><b style={{ fontSize: 15 }}>{deck.title}</b><Chip tone="gr">{deck.slides.length} slides designed</Chip><span className="grow" /><PdfBtn id={design.runId} /><button type="button" className="date-btn" onClick={() => setStage('review')}>Back to outline</button></div>
            {design.slides && design.slides.url && <a className="btn btn-primary ai-cta" href={design.slides.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', marginBottom: 12 }}>Open in Google Slides ↗</a>}
            {design.pptx && <button type="button" className="btn btn-primary ai-cta" style={{ marginBottom: 12 }} onClick={() => downloadBase64(design.pptx.base64, design.pptx.filename)}>Download designed .pptx</button>}
            {deck.slides.map((s, i) => (
              <div className="ai-card" key={i}>
                <div className="ai-card-h"><Chip tone="gy">{i + 1}</Chip><b>{s.title || s.quote.text}</b><Chip tone="pu">{KIND_LABEL[s.kind] || s.kind}</Chip></div>
                {s.kicker && <div className="ai-tip" style={{ marginTop: 4 }}>{s.kicker.toUpperCase()}</div>}
                {s.subtitle && <div className="ai-meta" style={{ marginTop: 6 }}><span>{s.subtitle}</span></div>}
                {s.points.length > 0 && <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13.5, color: 'var(--t2)' }}>{s.points.map((b, k) => <li key={k}>{b}</li>)}</ul>}
                {s.kind === 'split' && s.callout && <div className="ai-chips"><Chip tone="pu">Callout: {s.callout}</Chip></div>}
                {s.stats.length > 0 && <div className="ai-chips">{s.stats.map((st, k) => <Chip key={k} tone="gy"><b style={{ color: 'var(--accent)', marginRight: 6 }}>{st.value}</b>{st.label}</Chip>)}</div>}
                {s.steps.length > 0 && <ol style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--t2)' }}>{s.steps.map((st, k) => <li key={k}><b style={{ color: 'var(--text)' }}>{st.title}</b>{st.text ? ' — ' + st.text : ''}</li>)}</ol>}
                {s.kind === 'compare' && <div className="ai-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>{[s.compare.left, s.compare.right].map((side, k) => <div key={k}><b style={{ fontSize: 13 }}>{side.title}</b><ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--t2)' }}>{side.items.map((x, j) => <li key={j}>{x}</li>)}</ul></div>)}</div>}
                {s.kind === 'chart' && <div className="ai-meta" style={{ marginTop: 8 }}><span>{s.chart.type} chart · {s.chart.categories.join(', ')} · {s.chart.takeaway}</span></div>}
                {s.kind === 'quote' && <div className="ai-tip">“{s.quote.text}”{s.quote.by ? ' — ' + s.quote.by : ''}</div>}
                {s.kind === 'image' && <div className="ai-meta" style={{ marginTop: 8 }}><span>Image prompt: {s.image.prompt}</span><CopyBtn text={s.image.prompt} small>Copy prompt</CopyBtn></div>}
                {s.notes && <div className="ai-meta" style={{ marginTop: 8 }}><span>Notes: {s.notes}</span></div>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- 6. History (per staff; admins see everyone) ---------- */
function HistoryTab({ meta }) {
  const { toast } = useUi();
  const [tool, setTool] = useState('');
  const [staff, setStaff] = useState('me');
  const [people, setPeople] = useState([]);
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);   // { id, run, doc }
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (meta.admin) EmployeeModel.list().then(r => setPeople(Array.isArray(r) ? r : (r && r.items) || [])).catch(() => setPeople([])); }, [meta.admin]);
  const load = () => { setBusy(true); AiModel.history({ tool: tool || undefined, staff: meta.admin ? (staff === 'me' ? undefined : staff) : undefined, limit: 100 }).then(setRows).catch(e => toast(e.message || 'Failed')).finally(() => setBusy(false)); };
  useEffect(() => { load(); }, [tool, staff]); // eslint-disable-line react-hooks/exhaustive-deps
  const view = async r => {
    if (open && open.id === r.id) return setOpen(null);
    try { const full = await AiModel.run(r.id); setOpen({ id: r.id, run: full, doc: full.doc }); } catch (e) { toast(e.message || 'Failed'); }
  };
  const del = async r => { if (!window.confirm('Delete this run?')) return; try { await AiModel.runDelete(r.id); setRows(x => x.filter(y => y.id !== r.id)); if (open && open.id === r.id) setOpen(null); toast('Deleted'); } catch (e) { toast(e.message || 'Failed'); } };
  const pptx = async r => { try { const f = await AiModel.runPptx(r.id); downloadB64(f.base64, f.filename, MIME.pptx); } catch (e) { toast(e.message || 'Failed'); } };
  const when = iso => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="ai-stack">
      <div className="ai-head">
        <div className="ai-fields" style={{ gridTemplateColumns: meta.admin ? '180px 220px' : '180px', flex: 1 }}>
          <Field label="Tool"><Select value={tool} onChange={setTool} options={[['', 'All tools'], ...Object.entries(TOOL_LABEL)]} /></Field>
          {meta.admin && <Field label="Staff"><Select value={staff} onChange={setStaff} options={[['me', 'Me'], ['all', 'Everyone'], ...people.map(p => [p.id, p.name])]} /></Field>}
        </div>
        <span className="ai-meta"><span>Every generation is saved to the workspace database with who ran it and when.</span></span>
      </div>
      <div className="panel ai-p">
        {busy && !rows ? <Writing label="Loading" /> : !rows || rows.length === 0 ? <Empty>Nothing here yet. Runs appear as soon as anyone generates something.</Empty> : rows.map(r => (
          <div className="ai-card" key={r.id} style={{ padding: '10px 14px' }}>
            <div className="ai-card-h">
              <Chip tone="pu">{TOOL_LABEL[r.tool] || r.tool}</Chip>
              <b style={{ flex: 1, minWidth: 160, fontSize: 13.5 }}>{r.title || '(untitled)'}</b>
              {meta.admin && <Chip tone="gy">{r.emp_name || 'staff'}</Chip>}
              <span className="ai-meta"><span>{when(r.created_at)}</span></span>
              <span className="acts">
                <button type="button" className="date-btn" style={{ height: 28, fontSize: 11.5 }} onClick={() => view(r)}>{open && open.id === r.id ? 'Hide' : 'Open'}</button>
                <PdfBtn id={r.id} small />
                {r.tool === 'deck' && <button type="button" className="date-btn" style={{ height: 28, fontSize: 11.5 }} onClick={() => pptx(r)}><Icon name="down" />PPTX</button>}
                <button type="button" className="mini-btn" onClick={() => del(r)} aria-label="Delete">✕</button>
              </span>
            </div>
            {open && open.id === r.id && open.doc && (
              <div style={{ marginTop: 10 }}>
                {open.doc.subtitle && <div className="ai-dir"><div><div className="lab">{open.doc.title}</div><div>{open.doc.subtitle}</div></div></div>}
                {open.doc.sections.map((s, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    {s.kicker && <div className="ai-tip" style={{ marginTop: 0, fontSize: 10.5, letterSpacing: '.18em' }}>{s.kicker}</div>}
                    <b style={{ fontSize: 13.5 }}>{s.heading}</b>
                    {s.paragraphs.map((p, k) => <pre className="ai-text" key={k} style={{ marginTop: 6 }}>{p}</pre>)}
                    {s.bullets.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--t2)' }}>{s.bullets.map((b, k) => <li key={k}>{b}</li>)}</ul>}
                    {s.kv.length > 0 && <div className="ai-chips">{s.kv.map(([k, v], j) => <Chip key={j} tone="gy">{k}: <b style={{ color: 'var(--accent)' }}>{v}</b></Chip>)}</div>}
                    {s.table && <div style={{ overflowX: 'auto' }}><table className="ai-scenes"><thead><tr>{s.table.head.map((h, k) => <th key={k}>{h}</th>)}</tr></thead><tbody>{s.table.rows.map((row, k) => <tr key={k}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
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
      {meta && tab === 'deck' && <DeckTab meta={meta} />}
      {meta && tab === 'history' && <HistoryTab meta={meta} />}
    </div>
  );
}
