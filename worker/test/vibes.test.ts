import { describe, expect, it } from 'vitest';
import { VIBES, VIBE_NAMES, fillTitle, vibeBody } from '../../shared/vibes';
import { timeIcon } from '../../shared/icons';

describe('shared vibes', () => {
  it('offers at least 8 distinct vibes', () => {
    expect(VIBE_NAMES.length).toBeGreaterThanOrEqual(8);
    const names = VIBE_NAMES.map((v) => VIBES[v].name);
    const colors = VIBE_NAMES.map((v) => VIBES[v].colors.join());
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(colors).size).toBe(colors.length);
    for (const v of VIBE_NAMES) expect(VIBES[v].symbol).not.toBe('');
  });

  it('has three templates, an emoji, three colors and three icons per vibe', () => {
    for (const v of VIBE_NAMES) {
      expect(VIBES[v].titles).toHaveLength(3);
      expect(VIBES[v].emoji).not.toBe('');
      expect(VIBES[v].colors).toHaveLength(3);
      expect(VIBES[v].icons).toHaveLength(3);
    }
  });

  it('fills {n} and {l}, with fallbacks', () => {
    expect(fillTitle('☀️ Your {l} is here', 'Bhavya', 'Morning boost')).toBe(
      '☀️ Your morning boost is here',
    );
    expect(fillTitle('💛 Just for you, {n}', '  ', 'x')).toBe('💛 Just for you, friend');
  });

  it('appends the vibe emoji to the body', () => {
    expect(vibeBody('I choose calm over rush.', 'calm')).toBe('I choose calm over rush. 🌿');
  });

  it('picks a time-of-day icon', () => {
    expect(timeIcon('07:30')).toBe('sun');
    expect(timeIcon('13:00')).toBe('flower');
    expect(timeIcon('17:15')).toBe('rainbow');
    expect(timeIcon('21:30')).toBe('moon');
  });
});
