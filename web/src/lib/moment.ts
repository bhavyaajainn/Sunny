// Turning service-worker messages and launch URLs into Moment data.
import type { Affirmation, PushData } from '../../../shared/types';
import { vibeBody, type Vibe } from '../../../shared/vibes';

/** Validates the untyped data a service worker message carries. */
export function toPushData(v: unknown): PushData | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title : '';
  const body = typeof o.body === 'string' ? o.body : '';
  if (!title && !body) return null;
  const id = typeof o.affirmationId === 'number' ? o.affirmationId : null;
  return { affirmationId: id, title, body, url: '/' };
}

/**
 * Reads /?moment=1&a=<id>&t=<title>&b=<body>, the URL the service worker opens when a
 * notification is tapped while Sunny is closed.
 */
export function momentFromUrl(
  search: string,
  affirmations: readonly Affirmation[],
  vibe: Vibe,
): PushData | null {
  const q = new URLSearchParams(search);
  if (q.get('moment') !== '1') return null;
  const idNum = Number(q.get('a'));
  const id = Number.isInteger(idNum) && idNum > 0 ? idNum : null;
  const title = q.get('t') ?? '';
  let body = q.get('b') ?? '';
  if (!body && id !== null) {
    const a = affirmations.find((x) => x.id === id);
    if (a) body = vibeBody(a.text, vibe);
  }
  if (!title && !body) return null;
  return { affirmationId: id, title, body, url: '/' };
}
