'use client';
// UI controller: toasts, the generic form modal, confirm dialogs and the selfie capture shared by every screen.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const UiContext = createContext(null);

export function UiProvider({ children }) {
  const [toast, setToastState] = useState({ msg: '', show: false });
  const [modal, setModal] = useState(null); // {title, sub, fields, ok, onSubmit}
  const [selfieRequest, setSelfieRequest] = useState(null); // {title, sub}
  const selfieResolver = useRef(null);
  const timer = useRef(null);

  const showToast = useCallback(msg => {
    setToastState({ msg, show: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastState(t => ({ ...t, show: false })), 3000);
  }, []);

  const openModal = useCallback(cfg => setModal(cfg), []);
  const closeModal = useCallback(() => setModal(null), []);
  const confirm = useCallback(msg => (typeof window !== 'undefined' ? window.confirm(msg) : false), []);

  /** Opens the camera dialog; resolves with a JPEG data URL, or null when cancelled. */
  const askSelfie = useCallback(opts => new Promise(resolve => { selfieResolver.current = resolve; setSelfieRequest(opts || {}); }), []);
  const resolveSelfie = useCallback(value => { const r = selfieResolver.current; selfieResolver.current = null; setSelfieRequest(null); if (r) r(value); }, []);

  const value = useMemo(() => ({ toast: showToast, openModal, closeModal, confirm, modal, toastState: toast, askSelfie, resolveSelfie, selfieRequest }), [showToast, openModal, closeModal, confirm, modal, toast, askSelfie, resolveSelfie, selfieRequest]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside UiProvider');
  return ctx;
}
