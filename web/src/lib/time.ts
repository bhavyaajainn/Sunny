import type { Reminder } from '../../../shared/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** '07:30' → '7:30 AM' */
export function formatTime(t: string): string {
  const [hs = '0', ms = '0'] = t.split(':');
  const h = Number(hs);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${ms.padStart(2, '0')} ${ap}`;
}

export function greeting(now: Date, name: string): string {
  const h = now.getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name.trim() ? `${part}, ${name.trim()}` : part;
}

/** The next active reminder after `now`, with a label like "Tomorrow, 7:30 AM". */
export function nextReminder(
  reminders: readonly Reminder[],
  now: Date,
): { reminder: Reminder | null; text: string } {
  const mins = now.getHours() * 60 + now.getMinutes();
  const dow = (now.getDay() + 6) % 7; // Mon = 0
  const on = reminders.filter((r) => r.active).sort((a, b) => a.time.localeCompare(b.time));
  for (let d = 0; d < 8; d++) {
    const day = (dow + d) % 7;
    for (const r of on) {
      const [h = 0, m = 0] = r.time.split(':').map(Number);
      if (r.days[day] === '1' && (d > 0 || h * 60 + m > mins)) {
        const prefix = d === 0 ? '' : d === 1 ? 'Tomorrow, ' : `${WEEKDAYS[day]}, `;
        return { reminder: r, text: prefix + formatTime(r.time) };
      }
    }
  }
  return { reminder: null, text: 'None scheduled' };
}
