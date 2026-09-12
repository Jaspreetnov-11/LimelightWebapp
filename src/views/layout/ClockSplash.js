'use client';
// Opening screen: shown once per app open. Loads the session, then offers "slide to clock in"
// when the person has not clocked in today; otherwise it hands over to Home right away.
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/controllers/AuthController';
import { useData } from '@/controllers/DataController';
import { useClock } from '@/controllers/useClock';
import { Icon } from '@/views/ui/Icons';
import { LimelightLoader } from '@/views/ui/Loader';
import { greeting, hhmm, shiftDisplay } from '@/lib/format';

export const SPLASH_KEY = 'lh-splash-seen';

export function SplashLoader({ text = 'Loading' }) {
  return (
    <div className="splash">
      <LimelightLoader text={text.replace(/…$/, '')} />
    </div>
  );
}

function SlideToClockIn({ onDone, busy }) {
  const track = useRef(null);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const [max, setMax] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    const measure = () => { if (track.current) setMax(Math.max(0, track.current.clientWidth - 64)); };
    measure(); window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const move = ev => { if (!drag) return; setX(Math.max(0, Math.min(max, ev.clientX - startRef.current))); };
  const end = () => {
    if (!drag) return;
    setDrag(false);
    if (max > 0 && x > max * 0.82) { setX(max); onDone(); } else setX(0);
  };
  const pct = max ? x / max : 0;

  return (
    <div className={'slide' + (busy ? ' busy' : '')} ref={track} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={end}>
      <div className="fill" style={{ width: x + 64 }}></div>
      <div className="lbl" style={{ opacity: 1 - pct * 1.4 }}>{busy ? 'Getting your location…' : 'Slide to clock in ›››'}</div>
      <div className={'knob' + (drag ? ' on' : '')} style={{ transform: 'translateX(' + x + 'px)', transition: drag ? 'none' : 'transform .25s' }}
        onPointerDown={ev => { if (busy) return; startRef.current = ev.clientX - x; setDrag(true); ev.currentTarget.setPointerCapture(ev.pointerId); }}>
        <Icon name={busy ? 'clock' : 'login'} />
      </div>
    </div>
  );
}

export function ClockSplash({ onDone }) {
  const { me } = useAuth();
  const { loaded, today, settings } = useData();
  const clock = useClock();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);

  // Already clocked in (or done for today): go straight to Home.
  useEffect(() => { if (loaded && today && clock.state !== 'off') onDone(); }, [loaded, today, clock.state, onDone]);

  if (!loaded || !today) return <SplashLoader text="Getting things ready" />;

  const go = async () => { await clock.act(); onDone(); };
  return (
    <div className="splash">
      <img src="/logo.png" alt="limelight" className="splash-logo" width="3096" height="774" />
      <div className="splash-hi">
        <div className="eyebrow">{greeting()}</div>
        <h1>{me.name.split(' ')[0]}, ready to start?</h1>
        <p>{now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' })} · {hhmm(now)} · shift {shiftDisplay(me.shift, settings)}</p>
      </div>
      <SlideToClockIn onDone={go} busy={clock.busy} />
      <button type="button" className="splash-skip" onClick={onDone} disabled={clock.busy}>Not now, take me to Home</button>
    </div>
  );
}
