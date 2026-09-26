import { describe, expect, it } from 'vitest';
import { isDue, localNow, type ReminderLike } from '../src/scheduler';
import { buildPayload, pickAffirmation } from '../../shared/payload';

// 2026-09-26 is a Saturday.
const utc = (iso: string) => new Date(iso);

describe('localNow', () => {
  it('converts to IST (UTC+5:30)', () => {
    expect(localNow(utc('2026-09-26T02:00:00Z'), 'Asia/Kolkata')).toEqual({
      date: '2026-09-26',
      weekday: 5, // Saturday
      minutes: 7 * 60 + 30,
    });
  });

  it('rolls the date over at local midnight, not UTC midnight', () => {
    // 19:00 UTC Sunday = 00:30 IST Monday
    expect(localNow(utc('2026-09-27T19:00:00Z'), 'Asia/Kolkata')).toEqual({
      date: '2026-09-28',
      weekday: 0,
      minutes: 30,
    });
  });

  it('respects other timezones', () => {
    expect(localNow(utc('2026-09-26T02:00:00Z'), 'America/New_York').date).toBe('2026-09-25');
    expect(localNow(utc('2026-09-26T00:00:00Z'), 'UTC').minutes).toBe(0);
  });
});

describe('isDue', () => {
  const base: ReminderLike = { time: '07:30', days: '1111111', active: 1, last_sent_on: null };
  const at = (iso: string) => localNow(utc(iso), 'Asia/Kolkata');

  it('fires at the exact IST minute', () => {
    expect(isDue(base, at('2026-09-26T02:00:00Z'))).toBe(true); // 07:30 IST
    expect(isDue(base, at('2026-09-26T01:59:00Z'))).toBe(false); // 07:29 IST
  });

  it('catches up to 2 minutes late, not 3', () => {
    expect(isDue(base, at('2026-09-26T02:01:00Z'))).toBe(true);
    expect(isDue(base, at('2026-09-26T02:02:00Z'))).toBe(true);
    expect(isDue(base, at('2026-09-26T02:03:00Z'))).toBe(false);
  });

  it('sends once per local day', () => {
    const now = at('2026-09-26T02:00:00Z');
    expect(isDue({ ...base, last_sent_on: '2026-09-26' }, now)).toBe(false);
    expect(isDue({ ...base, last_sent_on: '2026-09-25' }, now)).toBe(true);
  });

  it('respects day flags (Mon..Sun)', () => {
    const weekdays = { ...base, time: '13:00', days: '1111100' };
    expect(isDue(weekdays, at('2026-09-26T07:30:00Z'))).toBe(false); // Sat 13:00 IST
    expect(isDue(weekdays, at('2026-09-28T07:30:00Z'))).toBe(true); // Mon 13:00 IST
    expect(isDue({ ...base, days: '0000001' }, at('2026-09-27T02:00:00Z'))).toBe(true); // Sun
  });

  it('skips inactive reminders', () => {
    expect(isDue({ ...base, active: 0 }, at('2026-09-26T02:00:00Z'))).toBe(false);
    expect(isDue({ ...base, active: false }, at('2026-09-26T02:00:00Z'))).toBe(false);
  });
});

describe('payload builder', () => {
  const calmAff = { id: 1, text: 'I choose calm over rush.' };
  const goodAff = { id: 2, text: 'Good things are on their way to me.' };
  const affs = [calmAff, goodAff];

  it('avoids the last affirmation when there is another', () => {
    for (let i = 0; i < 20; i++) expect(pickAffirmation(affs, 1)?.id).toBe(2);
    expect(pickAffirmation([calmAff], 1)?.id).toBe(1);
    expect(pickAffirmation([], null)).toBeNull();
  });

  it('fills the title template and appends the vibe emoji', () => {
    const p = buildPayload(
      { vibe: 'sunny', name: 'Bhavya', label: 'Morning boost', affirmation: goodAff },
      () => 0, // first template
    );
    expect(p).toEqual({
      affirmationId: 2,
      title: '☀️ Your morning boost is here',
      body: 'Good things are on their way to me. ☀️',
      url: '/?moment=1',
    });
  });

  it('falls back to "friend" and uses each vibe', () => {
    const hype = buildPayload(
      { vibe: 'hype', name: '', label: 'x', affirmation: calmAff },
      () => 0,
    );
    expect(hype.title).toBe("🔥 Hey friend, this one's for you!");
    expect(hype.body.endsWith('💪')).toBe(true);
    const calm = buildPayload(
      { vibe: 'calm', name: 'B', label: 'x', affirmation: calmAff },
      () => 0.99,
    );
    expect(calm.title).toBe('💛 Just for you, B');
    expect(calm.body.endsWith('🌿')).toBe(true);
  });
});
