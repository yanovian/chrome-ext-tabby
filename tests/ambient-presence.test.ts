import { describe, expect, it } from 'vitest';
import { createInitialCat } from '../utils/cat-sim';
import {
  isAmbientPeekActive,
  isAmbientRestExpired,
  isDaytime,
  pickAmbientActivity,
  pickAmbientPeekDurationMs,
  pickAmbientRestActivity,
  shouldStartAmbientRest,
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

describe('shouldStartAmbientRest', () => {
  it('does not rest when speech would appear', () => {
    const cat = createInitialCat(NOW);
    expect(
      shouldStartAmbientRest({
        cat,
        settings: DEFAULT_SETTINGS,
        now: NOW,
        speechWouldAppear: true,
        restUntil: null,
      }),
    ).toBe(false);
  });

  it('can rest during daytime when cooldown has passed', () => {
    const cat = {
      ...createInitialCat(0),
      lastAmbientAt: 0,
      ambientsToday: 0,
    };
    const eligibleNow = Date.parse('2026-07-06T14:04:00.000Z');
    expect(
      shouldStartAmbientRest({
        cat,
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true },
        now: eligibleNow,
        speechWouldAppear: false,
        restUntil: null,
      }),
    ).toBe(true);
  });

  it('does not rest right after the user checked in on Tabby', () => {
    const cat = {
      ...createInitialCat(NOW),
      lastCareAt: NOW,
    };
    expect(
      shouldStartAmbientRest({
        cat,
        settings: DEFAULT_SETTINGS,
        now: NOW,
        speechWouldAppear: false,
        restUntil: null,
      }),
    ).toBe(false);
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

describe('pickAmbientRestActivity', () => {
  it('never returns peeking', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      expect(pickAmbientRestActivity(seed)).not.toBe('peeking');
    }
  });
});

describe('isAmbientPeekActive', () => {
  it('stays hidden until rest time ends', () => {
    expect(isAmbientPeekActive(NOW + 10_000, NOW)).toBe(true);
    expect(isAmbientPeekActive(NOW - 1, NOW)).toBe(false);
  });
});

describe('isAmbientRestExpired', () => {
  it('detects when an ambient rest should end', () => {
    expect(
      isAmbientRestExpired(
        {
          companionVisible: false,
          ambientActivity: 'sleeping',
          ambientPeekUntil: NOW - 1,
        },
        NOW,
      ),
    ).toBe(true);
    expect(
      isAmbientRestExpired(
        {
          companionVisible: false,
          ambientActivity: 'sleeping',
          ambientPeekUntil: NOW + 10_000,
        },
        NOW,
      ),
    ).toBe(false);
  });
});
