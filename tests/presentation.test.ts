import { describe, expect, it } from 'vitest';
import { resolveDisplayMood, moodOverrideWhileHiding } from '../utils/presentation';
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

  it('honors explicit mood overrides from care actions', () => {
    expect(
      resolveDisplayMood({
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'happy' },
        derivedMood: 'content',
        moodOverride: 'stressed',
      }),
    ).toBe('stressed');
  });
});
