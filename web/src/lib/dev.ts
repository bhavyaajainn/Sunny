// Dev-only shortcut: open http://localhost:5173/?screen=<name> to jump straight to a screen.
// Ignored in production builds.
export const DEV_SCREENS = [
  'install',
  'today',
  'affs',
  'reminders',
  'settings',
  'moment',
  'banner',
] as const;
export type DevScreen = (typeof DEV_SCREENS)[number];

export function readDevScreen(): DevScreen | null {
  if (!import.meta.env.DEV) return null;
  const s = new URLSearchParams(location.search).get('screen');
  return (DEV_SCREENS as readonly string[]).includes(s ?? '') ? (s as DevScreen) : null;
}
