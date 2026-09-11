'use client';
// Generic form modal driven by UiController.openModal({title, sub, fields, ok, onSubmit}).
// fields: [{name, label, type, options:[{v,l}], value, required, span, placeholder, min, step, error}]
import { useEffect, useState } from 'react';
import { useUi } from '@/controllers/UiController';

const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
const urlOk = v => /^https?:\/\/[^\s]+\.[^\s]+$/i.test(String(v).trim());

export function FormModal() {
  const { modal, closeModal } = useUi();
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!modal) return;
    const v = {};
    (modal.fields || []).forEach(f => { v[f.name] = f.value == null ? '' : f.value; });
    setValues(v); setErrors({}); setBusy(false);
  }, [modal]);

  useEffect(() => {
    if (!modal) return;
    const onKey = e => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal, closeModal]);

  if (!modal) return null;

  const set = (name, val) => { setValues(v => ({ ...v, [name]: val })); setErrors(e => ({ ...e, [name]: '' })); };

  const submit = async e => {
    e.preventDefault();
    const errs = {};
    (modal.fields || []).forEach(f => {
      const raw = values[f.name];
      const v = typeof raw === 'object' && raw ? 'file' : String(raw == null ? '' : raw).trim();
      if (f.required && !v) errs[f.name] = f.error || 'This field is required.';
      else if (v && f.type === 'email' && !emailOk(v)) errs[f.name] = 'Enter a valid email.';
      else if (v && f.type === 'url' && !urlOk(v)) errs[f.name] = 'Enter a valid URL.';
      else if (f.validate) { const r = f.validate(v, values); if (r !== true && r) errs[f.name] = r; }
    });
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setBusy(true);
    try {
      const data = {};
      Object.keys(values).forEach(k => { data[k] = typeof values[k] === 'string' ? values[k].trim() : values[k]; });
      await modal.onSubmit(data);
      closeModal();
    } catch (err) {
      setErrors({ _form: err.message || 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scrim open" onClick={e => { if (e.target === e.currentTarget) closeModal(); }} role="presentation">
      <div className="dialog wide" role="dialog" aria-modal="true">
        <h2>{modal.title}</h2>
        {modal.sub && <p>{modal.sub}</p>}
        <form onSubmit={submit} noValidate>
          {modal.custom ? modal.custom : (
            <div className="grid2">
              {(modal.fields || []).map(f => (
                <div key={f.name} className={'field' + (f.span ? ' span' : '') + (errors[f.name] ? ' invalid' : '')}>
                  <label htmlFor={'m-' + f.name}>{f.label}{!f.required && <span className="opt"> (optional)</span>}</label>
                  <div className="control">
                    {f.type === 'select' ? (
                      <select id={'m-' + f.name} value={values[f.name] ?? ''} onChange={e => set(f.name, e.target.value)}>
                        {(f.options || []).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea id={'m-' + f.name} value={values[f.name] ?? ''} placeholder={f.placeholder} onChange={e => set(f.name, e.target.value)} />
                    ) : f.type === 'file' ? (
                      <input id={'m-' + f.name} type="file" accept={f.accept} onChange={e => set(f.name, e.target.files && e.target.files[0] ? e.target.files[0] : '')} />
                    ) : (
                      <input id={'m-' + f.name} type={f.type || 'text'} value={values[f.name] ?? ''} placeholder={f.placeholder} min={f.min} step={f.step} autoComplete="off" onChange={e => set(f.name, e.target.value)} />
                    )}
                  </div>
                  <div className="error">{errors[f.name]}</div>
                </div>
              ))}
            </div>
          )}
          {errors._form && <div className="error" style={{ display: 'block' }}>{errors._form}</div>}
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
            <button type="submit" className={'btn btn-primary' + (busy ? ' loading' : '')} disabled={busy}><span className="spinner"></span>{modal.ok || 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Toast() {
  const { toastState } = useUi();
  return <div className={'toast' + (toastState.show ? ' show' : '')} role="status" aria-live="polite">{toastState.msg}</div>;
}
