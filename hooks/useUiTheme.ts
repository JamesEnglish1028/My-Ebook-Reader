import { useEffect, useMemo, useState } from 'react';

import { UI_KEYS } from '../constants';
import { useLocalStorage } from './useLocalStorage';

export type UiThemePreference = 'system' | 'light' | 'dark';
export type ResolvedUiTheme = 'light' | 'dark';

const getSystemTheme = (): ResolvedUiTheme => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function useUiTheme() {
  const [uiTheme, setUiTheme] = useLocalStorage<UiThemePreference>(UI_KEYS.THEME, 'system');
  const [systemTheme, setSystemTheme] = useState<ResolvedUiTheme>(() => getSystemTheme());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const resolvedTheme = useMemo<ResolvedUiTheme>(
    () => (uiTheme === 'system' ? systemTheme : uiTheme),
    [systemTheme, uiTheme],
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    root.dataset.uiTheme = uiTheme;
    root.dataset.uiThemeResolved = resolvedTheme;

    body.dataset.uiTheme = uiTheme;
    body.dataset.uiThemeResolved = resolvedTheme;

    body.classList.remove('bg-slate-900', 'text-white', 'bg-slate-50', 'text-slate-950');
    if (resolvedTheme === 'light') {
      body.classList.add('bg-slate-50', 'text-slate-950');
    } else {
      body.classList.add('bg-slate-900', 'text-white');
    }
  }, [resolvedTheme, uiTheme]);

  return {
    uiTheme,
    setUiTheme,
    resolvedTheme,
  };
}
