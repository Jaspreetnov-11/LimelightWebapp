'use client';
// UI controller: toasts, the generic form modal and confirm dialogs shared by every screen.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const UiContext = createContext(null);

export function UiProvider({ children }) {
  const [toast, setToastState] = useState({ msg: '', show: false });
  const [modal, setModal] = useState(null); // {title, sub, fields, ok, onSubmit}
  const timer = useRef(null);

  const showToast = useCallback(msg => {
    setToastState({ msg, show: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastState(t => ({ ...t, show: false })), 3000);
  }, []);

  const openModal = useCallback(cfg => setModal(cfg), []);
  const closeModal = useCallback(() => setModal(null), []);
  const confirm = useCallback(msg => (typeof window !== 'undefined' ? window.confirm(msg) : false), []);

  const value = useMemo(() => ({ toast: showToast, openModal, closeModal, confirm, modal, toastState: toast }), [showToast, openModal, closeModal, confirm, modal, toast]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside UiProvider');
  return ctx;
}
