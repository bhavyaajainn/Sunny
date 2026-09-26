// Shapes exchanged between the web app and the worker API.
import type { IconName } from './icons';
import type { Vibe } from './vibes';

export const THEMES = ['light', 'system', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export interface Settings {
  name: string;
  timezone: string;
  theme: Theme;
}

/** An affirmation is also its own reminder: at `time`, on `days`, this text is sent. */
export interface Affirmation {
  id: number;
  text: string;
  icon: IconName;
  /** Included on Today and sends its reminder. */
  active: boolean;
  position: number;
  /** 'HH:MM', 24h, in settings.timezone. null only for affirmations made before times existed. */
  time: string | null;
  /** 7 chars of 0/1, Monday first. */
  days: string;
  /** Notification title style and Moment colors. */
  vibe: Vibe;
}

/** Payload sent inside a Web Push message and passed to the app on notification tap. */
export interface PushData {
  affirmationId: number | null;
  title: string;
  body: string;
  vibe: Vibe;
  url: string;
}

export interface ApiError {
  error: string;
}

export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
export const AFFIRMATION_MAX = 200;
export const NAME_MAX = 40;
