// Shapes exchanged between the web app and the worker API.
import type { IconName } from './icons';
import type { Vibe } from './vibes';

export const THEMES = ['light', 'system', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export interface Settings {
  name: string;
  vibe: Vibe;
  timezone: string;
  theme: Theme;
}

export interface Affirmation {
  id: number;
  text: string;
  icon: IconName;
  active: boolean;
  position: number;
}

export interface Reminder {
  id: number;
  /** 'HH:MM', 24h, in settings.timezone. */
  time: string;
  label: string;
  /** 7 chars of 0/1, Monday first. */
  days: string;
  active: boolean;
}

/** Payload sent inside a Web Push message and passed to the app on notification tap. */
export interface PushData {
  affirmationId: number | null;
  title: string;
  body: string;
  url: string;
}

export interface ApiError {
  error: string;
}

export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
export const AFFIRMATION_MAX = 200;
export const LABEL_MAX = 40;
export const NAME_MAX = 40;
