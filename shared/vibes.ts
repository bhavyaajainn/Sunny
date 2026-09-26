import type { IconName } from './icons';

export const VIBE_NAMES = ['hype', 'sunny', 'calm'] as const;
export type Vibe = (typeof VIBE_NAMES)[number];

export interface VibeDef {
  /** Segmented-control label, e.g. "Hype 🔥". */
  label: string;
  /** Title templates. {n} = name (fallback "friend"), {l} = lowercased reminder label. */
  titles: readonly string[];
  /** Appended to the notification body. */
  emoji: string;
  /** Moment / banner gradient colors (--m1, --m2, --m3). */
  colors: readonly [string, string, string];
  /** The 3 bobbing icons on the Moment screen. */
  icons: readonly [IconName, IconName, IconName];
}

export const VIBES: Record<Vibe, VibeDef> = {
  hype: {
    label: 'Hype 🔥',
    titles: [
      "🔥 Hey {n}, this one's for you!",
      '⚡ Power-up time, {n}!',
      '🚀 Say it out loud, {n}!',
    ],
    emoji: '💪',
    colors: ['#FF4E8A', '#FF8A3D', '#7B2FF7'],
    icons: ['star', 'heart', 'sun'],
  },
  sunny: {
    label: 'Sunny ☀️',
    titles: [
      '☀️ Your {l} is here',
      '🌻 A little sunshine for you, {n}',
      '✨ Pause for 5 seconds, {n}',
    ],
    emoji: '☀️',
    colors: ['#FF9F1C', '#FF5E3A', '#E8356D'],
    icons: ['sun', 'flower', 'sprout'],
  },
  calm: {
    label: 'Calm 🌙',
    titles: ['🌙 Breathe in, {n}', '🍃 A gentle reminder for you', '💛 Just for you, {n}'],
    emoji: '🌿',
    colors: ['#5EC8F2', '#8B7CF6', '#4A3A8C'],
    icons: ['moon', 'cloud', 'sprout'],
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
