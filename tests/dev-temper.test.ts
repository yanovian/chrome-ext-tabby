import { describe, expect, it } from 'vitest';
import {
  applyDevMoodToTemper,
  applyTemperSimulation,
  shouldSyncDevForceMoodUi,
} from '../utils/dev-temper';
import { MOOD_TIMER_DEV_DEFAULTS } from '../utils/mood-timers';
import { DEFAULT_SETTINGS } from '../utils/types';

const ONE_HOUR_MS = 60 * 60_000;
const TWO_MIN_MS = 2 * 60_000;

describe('applyTemperSimulation', () => {
  it('builds an overwhelmed draining session when simulated time crosses the threshold', () => {
    const settings = { ...DEFAULT_SETTINGS, devModeEnabled: true };
    const snapshot = applyTemperSimulation(settings, {
      scenario: 'on_feed',
      simulatedDrainingMs: ONE_HOUR_MS,
      simulatedRecoveryAwayMs: 0,
    });
    expect(snapshot.inferredMood).toBe('overwhelmed');
    expect(snapshot.drainingSession.kind).toBe('social');
    expect(snapshot.drainingSession.accumulatedMs).toBe(ONE_HOUR_MS);
    expect(snapshot.settings.devForceMood).toBe('auto');
  });

  it('shows stressed at two minutes on social or news', () => {
    const settings = { ...DEFAULT_SETTINGS, devModeEnabled: true };
    const snapshot = applyTemperSimulation(settings, {
      scenario: 'on_feed',
      simulatedDrainingMs: TWO_MIN_MS,
      simulatedRecoveryAwayMs: 0,
    });
    expect(snapshot.inferredMood).toBe('stressed');
    expect(snapshot.drainingSession.accumulatedMs).toBe(TWO_MIN_MS);
  });

  it('queues recovery easing when away time is zero', () => {
    const settings = { ...DEFAULT_SETTINGS, devModeEnabled: true };
    const snapshot = applyTemperSimulation(settings, {
      scenario: 'away_from_feed',
      simulatedDrainingMs: 0,
      simulatedRecoveryAwayMs: 0,
    });
    expect(snapshot.inferredMood).toBe('stressed');
    expect(snapshot.drainingSession.pendingRecoveryNudge).toBe('easing');
  });

  it('queues thanks when away time crosses one minute', () => {
    const settings = { ...DEFAULT_SETTINGS, devModeEnabled: true };
    const snapshot = applyTemperSimulation(settings, {
      scenario: 'away_from_feed',
      simulatedDrainingMs: 0,
      simulatedRecoveryAwayMs: 60_000,
    });
    expect(snapshot.inferredMood).toBe('happy');
    expect(snapshot.drainingSession.pendingRecoveryNudge).toBe('thanks');
  });

  it('infers stressed then overwhelmed as simulated feed time increases', () => {
    const settings = { ...DEFAULT_SETTINGS, devModeEnabled: true };
    const mid = applyTemperSimulation(
      settings,
      {
        scenario: 'on_feed',
        simulatedDrainingMs: TWO_MIN_MS,
        simulatedRecoveryAwayMs: 0,
      },
      { devForceMood: 'auto' },
    );
    expect(mid.inferredMood).toBe('stressed');
    expect(mid.settings.devForceMood).toBe('auto');

    const max = applyTemperSimulation(
      mid.settings,
      {
        scenario: 'on_feed',
        simulatedDrainingMs: ONE_HOUR_MS,
        simulatedRecoveryAwayMs: 0,
      },
      { devForceMood: 'auto' },
    );
    expect(max.inferredMood).toBe('overwhelmed');
  });

  it('switches back to auto mood when simulation updates after an override', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      devForceMood: 'overwhelmed' as const,
      devSimulatedDrainingMs: ONE_HOUR_MS,
    };
    const snapshot = applyTemperSimulation(
      settings,
      {
        scenario: 'on_feed',
        simulatedDrainingMs: TWO_MIN_MS,
        simulatedRecoveryAwayMs: 0,
      },
      { devForceMood: 'auto' },
    );
    expect(snapshot.settings.devForceMood).toBe('auto');
    expect(snapshot.inferredMood).toBe('stressed');
  });
});

describe('applyDevMoodToTemper', () => {
  it('moves simulation when overwhelmed is picked explicitly', () => {
    const settings = { ...DEFAULT_SETTINGS, devModeEnabled: true };
    const snapshot = applyDevMoodToTemper(settings, 'overwhelmed');
    expect(snapshot.settings.devForceMood).toBe('overwhelmed');
    expect(snapshot.settings.devSimulatedDrainingMs).toBe(MOOD_TIMER_DEV_DEFAULTS.overwhelmedThresholdMs);
  });

  it('keeps explicit hungry override for preview without changing thresholds', () => {
    const settings = { ...DEFAULT_SETTINGS, devModeEnabled: true };
    const snapshot = applyDevMoodToTemper(settings, 'hungry');
    expect(snapshot.settings.devForceMood).toBe('hungry');
    expect(snapshot.drainingSession.kind).toBeNull();
  });

  it('clears draining session for curious so preview stays on the override', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      devSimulatedDrainingMs: ONE_HOUR_MS,
    };
    const snapshot = applyDevMoodToTemper(settings, 'curious');
    expect(snapshot.settings.devForceMood).toBe('curious');
    expect(snapshot.drainingSession.kind).toBeNull();
    expect(snapshot.drainingSession.accumulatedMs).toBe(0);
  });
});

describe('shouldSyncDevForceMoodUi', () => {
  // Regression: tapping a peek on the page resets devForceMood to "auto"
  // behind the popup's back. The dropdown must notice and refresh, or
  // re-picking the same still-displayed option fires no `change` event and
  // the dev menu looks stuck.
  it('refreshes when storage settled on a different mood than the dropdown shows', () => {
    const settings = { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'auto' as const };
    expect(shouldSyncDevForceMoodUi('peek', settings, false)).toBe(true);
  });

  it('does nothing when the dropdown already matches storage', () => {
    const settings = { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'peek' as const };
    expect(shouldSyncDevForceMoodUi('peek', settings, false)).toBe(false);
  });

  it('does not fight its own in-flight request', () => {
    const settings = { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'happy' as const };
    expect(shouldSyncDevForceMoodUi('peek', settings, true)).toBe(false);
  });

  it('does nothing while dev mode is off', () => {
    const settings = { ...DEFAULT_SETTINGS, devModeEnabled: false, devForceMood: 'auto' as const };
    expect(shouldSyncDevForceMoodUi('peek', settings, false)).toBe(false);
  });
});
