'use client';
// Simran: the lighthouse mascot as a chat assistant. Floating button → chat panel.
// Answers come from /assistant/chat; "Admin ko WhatsApp" hands the thread to the admin's WhatsApp.
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/controllers/AuthController';
import { useUi } from '@/controllers/UiController';
import { AssistantModel } from '@/models';

const QUICK = ['Aaj kitna kaam hua?', 'Mere tasks', 'Leaves kitni bachi?', 'Mera score', 'Shift timing', 'App kaise use karein?', 'Task accept kaise kare?'];
const KEY = 'lh-simran';

export function SimranChat() {
  const { me } = useAuth();
  const { toast } = useUi();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [wa, setWa] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { try { const s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.msgs)) setMsgs(s.msgs); } catch (e) { /* ignore */ } }, []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify({ msgs: msgs.slice(-30) })); } catch (e) { /* ignore */ } }, [msgs]);
  useEffect(() => { if (open) { setTimeout(() => { if (endRef.current) endRef.current.scrollIntoView({ block: 'end' }); if (inputRef.current) inputRef.current.focus(); }, 50); } }, [open, msgs.length]);

  const greeting = 'Hi ' + String(me && me.name ? me.name : '').split(' ')[0] + '! Main Simran hoon 👋 Aaj ke hours, tasks, leaves, score ya shift ke baare mein poocho.';

  const send = async q => {
    const v = String(q || text).trim();
    if (!v || busy) return;
    const next = [...msgs, { role: 'user', text: v }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      const r = await AssistantModel.chat(next);
      setMsgs(m => [...m, { role: 'assistant', text: r.reply }]);
      setWa(r.whatsappNumber || '');
    } catch (err) {
      setMsgs(m => [...m, { role: 'assistant', text: 'Sorry, abhi jawab nahi de paayi. Thodi der mein try karo ya admin ko WhatsApp bhej do.' }]);
      toast(err.message);
    } finally { setBusy(false); }
  };

  const toWhatsApp = async () => {
    const lastUser = [...msgs].reverse().find(m => m.role === 'user');
    const body = (lastUser ? lastUser.text : text.trim()) || 'Hi, mujhe kuch poochna tha.';
    setBusy(true);
    try {
      const r = await AssistantModel.whatsapp(body);
      if (r.sent) toast('Admin ko WhatsApp pe bhej diya.');
      else if (r.link) { window.open(r.link, '_blank', 'noopener'); toast('WhatsApp khul raha hai, wahan Send dabao.'); }
      else toast(r.reason || 'Admin ne WhatsApp number set nahi kiya hai.');
    } catch (err) { toast(err.message); } finally { setBusy(false); }
  };

  return (
    <>
      <button type="button" className={'simran-fab' + (open ? ' on' : '')} onClick={() => setOpen(o => !o)} aria-label={open ? 'Close Simran' : 'Ask Simran'} title="Ask Simran">
        <svg viewBox="0 0 70 74" aria-hidden="true"><use href="#i-mascot" /></svg>
        {!open && <span className="simran-hi">Ask Simran</span>}
      </button>
      {open && (
        <div className="simran" role="dialog" aria-label="Simran assistant">
          <div className="simran-h">
            <svg viewBox="0 0 70 74" aria-hidden="true"><use href="#i-mascot" /></svg>
            <div><b>Simran</b><small>Lighthouse assistant · online</small></div>
            <button type="button" className="mini-btn" onClick={() => setMsgs([])} title="Clear chat">↺</button>
            <button type="button" className="mini-btn" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <div className="simran-b">
            <div className="msg bot">{greeting}</div>
            {msgs.map((m, i) => <div className={'msg ' + (m.role === 'user' ? 'me' : 'bot')} key={i}>{m.text}</div>)}
            {busy && <div className="msg bot typing"><i></i><i></i><i></i></div>}
            {!msgs.length && <div className="simran-quick">{QUICK.map(q => <button type="button" key={q} onClick={() => send(q)}>{q}</button>)}</div>}
            <div ref={endRef}></div>
          </div>
          <form className="simran-in" onSubmit={e => { e.preventDefault(); send(); }}>
            <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} placeholder="Simran se poocho…" maxLength={500} autoComplete="off" enterKeyHint="send" />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Send">➤</button>
          </form>
          <button type="button" className="simran-wa" onClick={toWhatsApp} disabled={busy} title={wa ? 'Admin WhatsApp: +' + wa : 'Sends your last question to the admin on WhatsApp'}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.7c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1 2.6 11.4 11.4 0 0 0 4.4 3.9c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2 2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z" /></svg>
            Admin ko WhatsApp karo
          </button>
        </div>
      )}
    </>
  );
}
