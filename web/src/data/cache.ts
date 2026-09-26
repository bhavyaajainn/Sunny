// Last-known server data, so the app opens instantly and can be read offline.
import type { Affirmation, Reminder, Settings } from '../../../shared/types';

const KEY = 'sunny.cache.v1';

export interface Snapshot {
  settings: Settings;
  affirmations: Affirmation[];
  reminders: Reminder[];
}

export function readCache(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Snapshot>;
    if (!v.settings || !Array.isArray(v.affirmations) || !Array.isArray(v.reminders)) return null;
    return v as Snapshot;
  } catch {
    return null;
  }
}

export function writeCache(s: Snapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage full or blocked: offline reading just won't be available.
  }
}

export function clearCache(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
