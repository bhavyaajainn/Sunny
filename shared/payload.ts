// Builds notification content. Used by the worker's cron and by the app's previews/banner.
import type { PushData } from './types';
import { VIBES, fillTitle, vibeBody, type Vibe } from './vibes';

export type Rand = () => number;

/** Random item, avoiding `avoidId` when there is any other choice. */
export function pickAffirmation<T extends { id: number }>(
  list: readonly T[],
  avoidId: number | null,
  rand: Rand = Math.random,
): T | null {
  const others = avoidId === null ? list : list.filter((a) => a.id !== avoidId);
  const pool = others.length > 0 ? others : list;
  return pool[Math.floor(rand() * pool.length)] ?? null;
}

export interface PayloadInput {
  vibe: Vibe;
  name: string;
  /** Reminder label, used for {l}. */
  label: string;
  affirmation: { id: number; text: string };
}

export function buildPayload(input: PayloadInput, rand: Rand = Math.random): PushData {
  const titles = VIBES[input.vibe].titles;
  const template = titles[Math.floor(rand() * titles.length)] ?? titles[0] ?? '';
  const title = fillTitle(template, input.name, input.label);
  const body = vibeBody(input.affirmation.text, input.vibe);
  return {
    affirmationId: input.affirmation.id,
    title,
    body,
    url: '/?moment=1',
  };
}
