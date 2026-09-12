'use client';
// Clock-in / clock-out controller: selfie (when required), GPS + reverse-geocode, then the attendance API.
import { useCallback, useState } from 'react';
import { AttendanceModel } from '@/models';
import { useData } from './DataController';
import { useUi } from './UiController';
import { breakMinutes, hhmm, hm, MODE_LABEL, openBreak, punchMinutes } from '@/lib/format';

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

  const sessions = punch ? (Array.isArray(punch.sessions) ? punch.sessions : (() => { try { return JSON.parse(punch.sessions || '[]'); } catch (e) { return []; } })()) : [];
  const isOpen = Boolean(punch && punch.clock_in && !punch.clock_out);
  const isDone = Boolean(punch && punch.clock_out);
  const isRecheck = Boolean(isOpen && sessions.length > 0);

  const state = isOpen ? (isRecheck ? 're_in' : 'in') : isDone ? 'done' : 'off';
  const label = busy ? 'Locating…' : isOpen ? 'Clock Out' : isDone ? 'Re-Clock In' : 'Clock In';
  const sessionCount = sessions.length + (isOpen ? 1 : 0);
  const selfieIn = !settings || settings.selfieOnClockIn !== false;
  const selfieOut = Boolean(settings && settings.selfieOnClockOut);

  const act = useCallback(async () => {
    if (busy) return;
    const isClockingIn = state === 'off' || state === 'done';
    const needSelfie = isClockingIn ? selfieIn : selfieOut;
    let selfie = '', mode = 'office';
    if (needSelfie || isClockingIn) {
      const isRecheckAction = state === 'done';
      const actionTitle = isRecheckAction ? `Re-check In (Session ${sessions.length + 1})` : (state === 'off' ? 'Clock in' : 'Clock out');
      const actionSub = isClockingIn
        ? (isRecheckAction ? 'Starting an extra work session today.' : 'Where are you working from today?') + (needSelfie ? ' Then look at the camera and tap Capture.' : '')
        : 'Look at the camera and tap Capture.';

      const r = await askSelfie({
        title: actionTitle,
        sub: actionSub,
        askMode: isClockingIn,
        needSelfie,
        defaultMode: 'office',
        okLabel: isRecheckAction ? 'Re-Clock In' : (state === 'off' ? 'Clock in' : 'Clock out')
      });
      if (!r) {
        toast(needSelfie ? 'Selfie is needed to ' + (isClockingIn ? 'clock in' : 'clock out') + '.' : 'Cancelled.');
        return;
      }
      selfie = r.selfie || '';
      mode = r.mode || 'office';
    }
    setBusy(true);
    try {
      const g = await getGeo();
      const addr = await geoLabel(g);
      const body = g ? { lat: g.lat, lng: g.lng, acc: g.acc, addr } : { addr: '' };
      if (selfie) body.selfie = selfie;
      const where = g ? (addr ? ' · ' + addr : ' · location saved') : ' · no location';
      if (isClockingIn) {
        await AttendanceModel.clockIn({ ...body, mode });
        const prefix = state === 'done' ? `Re-clocked in (Session ${sessions.length + 1})` : 'Clocked in';
        toast(prefix + ' at ' + hhmm(new Date()) + ' · ' + (MODE_LABEL[mode] || mode) + where);
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
  }, [busy, state, sessions, selfieIn, selfieOut, askSelfie, toast, reload]);

  // Breaks: only while clocked in; minutes come off worked + productive hours
  const curBreak = isOpen ? openBreak(punch) : null;
  const onBreak = Boolean(curBreak);
  const breakNow = punch ? breakMinutes(punch) : 0;
  const startBreak = useCallback(async () => { if (busy) return; setBusy(true); try { const r = await AttendanceModel.breakStart(); toast((r && r.message) || 'Break started.'); await reload('today'); } catch (err) { toast(err.message); } finally { setBusy(false); } }, [busy, toast, reload]);
  const endBreak = useCallback(async () => { if (busy) return; setBusy(true); try { const r = await AttendanceModel.breakEnd(); toast((r && r.message) || 'Break ended.'); await reload('today', 'myStats'); } catch (err) { toast(err.message); } finally { setBusy(false); } }, [busy, toast, reload]);

  return { punch, state, label, busy, act, selfieIn, selfieOut, isRecheck, sessions, sessionCount, onBreak, curBreak, breakNow, startBreak, endBreak };
}
