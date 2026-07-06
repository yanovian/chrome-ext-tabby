import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../utils/types';
import {
  isPlayingActive,
  pickPlayingDurationMs,
  playingMomentDue,
} from '../utils/play-moment';

const NOW = Date.parse('2026-07-05T14:00:00.000Z');

describe('play moment helpers', () => {
  it('uses a random production duration between five and ten seconds', () => {
    const duration = pickPlayingDurationMs(DEFAULT_SETTINGS, 77);
    expect(duration).toBeGreaterThanOrEqual(5_000);
    expect(duration).toBeLessThanOrEqual(10_000);
  });

  it('tracks active and due play windows', () => {
    const until = NOW + 5_000;
    expect(isPlayingActive(until, NOW)).toBe(true);
    expect(playingMomentDue(until, NOW)).toBe(false);
    expect(isPlayingActive(until, until)).toBe(false);
    expect(playingMomentDue(until, until)).toBe(true);
  });
});
