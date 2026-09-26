// Every-minute cron: sends due reminders as Web Push notifications.
import type { Env } from './env';
import {
  AFF_COLS,
  REM_COLS,
  getSettings,
  toSettings,
  type AffirmationRow,
  type ReminderRow,
} from './db';
import { sendPush, type Subscription, type Vapid } from './push';
import { buildPayload, pickAffirmation } from '../../shared/payload';
import type { PushData } from '../../shared/types';

/** How many minutes late a reminder may still go out (cron runs can be delayed or skipped). */
export const GRACE_MINUTES = 2;

export interface LocalNow {
  /** 'YYYY-MM-DD' in the settings timezone. */
  date: string;
  /** Monday = 0 … Sunday = 6. */
  weekday: number;
  /** Minutes since local midnight. */
  minutes: number;
}

const WEEKDAYS: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function localNow(now: Date, timeZone: string): LocalNow {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  const hour = Number(get('hour')) % 24;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WEEKDAYS[get('weekday')] ?? 0,
    minutes: hour * 60 + Number(get('minute')),
  };
}

export interface ReminderLike {
  time: string;
  days: string;
  active: boolean | number;
  last_sent_on: string | null;
}

/**
 * Due when: active, today's day flag is on, not already sent today, and the reminder time is
 * now or up to GRACE_MINUTES ago (same local day).
 */
export function isDue(r: ReminderLike, now: LocalNow, grace = GRACE_MINUTES): boolean {
  if (!r.active) return false;
  if (r.days[now.weekday] !== '1') return false;
  if (r.last_sent_on === now.date) return false;
  const [h = NaN, m = NaN] = r.time.split(':').map(Number);
  const at = h * 60 + m;
  if (!Number.isFinite(at)) return false;
  const late = now.minutes - at;
  return late >= 0 && late <= grace;
}

export function vapidFromEnv(env: Env): Vapid | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return null;
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };
}

export interface FanOut {
  sent: number;
  failed: number;
  removed: number;
  errors: string[];
}

/** Sends one notification to every subscribed device; deletes dead subscriptions. */
export async function pushToAll(env: Env, vapid: Vapid, data: PushData): Promise<FanOut> {
  const { results: subs } = await env.DB.prepare(
    'SELECT endpoint, p256dh, auth FROM subscriptions',
  ).all<Subscription>();
  const out: FanOut = { sent: 0, failed: 0, removed: 0, errors: [] };
  const payload = JSON.stringify(data);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        const r = await sendPush(sub, payload, vapid);
        if (r.ok) {
          out.sent++;
        } else if (r.gone) {
          out.removed++;
          await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint = ?')
            .bind(sub.endpoint)
            .run();
        } else {
          out.failed++;
          out.errors.push(`${r.status} ${r.detail}`);
          console.error('Push failed', new URL(sub.endpoint).host, r.status, r.detail);
        }
      } catch (err) {
        out.failed++;
        out.errors.push(String(err));
        console.error('Push error', new URL(sub.endpoint).host, err);
      }
    }),
  );
  return out;
}

/** The cron job. */
export async function runScheduler(env: Env, now = new Date()): Promise<void> {
  // Deleted affirmations stay restorable for a day, then go for good.
  await env.DB.prepare(
    "DELETE FROM affirmations WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-1 day')",
  ).run();

  const settingsRow = await getSettings(env.DB);
  const settings = toSettings(settingsRow);
  const local = localNow(now, settings.timezone);

  const { results: reminders } = await env.DB.prepare(
    `SELECT ${REM_COLS} FROM reminders WHERE active = 1`,
  ).all<ReminderRow>();
  const due = reminders.filter((r) => isDue(r, local));
  if (!due.length) return;

  const { results: affs } = await env.DB.prepare(
    `SELECT ${AFF_COLS} FROM affirmations WHERE active = 1 AND deleted_at IS NULL`,
  ).all<AffirmationRow>();
  if (!affs.length) return; // nothing to say yet; try again next minute within the grace window

  const vapid = vapidFromEnv(env);
  if (!vapid) {
    console.error('Reminders are due but VAPID keys are not configured (see README step 3).');
    return;
  }

  let lastId = settingsRow.last_affirmation_id;
  for (const r of due) {
    // Claim the reminder first so an overlapping run can't send it twice.
    const claim = await env.DB.prepare(
      'UPDATE reminders SET last_sent_on = ? WHERE id = ? AND (last_sent_on IS NULL OR last_sent_on != ?)',
    )
      .bind(local.date, r.id, local.date)
      .run();
    if (claim.meta.changes !== 1) continue;

    const aff = pickAffirmation(affs, lastId);
    if (!aff) continue;
    lastId = aff.id;
    const data = buildPayload({
      vibe: settings.vibe,
      name: settings.name,
      label: r.label,
      affirmation: aff,
    });
    const res = await pushToAll(env, vapid, data);
    console.log(
      `Reminder ${r.id} (${r.time}): sent ${res.sent}, failed ${res.failed}, removed ${res.removed}`,
    );
  }
  await env.DB.prepare('UPDATE settings SET last_affirmation_id = ? WHERE id = 1')
    .bind(lastId)
    .run();
}
