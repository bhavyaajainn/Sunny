import type { IconName } from './icons';

export const VIBE_NAMES = [
  'sunny',
  'hype',
  'calm',
  'love',
  'bold',
  'zen',
  'dreamy',
  'fresh',
  'cozy',
  'grateful',
] as const;
export type Vibe = (typeof VIBE_NAMES)[number];

export interface VibeDef {
  /** Picker label, e.g. "Hype". */
  name: string;
  /** Picker / card symbol, e.g. "🔥". */
  symbol: string;
  /** Title templates. {n} = name (fallback "friend"), {l} = time-of-day label. */
  titles: readonly string[];
  /** Appended to the notification body. */
  emoji: string;
  /** Moment / banner gradient colors (--m1, --m2, --m3). */
  colors: readonly [string, string, string];
  /** The 3 bobbing icons on the Moment screen. */
  icons: readonly [IconName, IconName, IconName];
}

export const VIBES: Record<Vibe, VibeDef> = {
  sunny: {
    name: 'Sunny',
    symbol: '☀️',
    titles: [
      '☀️ Your {l} is here',
      '🌻 A little sunshine for you, {n}',
      '✨ Pause for 5 seconds, {n}',
    ],
    emoji: '☀️',
    colors: ['#FF9F1C', '#FF5E3A', '#E8356D'],
    icons: ['sun', 'flower', 'sprout'],
  },
  hype: {
    name: 'Hype',
    symbol: '🔥',
    titles: [
      "🔥 Hey {n}, this one's for you!",
      '⚡ Power-up time, {n}!',
      '🚀 Say it out loud, {n}!',
    ],
    emoji: '💪',
    colors: ['#FF4E8A', '#FF8A3D', '#7B2FF7'],
    icons: ['star', 'heart', 'sun'],
  },
  calm: {
    name: 'Calm',
    symbol: '🌙',
    titles: ['🌙 Breathe in, {n}', '🍃 A gentle reminder for you', '💛 Just for you, {n}'],
    emoji: '🌿',
    colors: ['#5EC8F2', '#8B7CF6', '#4A3A8C'],
    icons: ['moon', 'cloud', 'sprout'],
  },
  love: {
    name: 'Love',
    symbol: '💖',
    titles: ['💖 Sending you love, {n}', '💌 A love note for you', '🌷 You are so loved, {n}'],
    emoji: '💖',
    colors: ['#FF6FB5', '#FF9A8B', '#C850C0'],
    icons: ['heart', 'flower', 'star'],
  },
  bold: {
    name: 'Bold',
    symbol: '🦁',
    titles: ["💥 Let's go, {n}!", "🦁 Roar, {n}. You've got this.", '🏆 Champion energy, {n}'],
    emoji: '🦁',
    colors: ['#FF3D3D', '#FF8A00', '#3A1C71'],
    icons: ['star', 'sun', 'heart'],
  },
  zen: {
    name: 'Zen',
    symbol: '🪷',
    titles: ['🧘 Pause. Breathe. {n}', '🍵 A quiet moment for you', '🪷 Be here now, {n}'],
    emoji: '🪷',
    colors: ['#7DD3A8', '#4FB3A9', '#2F6F73'],
    icons: ['sprout', 'cloud', 'moon'],
  },
  dreamy: {
    name: 'Dreamy',
    symbol: '🦋',
    titles: ['✨ Make a wish, {n}', '🌌 Dream big, {n}', '🦋 A little magic for you'],
    emoji: '🦋',
    colors: ['#A18CD1', '#FBC2EB', '#6A82FB'],
    icons: ['star', 'moon', 'cloud'],
  },
  fresh: {
    name: 'Fresh',
    symbol: '🌱',
    titles: ['🌱 Fresh start, {n}', '🍃 New moment, new you', '🌼 Bloom where you are, {n}'],
    emoji: '🌱',
    colors: ['#56CCF2', '#6FCF97', '#219653'],
    icons: ['sprout', 'flower', 'sun'],
  },
  cozy: {
    name: 'Cozy',
    symbol: '☕',
    titles: ['☕ Slow down, {n}', '🧸 Wrap yourself in this', '🕯️ Warm thoughts for you, {n}'],
    emoji: '🧸',
    colors: ['#F6B26B', '#E07A5F', '#8E5B4A'],
    icons: ['heart', 'moon', 'cloud'],
  },
  grateful: {
    name: 'Grateful',
    symbol: '🙏',
    titles: ['🙏 Thank you, {n}', '🌻 One good thing, {n}', '💛 Grateful for you, {n}'],
    emoji: '🙏',
    colors: ['#FFD86F', '#FC6262', '#B24592'],
    icons: ['flower', 'heart', 'rainbow'],
  },
};

export function isVibe(v: unknown): v is Vibe {
  return typeof v === 'string' && (VIBE_NAMES as readonly string[]).includes(v);
}

/** Fill a title template. */
export function fillTitle(template: string, name: string, label: string): string {
  return template
    .replaceAll('{n}', name.trim() || 'friend')
    .replaceAll('{l}', (label.trim() || 'reminder').toLowerCase());
}

/** Body text for a notification: the affirmation followed by the vibe emoji. */
export function vibeBody(text: string, vibe: Vibe): string {
  return `${text} ${VIBES[vibe].emoji}`;
}
