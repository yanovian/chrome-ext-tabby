import { describe, expect, it } from 'vitest';
import {
  applyBrowsingToVitals,
  applyCareAction,
  applyMinuteTick,
  createInitialCat,
  deriveMoodFromVitals,
  recordAppearance,
  resetDailyNudgeCounter,
} from '../utils/cat-sim';
import { DEFAULT_SETTINGS } from '../utils/types';

const NOW = Date.parse('2026-07-05T14:00:00.000Z');

describe('applyBrowsingToVitals', () => {
  it('reduces hunger and stress when the user reads nourishing pages', () => {
    const cat = createInitialCat(NOW);
    const next = applyBrowsingToVitals(cat.vitals, {
      category: 'nourishing',
      activeDurationMs: 10 * 60_000,
      statMultiplier: 1,
    });

    expect(next.hunger).toBeLessThan(cat.vitals.hunger);
    expect(next.happiness).toBeGreaterThan(cat.vitals.happiness);
    expect(next.stress).toBeLessThan(cat.vitals.stress);
  });

  it('raises stress and hunger when the user doomscrolls draining feeds', () => {
    const cat = createInitialCat(NOW);
    const next = applyBrowsingToVitals(cat.vitals, {
      category: 'draining',
      activeDurationMs: 8 * 60_000,
      statMultiplier: 1,
    });

    expect(next.stress).toBeGreaterThan(cat.vitals.stress);
    expect(next.happiness).toBeLessThan(cat.vitals.happiness);
    expect(next.hunger).toBeGreaterThan(cat.vitals.hunger);
  });
});

describe('deriveMoodFromVitals', () => {
  it('shows the funny starving face when hunger is extremely high', () => {
    const mood = deriveMoodFromVitals({
      vitals: {
        hunger: 92,
        happiness: 40,
        stress: 20,
        energy: 50,
      },
      now: NOW,
      settings: DEFAULT_SETTINGS,
      isUserIdle: false,
    });

    expect(mood).toBe('starving');
  });

  it('shows hungry mood before the extreme starving threshold', () => {
    const mood = deriveMoodFromVitals({
      vitals: {
        hunger: 70,
        happiness: 50,
        stress: 25,
        energy: 55,
      },
      now: NOW,
      settings: DEFAULT_SETTINGS,
      isUserIdle: false,
    });

    expect(mood).toBe('hungry');
  });

  it('shows stressed mood when the internet noise overwhelms Tabby', () => {
    const mood = deriveMoodFromVitals({
      vitals: {
        hunger: 30,
        happiness: 45,
        stress: 80,
        energy: 40,
      },
      now: NOW,
      settings: DEFAULT_SETTINGS,
      isUserIdle: false,
    });

    expect(mood).toBe('stressed');
  });

  it('shows sleepy mood during quiet hours while the user is idle', () => {
    const mood = deriveMoodFromVitals({
      vitals: {
        hunger: 40,
        happiness: 60,
        stress: 20,
        energy: 30,
      },
      now: Date.parse('2026-07-05T02:00:00.000Z'),
      settings: DEFAULT_SETTINGS,
      isUserIdle: true,
    });

    expect(mood).toBe('sleepy');
  });
});

describe('applyCareAction', () => {
  it('comforts Tabby when the user pets her without removing hunger entirely', () => {
    const cat = createInitialCat(NOW);
    const next = applyCareAction(
      {
        ...cat,
        vitals: { ...cat.vitals, stress: 70, happiness: 35 },
      },
      'pet',
      NOW,
    );

    expect(next.vitals.happiness).toBeGreaterThan(35);
    expect(next.vitals.stress).toBeLessThan(70);
  });

  it('feeds Tabby when the user offers a treat', () => {
    const cat = createInitialCat(NOW);
    const hungry = {
      ...cat,
      vitals: { ...cat.vitals, hunger: 85 },
    };
    const next = applyCareAction(hungry, 'treat', NOW);

    expect(next.vitals.hunger).toBeLessThan(85);
  });
});

describe('recordAppearance', () => {
  it('increments daily nudge counter when Tabby appears to speak', () => {
    const cat = createInitialCat(NOW);
    const next = recordAppearance(cat, NOW);

    expect(next.nudgesToday).toBe(1);
    expect(next.lastSpeechAt).toBe(NOW);
  });

  it('resets the daily nudge counter on a new calendar day', () => {
    const cat = {
      ...createInitialCat(NOW),
      nudgesToday: 3,
      nudgesDayKey: '2026-07-04',
    };
    const next = resetDailyNudgeCounter(cat, NOW);

    expect(next.nudgesToday).toBe(0);
    expect(next.nudgesDayKey).toBe('2026-07-05');
  });
});

describe('applyMinuteTick', () => {
  it('slowly increases hunger over time so Tabby eventually asks for care', () => {
    const cat = createInitialCat(NOW);
    const next = applyMinuteTick(cat.vitals, {
      cat,
      now: NOW,
      settings: DEFAULT_SETTINGS,
      isUserIdle: false,
    });

    expect(next.hunger).toBeGreaterThan(cat.vitals.hunger);
  });

  it('restores energy while the user is away from the keyboard', () => {
    const cat = {
      ...createInitialCat(NOW),
      vitals: { hunger: 40, happiness: 60, stress: 30, energy: 25 },
    };
    const next = applyMinuteTick(cat.vitals, {
      cat,
      now: NOW,
      settings: DEFAULT_SETTINGS,
      isUserIdle: true,
    });

    expect(next.energy).toBeGreaterThan(25);
  });
});
