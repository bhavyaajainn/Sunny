// The 8 positive icons, copied verbatim from design/sunny-prototype.html (ICONS).
// Each value is the inner markup of an <svg viewBox="0 0 32 32">.

export const ICON_NAMES = [
  'sun',
  'sprout',
  'flower',
  'heart',
  'star',
  'rainbow',
  'cloud',
  'moon',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const ICON_SVGS: Record<IconName, string> = {
  sun: '<circle cx="16" cy="16" r="7" fill="#FFB800"/><g stroke="#FF8A3D" stroke-width="2.5" stroke-linecap="round"><path d="M16 2v4M16 26v4M2 16h4M26 16h4M6.1 6.1l2.8 2.8M23.1 23.1l2.8 2.8M6.1 25.9l2.8-2.8M23.1 8.9l2.8-2.8"/></g>',
  sprout:
    '<path d="M16 28V15" stroke="#3FA34D" stroke-width="2.5" stroke-linecap="round"/><path d="M16 17C16 10 11 6 4 6c0 7 5 11 12 11z" fill="#6CCB5F"/><path d="M16 14c0-6 4-10 12-10 0 6-4 10-12 10z" fill="#9BE07A"/><path d="M9 29h14" stroke="#C07A3E" stroke-width="3" stroke-linecap="round"/>',
  flower:
    '<g fill="#FF7BAC"><circle cx="16" cy="9" r="5"/><circle cx="22.7" cy="13.8" r="5"/><circle cx="20.1" cy="21.7" r="5"/><circle cx="11.9" cy="21.7" r="5"/><circle cx="9.3" cy="13.8" r="5"/></g><circle cx="16" cy="16" r="4.5" fill="#FFD23F"/>',
  heart:
    '<path d="M16 28S4 20.5 4 12a6 6 0 0 1 12-1 6 6 0 0 1 12 1c0 8.5-12 16-12 16z" fill="#FF4E6A"/><path d="M9 10a3 3 0 0 1 3-2" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".7"/>',
  star: '<path d="M16 3l3.9 8 8.8 1.2-6.4 6.1 1.6 8.7L16 22.8 8.1 27l1.6-8.7-6.4-6.1 8.8-1.2z" fill="#FFC93C" stroke="#F29F05" stroke-width="1.5" stroke-linejoin="round"/>',
  rainbow:
    '<g fill="none" stroke-width="3.2" stroke-linecap="round"><path d="M3 25a13 13 0 0 1 26 0" stroke="#FF5E5E"/><path d="M7.5 25a8.5 8.5 0 0 1 17 0" stroke="#FFC93C"/><path d="M12 25a4 4 0 0 1 8 0" stroke="#5EC8F2"/></g>',
  cloud:
    '<path d="M9 25a5.5 5.5 0 0 1-.8-10.9A7.5 7.5 0 0 1 22.6 12 6.5 6.5 0 0 1 23 25z" fill="#fff" stroke="#8FD3FF" stroke-width="2" stroke-linejoin="round"/>',
  moon: '<path d="M20 4a12 12 0 1 0 8 18A10 10 0 0 1 20 4z" fill="#FFE27A" stroke="#E0A800" stroke-width="1.5" stroke-linejoin="round"/><circle cx="13" cy="15" r="1.6" fill="#E0A800"/><circle cx="17" cy="22" r="1.2" fill="#E0A800"/>',
};

export function isIconName(v: unknown): v is IconName {
  return typeof v === 'string' && (ICON_NAMES as readonly string[]).includes(v);
}

/** Icon for a reminder time: before 11 sun, before 16 flower, before 19 rainbow, else moon. */
export function timeIcon(time: string): IconName {
  const h = Number(time.split(':')[0]);
  return h < 11 ? 'sun' : h < 16 ? 'flower' : h < 19 ? 'rainbow' : 'moon';
}
