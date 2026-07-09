import { describe, expect, it } from 'vitest';
import {
  MOOD_TIMER_DEV_DEFAULTS,
  MOOD_TIMER_PRODUCTION,
  inferTemperMood,
  resolveMoodTimers,
  temperSlidersForDevMood,
} from '../utils/mood-timers';
import { DEFAULT_SETTINGS } from '../utils/types';

describe('resolveMoodTimers', () => {
  it('uses production defaults when dev mode is off', () => {
    expect(resolveMoodTimers(DEFAULT_SETTINGS)).toEqual({
      ...MOOD_TIMER_PRODUCTION,
    });
  });

  it('uses production thresholds when dev mode is on', () => {
    const timers = resolveMoodTimers({
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      devOverwhelmedThresholdMs: 120_000,
      devRecoveryThanksThresholdMs: 20_000,
      devStressedVitalThreshold: 80,
    });
    expect(timers.overwhelmedThresholdMs).toBe(MOOD_TIMER_DEV_DEFAULTS.overwhelmedThresholdMs);
    expect(timers.recoveryThanksThresholdMs).toBe(MOOD_TIMER_DEV_DEFAULTS.recoveryThanksThresholdMs);
    expect(timers.stressedVitalThreshold).toBe(MOOD_TIMER_DEV_DEFAULTS.stressedVitalThreshold);
  });
});

describe('inferTemperMood', () => {
  const timers = resolveMoodTimers({
    ...DEFAULT_SETTINGS,
    devModeEnabled: true,
  });

  it('returns overwhelmed when simulated feed time crosses the threshold', () => {
    expect(
      inferTemperMood(timers, {
        scenario: 'on_feed',
        simulatedDrainingMs: timers.overwhelmedThresholdMs,
        simulatedRecoveryAwayMs: 0,
      }, 'content'),
    ).toBe('overwhelmed');
  });

  it('returns stressed below overwhelmed on feed', () => {
    expect(
      inferTemperMood(timers, {
        scenario: 'on_feed',
        simulatedDrainingMs: Math.floor(timers.overwhelmedThresholdMs * 0.5),
        simulatedRecoveryAwayMs: 0,
      }, 'content'),
    ).toBe('stressed');
  });

  it('returns stressed during away recovery before thanks', () => {
    expect(
      inferTemperMood(timers, {
        scenario: 'away_from_feed',
        simulatedDrainingMs: 0,
        simulatedRecoveryAwayMs: 30_000,
      }, 'content'),
    ).toBe('stressed');
  });

  it('returns happy after enough away time', () => {
    expect(
      inferTemperMood(timers, {
        scenario: 'away_from_feed',
        simulatedDrainingMs: 0,
        simulatedRecoveryAwayMs: timers.recoveryThanksThresholdMs,
      }, 'content'),
    ).toBe('happy');
  });
});

describe('temperSlidersForDevMood', () => {
  const timers = resolveMoodTimers({
    ...DEFAULT_SETTINGS,
    devModeEnabled: true,
  });
  const base = {
    scenario: 'on_feed' as const,
    simulatedDrainingMs: 0,
    simulatedRecoveryAwayMs: 0,
  };

  it('aligns overwhelmed mood to the threshold slider', () => {
    const sliders = temperSlidersForDevMood('overwhelmed', timers, base);
    expect(sliders.simulatedDrainingMs).toBe(timers.overwhelmedThresholdMs);
    expect(sliders.scenario).toBe('on_feed');
  });
});
