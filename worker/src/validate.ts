// Input validation for API bodies. Everything arrives as `unknown` and is narrowed here.
import { isIconName, type IconName } from '../../shared/icons';
import { isVibe, type Vibe } from '../../shared/vibes';
import { AFFIRMATION_MAX, NAME_MAX, THEMES, type Settings, type Theme } from '../../shared/types';

export type Check<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Check<T> => ({ ok: true, value });
const bad = <T>(error: string): Check<T> => ({ ok: false, error });

type Obj = Record<string, unknown>;
function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS_RE = /^[01]{7}$/;

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function text(v: unknown): Check<string> {
  if (typeof v !== 'string') return bad('Affirmation text is missing.');
  const t = v.trim();
  if (!t) return bad('Affirmation text is empty. Write a few words, then save.');
  if (t.length > AFFIRMATION_MAX)
    return bad(`Affirmations can be up to ${AFFIRMATION_MAX} characters. Shorten it a little.`);
  return ok(t);
}

function icon(v: unknown): Check<IconName> {
  return isIconName(v) ? ok(v) : bad('Pick one of the 8 icons.');
}

function time(v: unknown): Check<string> {
  return typeof v === 'string' && TIME_RE.test(v)
    ? ok(v)
    : bad('Time must look like 07:30 (24-hour HH:MM).');
}

function days(v: unknown): Check<string> {
  if (typeof v !== 'string' || !DAYS_RE.test(v))
    return bad('Days must be 7 characters of 0 or 1, Monday first.');
  if (!v.includes('1')) return bad('Pick at least one day.');
  return ok(v);
}

function bool(v: unknown, what: string): Check<boolean> {
  return typeof v === 'boolean' ? ok(v) : bad(`${what} must be true or false.`);
}

function vibe(v: unknown): Check<Vibe> {
  return isVibe(v) ? ok(v) : bad('Vibe must be hype, sunny or calm.');
}

export interface AffirmationCreate {
  text: string;
  icon: IconName;
  time: string;
  days: string;
  vibe: Vibe;
}

/** New affirmations always have a reminder time. */
export function affirmationCreate(body: unknown): Check<AffirmationCreate> {
  if (!isObj(body))
    return bad(
      'Send { "text": "...", "icon": "sun", "time": "07:30", "days": "1111111", "vibe": "sunny" }.',
    );
  const t = text(body.text);
  if (!t.ok) return t;
  const i = body.icon === undefined ? ok<IconName>('sun') : icon(body.icon);
  if (!i.ok) return i;
  if (body.time === undefined || body.time === null)
    return bad('Pick a time for this affirmation, then save.');
  const tm = time(body.time);
  if (!tm.ok) return tm;
  const d = body.days === undefined ? ok('1111111') : days(body.days);
  if (!d.ok) return d;
  const v = body.vibe === undefined ? ok<Vibe>('sunny') : vibe(body.vibe);
  if (!v.ok) return v;
  return ok({ text: t.value, icon: i.value, time: tm.value, days: d.value, vibe: v.value });
}

export type AffirmationPatch = Partial<AffirmationCreate & { active: boolean }>;

export function affirmationPatch(body: unknown): Check<AffirmationPatch> {
  if (!isObj(body)) return bad('Send the fields to change, like { "active": false }.');
  const out: AffirmationPatch = {};
  if (body.text !== undefined) {
    const t = text(body.text);
    if (!t.ok) return t;
    out.text = t.value;
  }
  if (body.icon !== undefined) {
    const i = icon(body.icon);
    if (!i.ok) return i;
    out.icon = i.value;
  }
  if (body.time !== undefined) {
    const tm = time(body.time);
    if (!tm.ok) return tm;
    out.time = tm.value;
  }
  if (body.days !== undefined) {
    const d = days(body.days);
    if (!d.ok) return d;
    out.days = d.value;
  }
  if (body.vibe !== undefined) {
    const v = vibe(body.vibe);
    if (!v.ok) return v;
    out.vibe = v.value;
  }
  if (body.active !== undefined) {
    const a = bool(body.active, 'active');
    if (!a.ok) return a;
    out.active = a.value;
  }
  if (Object.keys(out).length === 0)
    return bad('Nothing to change. Send text, icon, time, days, vibe or active.');
  return ok(out);
}

export function settingsPatch(body: unknown): Check<Partial<Settings>> {
  if (!isObj(body)) return bad('Send the settings to change, like { "name": "Bhavya" }.');
  const out: Partial<Settings> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') return bad('Name must be text.');
    const n = body.name.trim();
    if (n.length > NAME_MAX) return bad(`Names can be up to ${NAME_MAX} characters.`);
    out.name = n;
  }
  if (body.theme !== undefined) {
    if (typeof body.theme !== 'string' || !(THEMES as readonly string[]).includes(body.theme))
      return bad('Theme must be light, system or dark.');
    out.theme = body.theme as Theme;
  }
  if (body.timezone !== undefined) {
    if (typeof body.timezone !== 'string' || !isValidTimezone(body.timezone))
      return bad('Timezone must be an IANA name like Asia/Kolkata.');
    out.timezone = body.timezone;
  }
  if (Object.keys(out).length === 0) return bad('Nothing to change. Send name, theme or timezone.');
  return ok(out);
}

const B64URL_RE = /^[A-Za-z0-9_-]+={0,2}$/;

export function subscription(
  body: unknown,
): Check<{ endpoint: string; p256dh: string; auth: string }> {
  if (!isObj(body) || !isObj(body.keys))
    return bad('Send the PushSubscription JSON: { endpoint, keys: { p256dh, auth } }.');
  const { endpoint } = body;
  const { p256dh, auth } = body.keys;
  if (typeof endpoint !== 'string' || endpoint.length > 1024 || !endpoint.startsWith('https://'))
    return bad('The subscription endpoint must be an https URL.');
  if (typeof p256dh !== 'string' || !B64URL_RE.test(p256dh) || p256dh.length > 200)
    return bad('The subscription p256dh key is missing or malformed.');
  if (typeof auth !== 'string' || !B64URL_RE.test(auth) || auth.length > 100)
    return bad('The subscription auth key is missing or malformed.');
  return ok({ endpoint, p256dh, auth });
}
