import { describe, expect, it } from 'vitest';
import {
  DRAINING_SESSION_THRESHOLD_MS,
  EMPTY_DRAINING_SESSION,
  isDrainingSessionOverwhelmed,
  acknowledgeRecoveryEasing,
  applyDrainingSessionPageChange,
} from '../utils/draining-session';
import { resolveDisplayMood, moodOverrideWhileHiding } from '../utils/presentation';
import { evaluateEmotionalTrigger } from '../utils/emotional-triggers';
import { createInitialCat, deriveMoodFromVitals, STRESSED_VITAL_THRESHOLD } from '../utils/cat-sim';
import { DEFAULT_SETTINGS } from '../utils/types';

describe('resolveDisplayMood', () => {
  it('uses vitals-derived mood by default', () => {
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: 'happy',
      }),
    ).toBe('happy');
  });

  it('lets dev mode override mood for preview', () => {
    expect(
      resolveDisplayMood({
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'stressed' },
        derivedMood: 'happy',
      }),
    ).toBe('stressed');
  });

  it('uses sleepy mood during a sleeping peek', () => {
    expect(
      resolveDisplayMood({
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'happy' },
        derivedMood: 'content',
        ambientActivity: 'sleeping',
      }),
    ).toBe('sleepy');
  });

  it('prefers ambient activity mood over dev override', () => {
    expect(
      resolveDisplayMood({
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'happy' },
        derivedMood: 'content',
        ambientActivity: 'peeking',
      }),
    ).toBe('peek');
  });

  it('keeps peek mood for one hide so duck-out can play', () => {
    expect(moodOverrideWhileHiding('peek', false)).toBe('peek');
    expect(moodOverrideWhileHiding('peek', true)).toBeUndefined();
    expect(moodOverrideWhileHiding('happy', false)).toBeUndefined();
  });

  it('keeps hungry mood during ambient grooming', () => {
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: 'hungry',
        ambientActivity: 'grooming',
      }),
    ).toBe('hungry');
  });

  it('keeps happy mood during ambient grooming', () => {
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: 'happy',
        ambientActivity: 'grooming',
      }),
    ).toBe('happy');
  });

  it('honors explicit mood overrides from care actions', () => {
    expect(
      resolveDisplayMood({
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'happy' },
        derivedMood: 'content',
        moodOverride: 'stressed',
      }),
    ).toBe('stressed');
  });

  it('shows stressed from short simulated feed time when vitals are content', () => {
    expect(
      resolveDisplayMood({
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'auto' },
        derivedMood: 'content',
        drainingSession: {
          ...EMPTY_DRAINING_SESSION,
          kind: 'social',
          accumulatedMs: 2 * 60_000,
        },
      }),
    ).toBe('stressed');
  });

  it('shows stressed from vitals before a long session tips into overwhelmed', () => {
    const vitals = { hunger: 30, happiness: 50, stress: STRESSED_VITAL_THRESHOLD, energy: 50 };
    const cat = createInitialCat(Date.now());
    const derived = deriveMoodFromVitals({
      vitals,
      cat,
      now: Date.now(),
      settings: DEFAULT_SETTINGS,
      isUserIdle: false,
    });
    expect(derived).toBe('stressed');
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: derived,
        drainingSession: {
          ...EMPTY_DRAINING_SESSION,
          kind: 'social',
          accumulatedMs: DRAINING_SESSION_THRESHOLD_MS - 60_000,
        },
      }),
    ).toBe('stressed');
  });

  it('upgrades vitals stressed to overwhelmed on a long social or news session', () => {
    const session = {
      ...EMPTY_DRAINING_SESSION,
      kind: 'news' as const,
      accumulatedMs: DRAINING_SESSION_THRESHOLD_MS,
    };
    expect(isDrainingSessionOverwhelmed(session, DEFAULT_SETTINGS)).toBe(true);
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: 'stressed',
        drainingSession: session,
      }),
    ).toBe('overwhelmed');
  });

  it('does not fire stressed speech when display mood is overwhelmed', () => {
    const now = Date.parse('2026-07-05T14:00:00.000Z');
    const cat = createInitialCat(now);
    const vitals = { hunger: 30, happiness: 50, stress: 90, energy: 40 };
    const session = {
      ...EMPTY_DRAINING_SESSION,
      kind: 'news' as const,
      accumulatedMs: DRAINING_SESSION_THRESHOLD_MS,
      pendingNudgeKind: 'news' as const,
    };
    const stressedOnly = evaluateEmotionalTrigger({
      cat: { ...cat, lastSpeechAt: 0, nudgesToday: 0 },
      vitals,
      settings: DEFAULT_SETTINGS,
      now,
      isUserIdle: false,
      recentMemory: null,
      drainingSession: {
        ...EMPTY_DRAINING_SESSION,
        kind: 'news',
        accumulatedMs: DRAINING_SESSION_THRESHOLD_MS - 60_000,
      },
    });
    expect(stressedOnly.mood).toBe('stressed');
    expect(stressedOnly.triggerKind).toBe('stressed');

    const overwhelmed = evaluateEmotionalTrigger({
      cat: { ...cat, lastSpeechAt: 0, nudgesToday: 0 },
      vitals,
      settings: DEFAULT_SETTINGS,
      now,
      isUserIdle: false,
      recentMemory: null,
      drainingSession: session,
    });
    expect(overwhelmed.mood).toBe('overwhelmed');
    expect(overwhelmed.triggerKind).toBe('overwhelmed');
    expect(overwhelmed.triggerKind).not.toBe('stressed');
  });

  it('shows stressed during recovery easing, then happy for thanks', () => {
    const overwhelmed = {
      ...EMPTY_DRAINING_SESSION,
      kind: 'social' as const,
      accumulatedMs: DRAINING_SESSION_THRESHOLD_MS,
    };
    const recovery = applyDrainingSessionPageChange(overwhelmed, {
      title: 'Docs',
      url: 'https://developer.mozilla.org/',
      now: 1_000,
      thresholdMs: DRAINING_SESSION_THRESHOLD_MS,
    });
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: 'content',
        drainingSession: recovery,
      }),
    ).toBe('stressed');

    const thanksReady = {
      ...acknowledgeRecoveryEasing(recovery, 1_500),
      pendingRecoveryNudge: 'thanks' as const,
    };
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: 'content',
        drainingSession: thanksReady,
      }),
    ).toBe('happy');
  });
});
