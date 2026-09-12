'use client';
// Web push: registers the service worker, keeps this device's subscription in sync with the API,
// and exposes enable / disable / test for the Settings page and the Notifications banner.
import { useCallback, useEffect, useState } from 'react';
import { PushModel } from '@/models';

const ASKED_KEY = 'lh-push-asked';
const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const b64ToU8 = s => { const pad = '='.repeat((4 - (s.length % 4)) % 4); const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(c => c.charCodeAt(0))); };

async function registration() {
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  return reg;
}

export function usePush({ auto = false } = {}) {
  const [state, setState] = useState({ supported: false, permission: 'default', subscribed: false, busy: false, standaloneNeeded: false });

  const refresh = useCallback(async () => {
    if (!supported()) { setState(s => ({ ...s, supported: false })); return; }
    const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      setState(s => ({ ...s, supported: true, permission: Notification.permission, subscribed: Boolean(sub), standaloneNeeded: isIos && !standalone }));
      // Keep the server copy fresh (endpoints rotate)
      if (sub && Notification.permission === 'granted') PushModel.subscribe(sub.toJSON()).catch(() => {});
    } catch (e) { setState(s => ({ ...s, supported: true, permission: Notification.permission })); }
  }, []);

  const enable = useCallback(async () => {
    if (!supported()) throw new Error('This browser does not support push notifications.');
    setState(s => ({ ...s, busy: true }));
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Notifications are blocked for this site. Allow them in the browser settings.' : 'Permission was not granted.');
      const reg = await registration();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const { publicKey } = await PushModel.key();
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(publicKey) });
      }
      await PushModel.subscribe(sub.toJSON());
      setState(s => ({ ...s, permission: 'granted', subscribed: true }));
      return true;
    } finally { setState(s => ({ ...s, busy: false })); }
  }, []);

  const disable = useCallback(async () => {
    if (!supported()) return;
    setState(s => ({ ...s, busy: true }));
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await PushModel.unsubscribe(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
      setState(s => ({ ...s, subscribed: false }));
    } finally { setState(s => ({ ...s, busy: false })); }
  }, []);

  const test = useCallback(() => PushModel.test(), []);

  useEffect(() => {
    refresh();
    if (!auto || !supported()) return;
    // First app open on this device: ask once, right away, so everyone is subscribed by default
    let asked = false; try { asked = Boolean(localStorage.getItem(ASKED_KEY)); } catch (e) { asked = true; }
    if (asked || Notification.permission !== 'default') return;
    const t = setTimeout(() => { try { localStorage.setItem(ASKED_KEY, '1'); } catch (e) { /* ignore */ } enable().catch(() => {}); }, 2500);
    return () => clearTimeout(t);
  }, [auto, refresh, enable]);

  return { ...state, refresh, enable, disable, test };
}
