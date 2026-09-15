'use client';
// UI controller: toasts, the generic form modal, confirm dialogs and the selfie capture shared by every screen.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const UiContext = createContext(null);

export function UiProvider({ children }) {
  const [toast, setToastState] = useState({ msg: '', show: false });
  const [modal, setModal] = useState(null); // {title, sub, fields, ok, onSubmit}
  const [confirmDialog, setConfirmDialog] = useState(null); // {title, message, sub, okText, cancelText, danger}
  const [selfieRequest, setSelfieRequest] = useState(null); // {title, sub}
  const confirmResolver = useRef(null);
  const selfieResolver = useRef(null);
  const timer = useRef(null);

  const showToast = useCallback(msg => {
    setToastState({ msg, show: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastState(t => ({ ...t, show: false })), 3000);
  }, []);

  const openModal = useCallback(cfg => setModal(cfg), []);
  const closeModal = useCallback(() => setModal(null), []);

  /** Themed custom confirmation modal (Promise-based, replaces native window.confirm) */
  const confirm = useCallback(opts => new Promise(resolve => {
    confirmResolver.current = resolve;
    if (typeof opts === 'string') {
      setConfirmDialog({
        title: 'Please Confirm',
        message: opts,
        okText: 'Confirm',
        cancelText: 'Cancel',
        danger: true
      });
    } else if (opts && typeof opts === 'object') {
      setConfirmDialog({
        title: opts.title || 'Please Confirm',
        message: opts.message || opts.text || '',
        sub: opts.sub || '',
        okText: opts.okText || opts.ok || 'Confirm',
        cancelText: opts.cancelText || opts.cancel || 'Cancel',
        danger: opts.danger !== false
      });
    } else {
      resolve(false);
    }
  }), []);

  const closeConfirm = useCallback(result => {
    const r = confirmResolver.current;
    confirmResolver.current = null;
    setConfirmDialog(null);
    if (r) r(Boolean(result));
  }, []);

  /** Opens the camera dialog; resolves with a JPEG data URL, or null when cancelled. */
  const askSelfie = useCallback(opts => new Promise(resolve => { selfieResolver.current = resolve; setSelfieRequest(opts || {}); }), []);
  const resolveSelfie = useCallback(value => { const r = selfieResolver.current; selfieResolver.current = null; setSelfieRequest(null); if (r) r(value); }, []);

  const value = useMemo(() => ({
    toast: showToast,
    openModal,
    closeModal,
    confirm,
    confirmDialog,
    closeConfirm,
    modal,
    toastState: toast,
    askSelfie,
    resolveSelfie,
    selfieRequest
  }), [showToast, openModal, closeModal, confirm, confirmDialog, closeConfirm, modal, toast, askSelfie, resolveSelfie, selfieRequest]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside UiProvider');
  return ctx;
}
