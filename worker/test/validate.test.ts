import { describe, expect, it } from 'vitest';
import * as v from '../src/validate';

describe('validate', () => {
  it('affirmation: trims, 1–200 chars, known icon', () => {
    expect(v.affirmationCreate({ text: '  hi  ', icon: 'moon' })).toEqual({
      ok: true,
      value: { text: 'hi', icon: 'moon' },
    });
    expect(v.affirmationCreate({ text: '   ' }).ok).toBe(false);
    expect(v.affirmationCreate({ text: 'a'.repeat(201) }).ok).toBe(false);
    expect(v.affirmationCreate({ text: 'a'.repeat(200) }).ok).toBe(true);
    expect(v.affirmationCreate({ text: 'x', icon: 'cat' }).ok).toBe(false);
    expect(v.affirmationPatch({}).ok).toBe(false);
    expect(v.affirmationPatch({ active: 'yes' }).ok).toBe(false);
  });

  it('reminder: HH:MM time and 7-char days', () => {
    expect(v.reminderCreate({ time: '07:30', label: 'Hi', days: '1111100' }).ok).toBe(true);
    for (const time of ['7:30', '24:00', '12:60', '07:30:00']) {
      expect(v.reminderCreate({ time, label: 'Hi' }).ok).toBe(false);
    }
    for (const days of ['111111', '11111111', '1111102', '0000000']) {
      expect(v.reminderCreate({ time: '07:30', label: 'Hi', days }).ok).toBe(false);
    }
    expect(v.reminderPatch({ label: '  ' }).ok).toBe(false);
  });

  it('settings: allowed vibe/theme/timezone only', () => {
    expect(v.settingsPatch({ vibe: 'calm', theme: 'dark', timezone: 'Asia/Kolkata' }).ok).toBe(
      true,
    );
    expect(v.settingsPatch({ vibe: 'angry' }).ok).toBe(false);
    expect(v.settingsPatch({ theme: 'blue' }).ok).toBe(false);
    expect(v.settingsPatch({ timezone: 'Mars/Base' }).ok).toBe(false);
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
