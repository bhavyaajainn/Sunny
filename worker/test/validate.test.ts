import { describe, expect, it } from 'vitest';
import * as v from '../src/validate';

describe('validate', () => {
  const t = { time: '07:30' };

  it('affirmation: trims, 1–200 chars, known icon', () => {
    expect(v.affirmationCreate({ text: '  hi  ', icon: 'moon', ...t })).toEqual({
      ok: true,
      value: { text: 'hi', icon: 'moon', time: '07:30', days: '1111111', vibe: 'sunny' },
    });
    expect(v.affirmationCreate({ text: '   ', ...t }).ok).toBe(false);
    expect(v.affirmationCreate({ text: 'a'.repeat(201), ...t }).ok).toBe(false);
    expect(v.affirmationCreate({ text: 'a'.repeat(200), ...t }).ok).toBe(true);
    expect(v.affirmationCreate({ text: 'x', icon: 'cat', ...t }).ok).toBe(false);
    expect(v.affirmationPatch({}).ok).toBe(false);
    expect(v.affirmationPatch({ active: 'yes' }).ok).toBe(false);
  });

  it('affirmation reminder: time required, HH:MM, 7-char days, known vibe', () => {
    const base = { text: 'Hi' };
    expect(v.affirmationCreate(base).ok).toBe(false); // no time
    expect(v.affirmationCreate({ ...base, time: null }).ok).toBe(false);
    expect(v.affirmationCreate({ ...base, time: '13:00', days: '1111100', vibe: 'calm' }).ok).toBe(
      true,
    );
    for (const time of ['7:30', '24:00', '12:60', '07:30:00']) {
      expect(v.affirmationCreate({ ...base, time }).ok).toBe(false);
    }
    for (const days of ['111111', '11111111', '1111102', '0000000']) {
      expect(v.affirmationCreate({ ...base, ...t, days }).ok).toBe(false);
    }
    expect(v.affirmationCreate({ ...base, ...t, vibe: 'angry' }).ok).toBe(false);
    expect(v.affirmationPatch({ time: null }).ok).toBe(false); // can't remove a time
    expect(v.affirmationPatch({ vibe: 'hype', days: '0000011' }).ok).toBe(true);
  });

  it('settings: allowed theme/timezone only', () => {
    expect(v.settingsPatch({ name: 'B', theme: 'dark', timezone: 'Asia/Kolkata' }).ok).toBe(true);
    expect(v.settingsPatch({ theme: 'blue' }).ok).toBe(false);
    expect(v.settingsPatch({ timezone: 'Mars/Base' }).ok).toBe(false);
    expect(v.settingsPatch({ vibe: 'calm' }).ok).toBe(false); // vibe lives on each affirmation now
  });

  it('subscription: https endpoint and base64url keys', () => {
    const good = {
      endpoint: 'https://web.push.apple.com/x',
      keys: { p256dh: 'BA-_c', auth: 'q1' },
    };
    expect(v.subscription(good).ok).toBe(true);
    expect(v.subscription({ ...good, endpoint: 'http://x' }).ok).toBe(false);
    expect(v.subscription({ ...good, keys: { p256dh: 'a b', auth: 'q' } }).ok).toBe(false);
  });
});
