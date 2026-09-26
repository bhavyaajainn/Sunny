import { useEffect } from 'react';
import type { Theme } from '../../../shared/types';
import { VIBES, type Vibe } from '../../../shared/vibes';

const LIGHT_BAR = '#FFD23F';
const DARK_BAR = '#241836';

/** Applies the theme (data-theme on <html>), the browser bar color, and the vibe colors. */
export function useThemeAndVibe(theme: Theme, vibe: Vibe): void {
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

  useEffect(() => {
    const [m1, m2, m3] = VIBES[vibe].colors;
    const root = document.documentElement;
    root.style.setProperty('--m1', m1);
    root.style.setProperty('--m2', m2);
    root.style.setProperty('--m3', m3);
  }, [vibe]);
}
