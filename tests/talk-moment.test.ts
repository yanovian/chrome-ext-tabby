import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../utils/types';
import { isTalkActive, pickTalkDurationMs, talkMomentDue } from '../utils/talk-moment';

const NOW = Date.parse('2026-07-05T14:00:00.000Z');

describe('talk moment helpers', () => {
  it('is fixed at 5 seconds regardless of seed', () => {
    for (let seed = 0; seed < 5; seed += 1) {
      expect(pickTalkDurationMs(DEFAULT_SETTINGS, seed)).toBe(5_000);
    }
  });

  it('tracks active and due talking windows', () => {
    const until = NOW + 5_000;
    expect(isTalkActive(until, NOW)).toBe(true);
    expect(talkMomentDue(until, NOW)).toBe(false);
    expect(isTalkActive(until, until)).toBe(false);
    expect(talkMomentDue(until, until)).toBe(true);
  });
});
