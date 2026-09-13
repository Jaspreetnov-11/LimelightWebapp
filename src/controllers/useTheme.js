'use client';
// Appearance controller: dark (default) or light. Stored per device; applied as html[data-theme].
import { useCallback, useEffect, useState } from 'react';

export const THEME_KEY = 'lh-theme';
export const THEMES = [['dark', 'Dark'], ['light', 'Light']];

export function readTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; }
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F4F4F2' : '#0A0A0B');
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => (typeof window === 'undefined' ? 'dark' : readTheme()));
  useEffect(() => { const t = readTheme(); setThemeState(t); applyTheme(t); }, []);
  const setTheme = useCallback(t => {
    const next = t === 'light' ? 'light' : 'dark';
    setThemeState(next);
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
  }, []);
  return [theme, setTheme];
}
