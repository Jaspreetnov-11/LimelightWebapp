'use client';
// Clock-in / clock-out controller: selfie (when required), GPS + reverse-geocode, then the attendance API.
import { useCallback, useState } from 'react';
import { AttendanceModel } from '@/models';
import { useData } from './DataController';
import { useUi } from './UiController';
import { hhmm, hm, MODE_LABEL, punchMinutes } from '@/lib/format';

function getGeo() {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { resolve(null); return; }
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    navigator.geolocation.getCurrentPosition(
      p => finish({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy || 0) }),
      () => finish(null),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
    );
    setTimeout(() => finish(null), 10000);
  });
}

async function geoLabel(g) {
  if (!g) return '';
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 4000);
    const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat=' + g.lat + '&lon=' + g.lng, { signal: c.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    const j = await r.json();
    const a = j.address || {};
    return [a.neighbourhood || a.suburb || a.road, a.city || a.town || a.village].filter(Boolean).join(', ') || (j.display_name || '').split(',').slice(0, 2).join(',');
  } catch (e) { return ''; }
}

export function useClock() {
  const { today, settings, reload } = useData();
  const { toast, askSelfie } = useUi();
  const [busy, setBusy] = useState(false);
  const punch = today ? today.myPunch : null;
  const state = punch && punch.clock_in && !punch.clock_out ? 'in' : punch && punch.clock_out ? 'done' : 'off';
  const label = busy ? 'Locating…' : state === 'in' ? 'Clock Out' : state === 'done' ? 'Clocked out' : 'Clock In';
  const selfieIn = !settings || settings.selfieOnClockIn !== false;
  const selfieOut = Boolean(settings && settings.selfieOnClockOut);

  const act = useCallback(async () => {
    if (busy) return;
    if (state === 'done') { toast('Already clocked out today. Ask an admin to correct it if needed.'); return; }
    const needSelfie = state === 'off' ? selfieIn : selfieOut;
    let selfie = '', mode = 'office';
    if (needSelfie || state === 'off') {
      const r = await askSelfie({
        title: state === 'off' ? 'Clock in' : 'Clock out',
        sub: state === 'off' ? 'Where are you working from today?' + (needSelfie ? ' Then look at the camera and tap Capture.' : '') : 'Look at the camera and tap Capture.',
        askMode: state === 'off', needSelfie, defaultMode: 'office', okLabel: state === 'off' ? 'Clock in' : 'Clock out'
      });
      if (!r) { toast(needSelfie ? 'Selfie is needed to ' + (state === 'off' ? 'clock in' : 'clock out') + '.' : 'Cancelled.'); return; }
      selfie = r.selfie || ''; mode = r.mode || 'office';
    }
    setBusy(true);
    try {
      const g = await getGeo();
      const addr = await geoLabel(g);
      const body = g ? { lat: g.lat, lng: g.lng, acc: g.acc, addr } : { addr: '' };
      if (selfie) body.selfie = selfie;
      const where = g ? (addr ? ' · ' + addr : ' · location saved') : ' · no location';
      if (state === 'off') {
        await AttendanceModel.clockIn({ ...body, mode });
        toast('Clocked in at ' + hhmm(new Date()) + ' · ' + (MODE_LABEL[mode] || mode) + where);
        if (!g) toast('Location not available. Allow location access in the browser to record it next time.');
      } else {
        const rec = await AttendanceModel.clockOut(body);
        toast('Clocked out at ' + hhmm(new Date()) + ' · ' + hm(punchMinutes(rec)) + ' worked' + where);
      }
      await reload('today', 'activity', 'employees', 'myStats');
    } catch (err) {
      toast(err.message || 'Could not record attendance.');
    } finally {
      setBusy(false);
    }
  }, [busy, state, selfieIn, selfieOut, askSelfie, toast, reload]);

  return { punch, state, label, busy, act, selfieIn, selfieOut };
}
