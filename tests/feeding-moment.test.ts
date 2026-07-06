import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../utils/types';
import {
  feedingMomentDue,
  isFeedingActive,
  pickFeedingDurationMs,
  shouldStartFeedingMoment,
  wasHungryEnoughForFeedingMoment,
} from '../utils/feeding-moment';

const NOW = Date.parse('2026-07-05T14:00:00.000Z');

describe('feeding moment helpers', () => {
  it('detects hungry moods that deserve a munching transition', () => {
    expect(wasHungryEnoughForFeedingMoment('hungry')).toBe(true);
    expect(wasHungryEnoughForFeedingMoment('starving')).toBe(true);
    expect(wasHungryEnoughForFeedingMoment('happy')).toBe(false);
  });

  it('starts feeding when vitals or display mood were hungry', () => {
    expect(shouldStartFeedingMoment('hungry', 'content')).toBe(true);
    expect(shouldStartFeedingMoment('content', 'starving')).toBe(true);
    expect(shouldStartFeedingMoment('content', 'peek')).toBe(false);
  });

  it('uses a random production duration between five and ten seconds', () => {
    const duration = pickFeedingDurationMs(DEFAULT_SETTINGS, 42);
    expect(duration).toBeGreaterThanOrEqual(5_000);
    expect(duration).toBeLessThanOrEqual(10_000);
  });

  it('uses the same duration in dev mode', () => {
    const prod = pickFeedingDurationMs(DEFAULT_SETTINGS, 42);
    const dev = pickFeedingDurationMs(
      { ...DEFAULT_SETTINGS, devModeEnabled: true },
      42,
    );
    expect(dev).toBe(prod);
  });

  it('tracks active and due feeding windows', () => {
    const until = NOW + 5_000;
    expect(isFeedingActive(until, NOW)).toBe(true);
    expect(feedingMomentDue(until, NOW)).toBe(false);
    expect(isFeedingActive(until, until)).toBe(false);
    expect(feedingMomentDue(until, until)).toBe(true);
  });
});
