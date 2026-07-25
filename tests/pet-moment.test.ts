import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../utils/types';
import { isPettingActive, pettingMomentDue, pickPettingDurationMs } from '../utils/pet-moment';
import { pickPlayingDurationMs } from '../utils/play-moment';

const NOW = Date.parse('2026-07-05T14:00:00.000Z');

describe('pet moment helpers', () => {
  it('matches the pet clip length exactly (48 frames @ 30fps) — never cut short, never lingering', () => {
    for (let seed = 0; seed < 5; seed += 1) {
      expect(pickPettingDurationMs(DEFAULT_SETTINGS, seed)).toBe(1_600);
    }
  });

  it('is always shorter than the play moment, since petting is the gentlest action', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const petting = pickPettingDurationMs(DEFAULT_SETTINGS, seed);
      const playing = pickPlayingDurationMs(DEFAULT_SETTINGS, seed);
      expect(petting).toBeLessThan(playing);
    }
  });

  it('tracks active and due petting windows', () => {
    const until = NOW + 2_000;
    expect(isPettingActive(until, NOW)).toBe(true);
    expect(pettingMomentDue(until, NOW)).toBe(false);
    expect(isPettingActive(until, until)).toBe(false);
    expect(pettingMomentDue(until, until)).toBe(true);
  });
});
