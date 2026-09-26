import type { Affirmation } from '../../../shared/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** '07:30' → '7:30 AM' */
export function formatTime(t: string): string {
  const [hs = '0', ms = '0'] = t.split(':');
  const h = Number(hs);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${ms.padStart(2, '0')} ${ap}`;
}

/** '1111111' → 'Every day', '1111100' → 'Weekdays', '0000011' → 'Weekends', else 'Mon, Wed, Fri'. */
export function formatDays(days: string): string {
  if (days === '1111111') return 'Every day';
  if (days === '1111100') return 'Weekdays';
  if (days === '0000011') return 'Weekends';
  return WEEKDAYS.filter((_, i) => days[i] === '1').join(', ');
}

export function greeting(now: Date, name: string): string {
  const h = now.getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name.trim() ? `${part}, ${name.trim()}` : part;
}

/** The next affirmation due after `now`, with a label like "Tomorrow, 7:30 AM". */
export function nextReminder(
  affirmations: readonly Affirmation[],
  now: Date,
): { affirmation: Affirmation | null; text: string } {
  const mins = now.getHours() * 60 + now.getMinutes();
  const dow = (now.getDay() + 6) % 7; // Mon = 0
  const on = affirmations
    .filter((a): a is Affirmation & { time: string } => a.active && a.time !== null)
    .sort((a, b) => a.time.localeCompare(b.time));
  for (let d = 0; d < 8; d++) {
    const day = (dow + d) % 7;
    for (const a of on) {
      const [h = 0, m = 0] = a.time.split(':').map(Number);
      if (a.days[day] === '1' && (d > 0 || h * 60 + m > mins)) {
        const prefix = d === 0 ? '' : d === 1 ? 'Tomorrow, ' : `${WEEKDAYS[day]}, `;
        return { affirmation: a, text: prefix + formatTime(a.time) };
      }
    }
  }
  return { affirmation: null, text: 'None scheduled' };
}
