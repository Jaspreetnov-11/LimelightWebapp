'use client';
// Clock-in / clock-out controller: captures GPS, reverse-geocodes it, and calls the attendance API.
import { useCallback, useState } from 'react';
import { AttendanceModel } from '@/models';
import { useData } from './DataController';
import { useUi } from './UiController';
import { hhmm, hm, minsBetween } from '@/lib/format';

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
  const { today, reload } = useData();
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  const punch = today ? today.myPunch : null;
  const state = punch && punch.clock_in && !punch.clock_out ? 'in' : punch && punch.clock_out ? 'done' : 'off';
  const label = busy ? 'Locating…' : state === 'in' ? 'Clock Out' : state === 'done' ? 'Clocked out' : 'Clock In';

  const act = useCallback(async () => {
    if (busy) return;
    if (state === 'done') { toast('Already clocked out today. Edit it from Attendance.'); return; }
    setBusy(true);
    try {
      const g = await getGeo();
      const addr = await geoLabel(g);
      const body = g ? { lat: g.lat, lng: g.lng, acc: g.acc, addr } : { addr: '' };
      const where = g ? (addr ? ' · ' + addr : ' · location saved') : ' · no location';
      if (state === 'off') {
        const rec = await AttendanceModel.clockIn({ ...body, mode: 'office' });
        toast('Clocked in at ' + hhmm(new Date()) + where);
        if (!g) toast('Location not available. Allow location access in the browser to record it next time.');
        void rec;
      } else {
        const rec = await AttendanceModel.clockOut(body);
        toast('Clocked out at ' + hhmm(new Date()) + ' · ' + hm(minsBetween(rec.clock_in, rec.clock_out)) + ' today' + where);
      }
      await reload('today', 'activity', 'employees');
    } catch (err) {
      toast(err.message || 'Could not record attendance.');
    } finally {
      setBusy(false);
    }
  }, [busy, state, toast, reload]);

  return { punch, state, label, busy, act };
}
