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

/** What {l} says in a title, from the reminder time: "morning boost", "afternoon lift"… */
export function labelForTime(time: string | null): string {
  if (!time) return 'reminder';
  const h = Number(time.split(':')[0]);
  return h < 12 ? 'morning boost' : h < 17 ? 'afternoon lift' : 'evening glow';
}

export interface PayloadInput {
  vibe: Vibe;
  name: string;
  affirmation: { id: number; text: string; time: string | null };
}

export function buildPayload(input: PayloadInput, rand: Rand = Math.random): PushData {
  const titles = VIBES[input.vibe].titles;
  const template = titles[Math.floor(rand() * titles.length)] ?? titles[0] ?? '';
  return {
    affirmationId: input.affirmation.id,
    title: fillTitle(template, input.name, labelForTime(input.affirmation.time)),
    body: vibeBody(input.affirmation.text, input.vibe),
    vibe: input.vibe,
    url: '/?moment=1',
  };
}
