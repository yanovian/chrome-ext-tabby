import { describe, expect, it } from 'vitest';
import { createInitialCat } from '../utils/cat-sim';
import {
  isAmbientPeekActive,
  isDaytime,
  pickAmbientActivity,
  pickAmbientPeekDurationMs,
  shouldStartAmbientPeek,
} from '../utils/ambient-presence';
import { DEFAULT_SETTINGS } from '../utils/types';

const NOW = Date.parse('2026-07-06T14:00:00.000Z');

describe('isDaytime', () => {
  it('treats afternoon as daytime when quiet hours are overnight', () => {
    expect(isDaytime(14, DEFAULT_SETTINGS)).toBe(true);
  });

  it('treats late night as not daytime', () => {
    expect(isDaytime(2, DEFAULT_SETTINGS)).toBe(false);
  });
});

describe('shouldStartAmbientPeek', () => {
  it('does not peek when speech would appear', () => {
    const cat = createInitialCat(NOW);
    expect(
      shouldStartAmbientPeek({
        cat,
        settings: DEFAULT_SETTINGS,
        now: NOW,
        speechWouldAppear: true,
        peekUntil: null,
      }),
    ).toBe(false);
  });

  it('can peek during daytime when cooldown has passed', () => {
    const cat = {
      ...createInitialCat(0),
      lastAmbientAt: 0,
      ambientsToday: 0,
    };
    const eligibleNow = Date.parse('2026-07-06T14:04:00.000Z');
    expect(
      shouldStartAmbientPeek({
        cat,
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true },
        now: eligibleNow,
        speechWouldAppear: false,
        peekUntil: null,
      }),
    ).toBe(true);
  });
});

describe('pickAmbientActivity', () => {
  it('rotates sleeping, grooming, and peeking', () => {
    expect(pickAmbientActivity(0)).toBe('sleeping');
    expect(pickAmbientActivity(1)).toBe('grooming');
    expect(pickAmbientActivity(2)).toBe('peeking');
  });
});

describe('pickAmbientPeekDurationMs', () => {
  it('stays between one and fifteen minutes in production', () => {
    const cat = createInitialCat(NOW);
    const duration = pickAmbientPeekDurationMs(DEFAULT_SETTINGS, NOW, cat.adoptedAt);

    expect(duration).toBeGreaterThanOrEqual(60_000);
    expect(duration).toBeLessThanOrEqual(15 * 60_000);
  });
});

describe('isAmbientPeekActive', () => {
  it('stays visible until peek time ends', () => {
    expect(isAmbientPeekActive(NOW + 10_000, NOW)).toBe(true);
    expect(isAmbientPeekActive(NOW - 1, NOW)).toBe(false);
  });
});
