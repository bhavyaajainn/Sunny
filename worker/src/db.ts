// Row types and mappers between D1 rows and API shapes.
import { isIconName } from '../../shared/icons';
import { isVibe } from '../../shared/vibes';
import {
  THEMES,
  type Affirmation,
  type Reminder,
  type Settings,
  type Theme,
} from '../../shared/types';

export interface SettingsRow {
  name: string;
  vibe: string;
  timezone: string;
  theme: string;
  last_affirmation_id: number | null;
}

export interface AffirmationRow {
  id: number;
  text: string;
  icon: string;
  active: number;
  position: number;
}

export interface ReminderRow {
  id: number;
  time: string;
  label: string;
  days: string;
  active: number;
  last_sent_on: string | null;
}

export function toSettings(r: SettingsRow): Settings {
  return {
    name: r.name,
    vibe: isVibe(r.vibe) ? r.vibe : 'sunny',
    timezone: r.timezone,
    theme: (THEMES as readonly string[]).includes(r.theme) ? (r.theme as Theme) : 'system',
  };
}

export function toAffirmation(r: AffirmationRow): Affirmation {
  return {
    id: r.id,
    text: r.text,
    icon: isIconName(r.icon) ? r.icon : 'sun',
    active: r.active === 1,
    position: r.position,
  };
}

export function toReminder(r: ReminderRow): Reminder {
  return { id: r.id, time: r.time, label: r.label, days: r.days, active: r.active === 1 };
}

export const AFF_COLS = 'id, text, icon, active, position';
export const REM_COLS = 'id, time, label, days, active, last_sent_on';

export async function getSettings(db: D1Database): Promise<SettingsRow> {
  const row = await db
    .prepare('SELECT name, vibe, timezone, theme, last_affirmation_id FROM settings WHERE id = 1')
    .first<SettingsRow>();
  if (!row) throw new Error('settings row missing: run the D1 migrations');
  return row;
}
