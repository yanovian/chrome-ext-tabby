import { describe, expect, it } from 'vitest';
import { settingsChangeRequiresPresent } from '../utils/settings';
import { DEFAULT_SETTINGS } from '../utils/types';

describe('settingsChangeRequiresPresent', () => {
  it('requires present when dev life stage override changes', () => {
    expect(
      settingsChangeRequiresPresent(DEFAULT_SETTINGS, {
        ...DEFAULT_SETTINGS,
        devForceLifeStage: 'adult',
      }),
    ).toBe(true);
  });

  it('requires present when dev mood override changes', () => {
    expect(
      settingsChangeRequiresPresent(DEFAULT_SETTINGS, {
        ...DEFAULT_SETTINGS,
        devForceMood: 'happy',
      }),
    ).toBe(true);
  });

  it('requires present when locale changes', () => {
    expect(
      settingsChangeRequiresPresent(DEFAULT_SETTINGS, {
        ...DEFAULT_SETTINGS,
        locale: 'hy',
      }),
    ).toBe(true);
  });

  it('does not require present for quiet hours alone', () => {
    expect(
      settingsChangeRequiresPresent(DEFAULT_SETTINGS, {
        ...DEFAULT_SETTINGS,
        quietHoursStart: 22,
      }),
    ).toBe(false);
  });
});
