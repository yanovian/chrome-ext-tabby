import { describe, expect, it } from 'vitest';
import { mergeSettings, settingsChangeRequiresPresent } from '../utils/settings';
import { REAL_CAT_PHOTOS } from '../utils/real-cats';
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

  it('does not require present for the dev real cat cameo override', () => {
    // Unlike devForceLifeStage/devForceMood, this doesn't touch CatPresentation at all — it
    // only affects a future shoo cameo (see utils/real-cats.ts), so no reason to force a
    // presentation refresh when it changes.
    expect(
      settingsChangeRequiresPresent(DEFAULT_SETTINGS, {
        ...DEFAULT_SETTINGS,
        devForceRealCat: REAL_CAT_PHOTOS[0]!.file,
      }),
    ).toBe(false);
  });
});

describe('mergeSettings devForceRealCat', () => {
  it('accepts any filename from the real cat manifest', () => {
    for (const photo of REAL_CAT_PHOTOS) {
      expect(mergeSettings({ devForceRealCat: photo.file }).devForceRealCat).toBe(photo.file);
    }
  });

  it('accepts "auto"', () => {
    expect(mergeSettings({ devForceRealCat: 'auto' }).devForceRealCat).toBe('auto');
  });

  it('falls back to the default for an unknown filename', () => {
    expect(mergeSettings({ devForceRealCat: 'not-a-real-file.png' }).devForceRealCat).toBe(
      DEFAULT_SETTINGS.devForceRealCat,
    );
  });

  it('falls back to the default when missing entirely', () => {
    expect(mergeSettings({}).devForceRealCat).toBe(DEFAULT_SETTINGS.devForceRealCat);
  });
});
