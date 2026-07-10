import { describe, expect, it } from 'vitest';
import {
  applyAskInteraction,
  applyCareAction,
  createInitialCat,
  deriveMoodFromVitals,
} from '../utils/cat-sim';
import {
  effectiveMoodGrace,
  hungerRateMultiplier,
  isInHappyGrace,
  isSatiated,
  isSleepDeferred,
  MOOD_GRACE,
  SATIATED_HUNGER_LEVEL,
} from '../utils/mood-grace';
import { resolveAskMood } from '../utils/cat-interactions';
import { DEFAULT_SETTINGS } from '../utils/types';

const NOW = Date.parse('2026-07-05T14:00:00.000Z');
const QUIET_NIGHT = Date.parse('2026-07-05T02:00:00.000Z');

function catWithVitals(
  vitals: { hunger: number; happiness: number; stress: number; energy: number },
  extras: Partial<ReturnType<typeof createInitialCat>> = {},
) {
  return {
    ...createInitialCat(NOW),
    vitals,
    ...extras,
  };
}

describe('mood grace helpers', () => {
  it('tracks satiation, happiness, and sleep defer windows', () => {
    const cat = {
      ...createInitialCat(NOW),
      satiatedUntil: NOW + MOOD_GRACE.satiatedMs,
      happyUntil: NOW + MOOD_GRACE.happyMs,
      lastCareAt: NOW,
    };

    expect(isSatiated(cat, NOW)).toBe(true);
    expect(isInHappyGrace(cat, NOW)).toBe(true);
    expect(isSleepDeferred(cat, NOW)).toBe(true);
    expect(
      isSleepDeferred(
        cat,
        NOW + MOOD_GRACE.sleepDeferMs - 1,
      ),
    ).toBe(true);
    expect(
      isSleepDeferred(
        cat,
        NOW + MOOD_GRACE.sleepDeferMs,
      ),
    ).toBe(false);
  });

  it('uses the same grace windows in dev and production', () => {
    expect(effectiveMoodGrace()).toEqual(MOOD_GRACE);
  });
});

describe('hungerRateMultiplier', () => {
  it('slows hunger overnight and around mealtimes', () => {
    const quietSettings = { ...DEFAULT_SETTINGS, quietHoursStart: 23, quietHoursEnd: 8 };

    expect(hungerRateMultiplier(2, quietSettings)).toBe(0.15);
    expect(hungerRateMultiplier(8, quietSettings)).toBe(0.7);
    expect(hungerRateMultiplier(12, quietSettings)).toBe(0.85);
    expect(hungerRateMultiplier(15, quietSettings)).toBe(0.5);
    expect(hungerRateMultiplier(18, quietSettings)).toBe(0.75);
    expect(hungerRateMultiplier(21, quietSettings)).toBe(0.4);
  });
});

describe('deriveMoodFromVitals with grace', () => {
  it('hides hungry mood while Tabby is still full after a treat', () => {
    const cat = catWithVitals(
      { hunger: 90, happiness: 50, stress: 20, energy: 55 },
      { satiatedUntil: NOW + MOOD_GRACE.satiatedMs },
    );

    expect(
      deriveMoodFromVitals({
        vitals: cat.vitals,
        cat,
        now: NOW,
        settings: DEFAULT_SETTINGS,
        isUserIdle: false,
      }),
    ).toBe('content');
  });

  it('defers sleepy mood right after care even when idle at night', () => {
    const cat = catWithVitals(
      { hunger: 40, happiness: 60, stress: 20, energy: 30 },
      { lastCareAt: NOW },
    );

    expect(
      deriveMoodFromVitals({
        vitals: cat.vitals,
        cat,
        now: QUIET_NIGHT,
        settings: DEFAULT_SETTINGS,
        isUserIdle: true,
      }),
    ).not.toBe('sleepy');
  });

  it('shows happy mood during the post-care happiness window', () => {
    const cat = catWithVitals(
      { hunger: 40, happiness: 55, stress: 25, energy: 60 },
      { happyUntil: NOW + MOOD_GRACE.happyMs },
    );

    expect(
      deriveMoodFromVitals({
        vitals: cat.vitals,
        cat,
        now: NOW,
        settings: DEFAULT_SETTINGS,
        isUserIdle: false,
      }),
    ).toBe('happy');
  });

  it('returns sleepy again after the sleep defer window ends', () => {
    const cat = catWithVitals(
      { hunger: 40, happiness: 60, stress: 20, energy: 30 },
      {
        lastCareAt: QUIET_NIGHT - MOOD_GRACE.sleepDeferMs,
      },
    );

    expect(
      deriveMoodFromVitals({
        vitals: cat.vitals,
        cat,
        now: QUIET_NIGHT,
        settings: DEFAULT_SETTINGS,
        isUserIdle: true,
      }),
    ).toBe('sleepy');
  });
});

describe('applyCareAction and applyAskInteraction', () => {
  it('feeds Tabby, resets hunger, and starts satiation grace', () => {
    const hungry = catWithVitals({
      hunger: 90,
      happiness: 40,
      stress: 30,
      energy: 60,
    });
    const fed = applyCareAction(hungry, 'treat', NOW);

    expect(fed.vitals.hunger).toBe(SATIATED_HUNGER_LEVEL);
    expect(fed.satiatedUntil).toBe(NOW + MOOD_GRACE.satiatedMs);
    expect(fed.happyUntil).toBe(NOW + MOOD_GRACE.happyMs);
    expect(fed.lastCareAt).toBe(NOW);
  });

  it('starts happy and sleep defer grace after pet or play', () => {
    const cat = createInitialCat(NOW);
    const petted = applyCareAction(cat, 'pet', NOW);
    const played = applyCareAction(cat, 'play', NOW);

    expect(petted.happyUntil).toBe(NOW + MOOD_GRACE.happyMs);
    expect(petted.lastCareAt).toBe(NOW);
    expect(played.happyUntil).toBe(NOW + MOOD_GRACE.happyMs);
    expect(played.lastCareAt).toBe(NOW);
  });

  it('starts happy and sleep defer grace after a check-in ask', () => {
    const cat = createInitialCat(NOW);
    const asked = applyAskInteraction(cat, NOW);

    expect(asked.happyUntil).toBe(NOW + MOOD_GRACE.happyMs);
    expect(asked.lastCareAt).toBe(NOW);
  });
});

describe('resolveAskMood with grace', () => {
  it('reads happy after a check-in even when Tabby was sleepy', () => {
    const cat = applyAskInteraction(createInitialCat(NOW), NOW);

    expect(
      resolveAskMood(
        cat.vitals,
        'sleepy',
        'sleepy',
        cat,
        NOW,
      ),
    ).toBe('happy');
  });

  it('still prioritizes hunger before happiness when not fed', () => {
    const cat = catWithVitals(
      { hunger: 72, happiness: 58, stress: 18, energy: 60 },
      { happyUntil: NOW + MOOD_GRACE.happyMs },
    );

    expect(
      resolveAskMood(
        cat.vitals,
        'hungry',
        'hungry',
        cat,
        NOW,
      ),
    ).toBe('hungry');
  });

  it('ignores hunger on ask while satiated after feeding', () => {
    const cat = applyCareAction(
      catWithVitals({ hunger: 90, happiness: 50, stress: 20, energy: 60 }),
      'treat',
      NOW,
    );

    expect(
      resolveAskMood(
        cat.vitals,
        'content',
        'starving',
        cat,
        NOW,
      ),
    ).toBe('happy');
  });
});

describe('applyMinuteTick hunger by time of day', () => {
  it('raises hunger faster around lunch than late afternoon', () => {
    const cat = createInitialCat(NOW);
    const lunchMultiplier = hungerRateMultiplier(12, DEFAULT_SETTINGS);
    const afternoonMultiplier = hungerRateMultiplier(15, DEFAULT_SETTINGS);

    expect(lunchMultiplier).toBeGreaterThan(afternoonMultiplier);

    const lunchHunger = cat.vitals.hunger + 0.4 * lunchMultiplier;
    const afternoonHunger = cat.vitals.hunger + 0.4 * afternoonMultiplier;
    expect(lunchHunger).toBeGreaterThan(afternoonHunger);
  });
});
