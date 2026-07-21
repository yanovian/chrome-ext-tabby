import { describe, expect, it } from 'vitest';
import { createInitialCat } from '../utils/cat-sim';
import {
  isAmbientPeekActive,
  isAmbientPeekDuckGapActive,
  isAmbientPeekDuckGapExpired,
  isAmbientPeekVisitExpired,
  isAmbientRestExpired,
  isDaytime,
  pickAmbientActivity,
  pickAmbientPeekDuckGapMs,
  pickAmbientPeekDurationMs,
  pickAmbientPeekVisitDurationMs,
  pickAmbientRestActivity,
  pickPeekPlacement,
  pickStayVisibleAfterRevealMs,
  shouldStartAmbientRest,
  AMBIENT_PEEK_DUCK_GAP_MIN_MS,
  AMBIENT_PEEK_DUCK_GAP_MAX_MS,
  PEEK_INSET_MIN,
  PEEK_INSET_MAX,
  AMBIENT_PEEK_VISIT_MIN_MS,
  AMBIENT_PEEK_VISIT_MAX_MS,
  STAY_VISIBLE_AFTER_REVEAL_MIN_MS,
  STAY_VISIBLE_AFTER_REVEAL_MAX_MS,
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

  it('can rest during daytime when peek does not start', () => {
    const eligibleNow = Date.parse('2026-07-06T14:00:00.000Z');
    const cat = {
      ...createInitialCat(eligibleNow),
      adoptedAt: 5,
      lastCareAt: 0,
      lastAmbientAt: 0,
      ambientsToday: 0,
    };
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

describe('isAmbientPeekDuckGapActive', () => {
  it('detects an active pause between peek visits', () => {
    expect(
      isAmbientPeekDuckGapActive(
        {
          companionVisible: false,
          ambientActivity: 'peeking',
          ambientPeekUntil: NOW + 5_000,
        },
        NOW,
      ),
    ).toBe(true);
    expect(
      isAmbientPeekDuckGapExpired(
        {
          companionVisible: false,
          ambientActivity: 'peeking',
          ambientPeekUntil: NOW - 1,
        },
        NOW,
      ),
    ).toBe(true);
  });
});

describe('pickPeekPlacement', () => {
  it('picks bottom, left, or right with a random inset', () => {
    const placement = pickPeekPlacement(0);
    expect(['bottom', 'left', 'right']).toContain(placement.edge);
    expect(placement.inset).toBeGreaterThanOrEqual(PEEK_INSET_MIN);
    expect(placement.inset).toBeLessThanOrEqual(PEEK_INSET_MAX);
    expect(['left', 'right']).toContain(placement.corner);
  });
});

describe('pickAmbientPeekVisitDurationMs', () => {
  it('stays within the peek visit band', () => {
    const cat = createInitialCat(NOW);
    const duration = pickAmbientPeekVisitDurationMs(DEFAULT_SETTINGS, NOW, cat.adoptedAt);

    expect(duration).toBeGreaterThanOrEqual(AMBIENT_PEEK_VISIT_MIN_MS);
    expect(duration).toBeLessThanOrEqual(AMBIENT_PEEK_VISIT_MAX_MS);
  });
});

describe('pickAmbientPeekDuckGapMs', () => {
  it('stays within the duck gap band', () => {
    const cat = createInitialCat(NOW);
    const duration = pickAmbientPeekDuckGapMs(DEFAULT_SETTINGS, NOW, cat.adoptedAt);

    expect(duration).toBeGreaterThanOrEqual(AMBIENT_PEEK_DUCK_GAP_MIN_MS);
    expect(duration).toBeLessThanOrEqual(AMBIENT_PEEK_DUCK_GAP_MAX_MS);
  });
});

describe('pickStayVisibleAfterRevealMs', () => {
  it('stays within the 5-10 minute band, long enough to survive a normal tab switch', () => {
    const cat = createInitialCat(NOW);
    const duration = pickStayVisibleAfterRevealMs(DEFAULT_SETTINGS, NOW, cat.adoptedAt);

    expect(duration).toBeGreaterThanOrEqual(STAY_VISIBLE_AFTER_REVEAL_MIN_MS);
    expect(duration).toBeLessThanOrEqual(STAY_VISIBLE_AFTER_REVEAL_MAX_MS);
    expect(STAY_VISIBLE_AFTER_REVEAL_MIN_MS).toBeGreaterThanOrEqual(5 * 60_000);
  });
});

describe('isAmbientPeekVisitExpired', () => {
  it('detects when a visible peek should duck away', () => {
    expect(
      isAmbientPeekVisitExpired(
        {
          companionVisible: true,
          ambientActivity: 'peeking',
          ambientPeekUntil: NOW - 1,
        },
        NOW,
      ),
    ).toBe(true);
    expect(
      isAmbientPeekVisitExpired(
        {
          companionVisible: true,
          ambientActivity: 'peeking',
          ambientPeekUntil: NOW + 10_000,
        },
        NOW,
      ),
    ).toBe(false);
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
