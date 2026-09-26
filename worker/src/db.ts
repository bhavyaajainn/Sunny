// Row types and mappers between D1 rows and API shapes.
import { isIconName } from '../../shared/icons';
import { isVibe } from '../../shared/vibes';
import { THEMES, type Affirmation, type Settings, type Theme } from '../../shared/types';

export interface SettingsRow {
  name: string;
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
  time: string | null;
  days: string;
  vibe: string;
  last_sent_on: string | null;
}

export function toSettings(r: SettingsRow): Settings {
  return {
    name: r.name,
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
    time: r.time,
    days: r.days,
    vibe: isVibe(r.vibe) ? r.vibe : 'sunny',
  };
}

export const AFF_COLS = 'id, text, icon, active, position, time, days, vibe, last_sent_on';
export const SETTINGS_COLS = 'name, timezone, theme, last_affirmation_id';

export async function getSettings(db: D1Database): Promise<SettingsRow> {
  const row = await db
    .prepare(`SELECT ${SETTINGS_COLS} FROM settings WHERE id = 1`)
    .first<SettingsRow>();
  if (!row) throw new Error('settings row missing: run the D1 migrations');
  return row;
}
