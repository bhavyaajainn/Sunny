// Turning service-worker messages and launch URLs into Moment data.
import type { Affirmation, PushData } from '../../../shared/types';
import { isVibe, vibeBody } from '../../../shared/vibes';

/** Validates the untyped data a service worker message carries. */
export function toPushData(v: unknown): PushData | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title : '';
  const body = typeof o.body === 'string' ? o.body : '';
  if (!title && !body) return null;
  const id = typeof o.affirmationId === 'number' ? o.affirmationId : null;
  return { affirmationId: id, title, body, vibe: isVibe(o.vibe) ? o.vibe : 'sunny', url: '/' };
}

/**
 * Reads /?moment=1&a=<id>&t=<title>&b=<body>&v=<vibe>, the URL the service worker opens when a
 * notification is tapped while Sunny is closed.
 */
export function momentFromUrl(
  search: string,
  affirmations: readonly Affirmation[],
): PushData | null {
  const q = new URLSearchParams(search);
  if (q.get('moment') !== '1') return null;
  const idNum = Number(q.get('a'));
  const id = Number.isInteger(idNum) && idNum > 0 ? idNum : null;
  const title = q.get('t') ?? '';
  const a = id === null ? undefined : affirmations.find((x) => x.id === id);
  const v = q.get('v');
  const vibe = isVibe(v) ? v : (a?.vibe ?? 'sunny');
  let body = q.get('b') ?? '';
  if (!body && a) body = vibeBody(a.text, vibe);
  if (!title && !body) return null;
  return { affirmationId: id, title, body, vibe, url: '/' };
}
