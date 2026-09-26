import { useEffect } from 'react';
import type { Theme } from '../../../shared/types';

const LIGHT_BAR = '#FFD23F';
const DARK_BAR = '#241836';

/** Applies the theme (data-theme on <html>) and the browser bar color. */
export function useTheme(theme: Theme): void {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const paint = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      meta?.setAttribute('content', dark ? DARK_BAR : LIGHT_BAR);
    };
    paint();
    mq.addEventListener('change', paint);
    return () => mq.removeEventListener('change', paint);
  }, [theme]);
}
