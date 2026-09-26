// /api/* route handlers.
import type { Env } from './env';
import {
  AFF_COLS,
  REM_COLS,
  getSettings,
  toAffirmation,
  toReminder,
  toSettings,
  type AffirmationRow,
  type ReminderRow,
  type SettingsRow,
} from './db';
import { HttpError, errorResponse, json, noContent, readJson, setClause } from './http';
import * as v from './validate';
import { pushToAll, vapidFromEnv } from './scheduler';
import { buildPayload, pickAffirmation } from '../../shared/payload';
import type { Affirmation, Reminder, Settings } from '../../shared/types';

interface Ctx {
  env: Env;
  request: Request;
  id: number;
}
type Handler = (c: Ctx) => Promise<Response>;

function check<T>(r: v.Check<T>): T {
  if (!r.ok) throw new HttpError(400, r.error);
  return r.value;
}

// ---------- Settings ----------

const getSettingsH: Handler = async ({ env }) =>
  json<Settings>(toSettings(await getSettings(env.DB)));

const patchSettings: Handler = async ({ env, request }) => {
  const patch = check(v.settingsPatch(await readJson(request)));
  const { sql, values } = setClause({ ...patch });
  const row = await env.DB.prepare(
    `UPDATE settings SET ${sql} WHERE id = 1
     RETURNING name, vibe, timezone, theme, last_affirmation_id`,
  )
    .bind(...values)
    .first<SettingsRow>();
  if (!row) throw new Error('settings row missing');
  return json<Settings>(toSettings(row));
};

// ---------- Affirmations ----------

const listAffirmations: Handler = async ({ env }) => {
  // Deleted items stay restorable (Undo) for a day, then are purged.
  await env.DB.prepare(
    "DELETE FROM affirmations WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-1 day')",
  ).run();
  const { results } = await env.DB.prepare(
    `SELECT ${AFF_COLS} FROM affirmations WHERE deleted_at IS NULL ORDER BY position, id`,
  ).all<AffirmationRow>();
  return json<Affirmation[]>(results.map(toAffirmation));
};

const createAffirmation: Handler = async ({ env, request }) => {
  const { text, icon } = check(v.affirmationCreate(await readJson(request)));
  // New ones go to the top of the list.
  const row = await env.DB.prepare(
    `INSERT INTO affirmations (text, icon, position)
     VALUES (?, ?, (SELECT COALESCE(MIN(position), 0) - 1 FROM affirmations))
     RETURNING ${AFF_COLS}`,
  )
    .bind(text, icon)
    .first<AffirmationRow>();
  if (!row) throw new Error('insert returned nothing');
  return json<Affirmation>(toAffirmation(row), 201);
};

const notFoundAff = () =>
  new HttpError(404, 'That affirmation no longer exists. Pull to refresh or reopen the app.');

const patchAffirmation: Handler = async ({ env, request, id }) => {
  const patch = check(v.affirmationPatch(await readJson(request)));
  const { sql, values } = setClause({ ...patch });
  const row = await env.DB.prepare(
    `UPDATE affirmations SET ${sql} WHERE id = ? AND deleted_at IS NULL RETURNING ${AFF_COLS}`,
  )
    .bind(...values, id)
    .first<AffirmationRow>();
  if (!row) throw notFoundAff();
  return json<Affirmation>(toAffirmation(row));
};

const deleteAffirmation: Handler = async ({ env, id }) => {
  const res = await env.DB.prepare(
    "UPDATE affirmations SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(id)
    .run();
  if (res.meta.changes !== 1) throw notFoundAff();
  return noContent();
};

const restoreAffirmation: Handler = async ({ env, id }) => {
  const row = await env.DB.prepare(
    `UPDATE affirmations SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL
     RETURNING ${AFF_COLS}`,
  )
    .bind(id)
    .first<AffirmationRow>();
  if (!row) throw new HttpError(404, "That affirmation can't be restored any more.");
  return json<Affirmation>(toAffirmation(row));
};

// ---------- Reminders ----------

const listReminders: Handler = async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT ${REM_COLS} FROM reminders ORDER BY time, id`,
  ).all<ReminderRow>();
  return json<Reminder[]>(results.map(toReminder));
};

const createReminder: Handler = async ({ env, request }) => {
  const r = check(v.reminderCreate(await readJson(request)));
  const row = await env.DB.prepare(
    `INSERT INTO reminders (time, label, days) VALUES (?, ?, ?) RETURNING ${REM_COLS}`,
  )
    .bind(r.time, r.label, r.days)
    .first<ReminderRow>();
  if (!row) throw new Error('insert returned nothing');
  return json<Reminder>(toReminder(row), 201);
};

const notFoundRem = () =>
  new HttpError(404, 'That reminder no longer exists. Reopen the app to refresh.');

const patchReminder: Handler = async ({ env, request, id }) => {
  const patch = check(v.reminderPatch(await readJson(request)));
  // A new time or new days means today's reminder may still be due: clear the dedupe marker.
  const reset = patch.time !== undefined || patch.days !== undefined;
  const { sql, values } = setClause({ ...patch });
  const row = await env.DB.prepare(
    `UPDATE reminders SET ${sql}${reset ? ', last_sent_on = NULL' : ''} WHERE id = ?
     RETURNING ${REM_COLS}`,
  )
    .bind(...values, id)
    .first<ReminderRow>();
  if (!row) throw notFoundRem();
  return json<Reminder>(toReminder(row));
};

const deleteReminder: Handler = async ({ env, id }) => {
  const res = await env.DB.prepare('DELETE FROM reminders WHERE id = ?').bind(id).run();
  if (res.meta.changes !== 1) throw notFoundRem();
  return noContent();
};

// ---------- Push ----------

const publicKey: Handler = async ({ env }) => {
  if (!env.VAPID_PUBLIC_KEY) {
    throw new HttpError(
      503,
      "Notifications aren't configured on the server yet. Set VAPID_PUBLIC_KEY (README step 3).",
    );
  }
  return json({ key: env.VAPID_PUBLIC_KEY });
};

const subscribe: Handler = async ({ env, request }) => {
  const s = check(v.subscription(await readJson(request)));
  await env.DB.prepare(
    `INSERT INTO subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
  )
    .bind(s.endpoint, s.p256dh, s.auth)
    .run();
  return noContent();
};

const testPush: Handler = async ({ env }) => {
  const vapid = vapidFromEnv(env);
  if (!vapid) {
    throw new HttpError(
      503,
      "Notifications aren't configured on the server yet. Set the VAPID keys (README step 3).",
    );
  }
  const subs = await env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions').first<{
    n: number;
  }>();
  if (!subs?.n) {
    throw new HttpError(
      409,
      'No phone is signed up for notifications yet. Open Sunny from its Home Screen icon, then Settings → Notifications → Turn on.',
    );
  }
  // The API is open, so limit tests to one every 10 seconds.
  const claim = await env.DB.prepare(
    `UPDATE settings SET last_test_at = datetime('now') WHERE id = 1
     AND (last_test_at IS NULL OR last_test_at <= datetime('now', '-10 seconds'))`,
  ).run();
  if (claim.meta.changes !== 1) {
    throw new HttpError(429, 'You just sent a test. Wait 10 seconds, then try again.');
  }

  const s = await getSettings(env.DB);
  const { results: affs } = await env.DB.prepare(
    `SELECT ${AFF_COLS} FROM affirmations WHERE active = 1 AND deleted_at IS NULL`,
  ).all<AffirmationRow>();
  const aff = pickAffirmation(affs, s.last_affirmation_id);
  if (!aff) {
    throw new HttpError(409, 'Turn on at least one affirmation first, then send a test.');
  }
  const settings = toSettings(s);
  const data = buildPayload({
    vibe: settings.vibe,
    name: settings.name,
    label: 'reminder',
    affirmation: aff,
  });
  const res = await pushToAll(env, vapid, data);
  if (res.sent === 0) {
    throw new HttpError(
      502,
      res.removed > 0
        ? "This phone's notification sign-up had expired. Open Settings, tap Turn on again, then send another test."
        : "Apple's push service didn't accept the notification. Try again in a minute.",
    );
  }
  return json({ sent: res.sent, failed: res.failed });
};

// ---------- Router ----------

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

const ID = '(\\d{1,12})';
const routes: Route[] = [
  { method: 'GET', pattern: /^\/api\/settings$/, handler: getSettingsH },
  { method: 'PATCH', pattern: /^\/api\/settings$/, handler: patchSettings },
  { method: 'GET', pattern: /^\/api\/affirmations$/, handler: listAffirmations },
  { method: 'POST', pattern: /^\/api\/affirmations$/, handler: createAffirmation },
  { method: 'PATCH', pattern: new RegExp(`^/api/affirmations/${ID}$`), handler: patchAffirmation },
  {
    method: 'DELETE',
    pattern: new RegExp(`^/api/affirmations/${ID}$`),
    handler: deleteAffirmation,
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/api/affirmations/${ID}/restore$`),
    handler: restoreAffirmation,
  },
  { method: 'GET', pattern: /^\/api\/reminders$/, handler: listReminders },
  { method: 'POST', pattern: /^\/api\/reminders$/, handler: createReminder },
  { method: 'PATCH', pattern: new RegExp(`^/api/reminders/${ID}$`), handler: patchReminder },
  { method: 'DELETE', pattern: new RegExp(`^/api/reminders/${ID}$`), handler: deleteReminder },
  { method: 'GET', pattern: /^\/api\/push\/public-key$/, handler: publicKey },
  { method: 'POST', pattern: /^\/api\/push\/subscribe$/, handler: subscribe },
  { method: 'POST', pattern: /^\/api\/push\/test$/, handler: testPush },
];

export async function handleApi(request: Request, env: Env, path: string): Promise<Response> {
  let pathMatched = false;
  for (const r of routes) {
    const m = r.pattern.exec(path);
    if (!m) continue;
    pathMatched = true;
    if (r.method !== request.method) continue;
    try {
      return await r.handler({ env, request, id: Number(m[1] ?? 0) });
    } catch (err) {
      if (err instanceof HttpError) return errorResponse(err.status, err.message);
      throw err;
    }
  }
  return pathMatched
    ? errorResponse(405, `${request.method} isn't supported on ${path}.`)
    : errorResponse(404, 'That API route does not exist. Check the URL and method.');
}
