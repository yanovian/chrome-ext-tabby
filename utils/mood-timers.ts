import type { CatMood, DevMoodOverride, DevTemperScenario, ExtensionSettings } from './types';

/** Production temper timings — single source of truth for shipped behavior. */
export const MOOD_TIMER_PRODUCTION = {
  overwhelmedThresholdMs: 60 * 60_000,
  recoveryThanksThresholdMs: 60_000,
  stressedVitalThreshold: 72,
} as const;

/** Default dev simulation seeds (thresholds match production). */
export const MOOD_TIMER_DEV_DEFAULTS = {
  overwhelmedThresholdMs: MOOD_TIMER_PRODUCTION.overwhelmedThresholdMs,
  recoveryThanksThresholdMs: MOOD_TIMER_PRODUCTION.recoveryThanksThresholdMs,
  stressedVitalThreshold: MOOD_TIMER_PRODUCTION.stressedVitalThreshold,
  simulatedDrainingMs: 0,
  simulatedRecoveryAwayMs: 0,
} as const;

export interface MoodTimers {
  overwhelmedThresholdMs: number;
  recoveryThanksThresholdMs: number;
  stressedVitalThreshold: number;
}

export interface MoodTimerSliderBounds {
  min: number;
  max: number;
  step: number;
}

export const MOOD_TIMER_SLIDER_BOUNDS: Record<
  'simulatedDrainingMs' | 'simulatedRecoveryAwayMs',
  MoodTimerSliderBounds
> = {
  simulatedDrainingMs: { min: 0, max: 120 * 60_000, step: 15_000 },
  simulatedRecoveryAwayMs: { min: 0, max: 5 * 60_000, step: 5_000 },
};

/** Dev popup slider ranges (real-world minutes, production thresholds). */
export const MOOD_TIMER_DEV_SIM_BOUNDS: Record<
  'simulatedDrainingMs' | 'simulatedRecoveryAwayMs',
  MoodTimerSliderBounds
> = {
  simulatedDrainingMs: { min: 0, max: 90 * 60_000, step: 60_000 },
  simulatedRecoveryAwayMs: { min: 0, max: 5 * 60_000, step: 5_000 },
};

function clampMs(value: number, fallback: number, bounds: MoodTimerSliderBounds): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const stepped =
    Math.round(value / bounds.step) * bounds.step;
  return Math.max(bounds.min, Math.min(bounds.max, stepped));
}

/** Effective thresholds — same in dev and production (sliders simulate real dwell time). */
export function resolveMoodTimers(_settings: ExtensionSettings): MoodTimers {
  return { ...MOOD_TIMER_PRODUCTION };
}

export function clampSimulatedDrainingMs(
  value: number,
  timers: MoodTimers,
): number {
  const bounds = {
    ...MOOD_TIMER_SLIDER_BOUNDS.simulatedDrainingMs,
    max: Math.max(
      MOOD_TIMER_SLIDER_BOUNDS.simulatedDrainingMs.max,
      timers.overwhelmedThresholdMs + 60_000,
    ),
  };
  return clampMs(value, MOOD_TIMER_DEV_DEFAULTS.simulatedDrainingMs, bounds);
}

export function clampSimulatedRecoveryAwayMs(
  value: number,
  timers: MoodTimers,
): number {
  const bounds = {
    ...MOOD_TIMER_SLIDER_BOUNDS.simulatedRecoveryAwayMs,
    max: Math.max(
      MOOD_TIMER_SLIDER_BOUNDS.simulatedRecoveryAwayMs.max,
      timers.recoveryThanksThresholdMs + 30_000,
    ),
  };
  return clampMs(value, MOOD_TIMER_DEV_DEFAULTS.simulatedRecoveryAwayMs, bounds);
}

/** Human label for slider values in the popup. */
export function formatTemperDuration(ms: number): string {
  if (ms < 60_000) {
    return `${Math.round(ms / 1000)}s`;
  }
  if (ms < 60 * 60_000) {
    const minutes = Math.round(ms / 60_000);
    return `${minutes} min`;
  }
  const hours = ms / (60 * 60_000);
  return hours >= 1.95 ? `${Math.round(hours)} hr` : `${hours.toFixed(1)} hr`;
}

export interface TemperSimulation {
  scenario: DevTemperScenario;
  simulatedDrainingMs: number;
  simulatedRecoveryAwayMs: number;
}

/** @deprecated Use TemperSimulation */
export type TemperSliderValues = TemperSimulation & {
  overwhelmedThresholdMs?: number;
  recoveryThanksThresholdMs?: number;
  stressedVitalThreshold?: number;
};

/** Read dev simulation sliders from stored settings. */
export function readTemperSimulation(settings: ExtensionSettings): TemperSimulation {
  const timers = resolveMoodTimers(settings);
  return {
    scenario: settings.devTemperScenario,
    simulatedDrainingMs: clampSimulatedDrainingMs(
      settings.devSimulatedDrainingMs,
      timers,
    ),
    simulatedRecoveryAwayMs: clampSimulatedRecoveryAwayMs(
      settings.devSimulatedRecoveryAwayMs,
      timers,
    ),
  };
}

/** @deprecated Use readTemperSimulation */
export function readTemperSliderValues(settings: ExtensionSettings): TemperSliderValues {
  const simulation = readTemperSimulation(settings);
  const timers = resolveMoodTimers(settings);
  return { ...simulation, ...timers };
}

/** Map an explicit dev mood pick to simulation sliders (Auto uses sliders to infer mood). */
export function temperSimulationForDevMood(
  mood: DevMoodOverride,
  timers: MoodTimers,
  current: TemperSimulation,
): TemperSimulation {
  if (mood === 'auto') {
    return current;
  }

  switch (mood) {
    case 'overwhelmed':
      return {
        ...current,
        scenario: 'on_feed',
        simulatedDrainingMs: timers.overwhelmedThresholdMs,
        simulatedRecoveryAwayMs: 0,
      };
    case 'stressed':
      return {
        ...current,
        scenario: current.scenario === 'away_from_feed' ? 'away_from_feed' : 'on_feed',
        simulatedDrainingMs:
          current.scenario === 'on_feed'
            ? Math.floor(timers.overwhelmedThresholdMs * 0.5)
            : current.simulatedDrainingMs,
        simulatedRecoveryAwayMs:
          current.scenario === 'away_from_feed' ? 0 : current.simulatedRecoveryAwayMs,
      };
    case 'happy':
      return {
        ...current,
        scenario: 'away_from_feed',
        simulatedRecoveryAwayMs: timers.recoveryThanksThresholdMs,
      };
    default:
      return current;
  }
}

/** @deprecated Use temperSimulationForDevMood */
export const temperSlidersForDevMood = temperSimulationForDevMood;

/** Infer temper-related mood from fixed thresholds + simulated dwell time (dev auto mode). */
export function inferTemperMood(
  timers: MoodTimers,
  simulation: TemperSimulation,
  derivedMood: CatMood,
): CatMood {
  const urgent: CatMood[] = ['starving', 'hungry', 'sleepy'];
  if (urgent.includes(derivedMood)) {
    return derivedMood;
  }

  if (simulation.scenario === 'on_feed') {
    if (simulation.simulatedDrainingMs >= timers.overwhelmedThresholdMs) {
      return 'overwhelmed';
    }
    if (simulation.simulatedDrainingMs > 0 || derivedMood === 'stressed') {
      return 'stressed';
    }
    return derivedMood;
  }

  if (simulation.simulatedRecoveryAwayMs >= timers.recoveryThanksThresholdMs) {
    return 'happy';
  }
  return 'stressed';
}

/** Mood shown in dev UI: override wins, else inferred from simulation. */
export function resolveDevPreviewMood(
  settings: ExtensionSettings,
  simulation: TemperSimulation,
  derivedMood: CatMood,
): CatMood {
  if (settings.devForceMood !== 'auto') {
    return settings.devForceMood;
  }
  return inferTemperMood(resolveMoodTimers(settings), simulation, derivedMood);
}

/** Match inferred temper mood to the closest dev mood override label. */
export function devMoodLabelForTemper(
  inferred: CatMood,
  current: DevMoodOverride,
): DevMoodOverride {
  if (current !== 'auto') {
    return current;
  }
  if (inferred === 'overwhelmed' || inferred === 'stressed' || inferred === 'happy') {
    return inferred;
  }
  return 'auto';
}

/** Default dev timer fields for mergeSettings / DEFAULT_SETTINGS. */
export function defaultDevTemperFieldValues(): {
  devOverwhelmedThresholdMs: number;
  devRecoveryThanksThresholdMs: number;
  devStressedVitalThreshold: number;
  devTemperScenario: DevTemperScenario;
  devSimulatedDrainingMs: number;
  devSimulatedRecoveryAwayMs: number;
} {
  return {
    devOverwhelmedThresholdMs: MOOD_TIMER_DEV_DEFAULTS.overwhelmedThresholdMs,
    devRecoveryThanksThresholdMs: MOOD_TIMER_DEV_DEFAULTS.recoveryThanksThresholdMs,
    devStressedVitalThreshold: MOOD_TIMER_DEV_DEFAULTS.stressedVitalThreshold,
    devTemperScenario: 'on_feed',
    devSimulatedDrainingMs: MOOD_TIMER_DEV_DEFAULTS.simulatedDrainingMs,
    devSimulatedRecoveryAwayMs: MOOD_TIMER_DEV_DEFAULTS.simulatedRecoveryAwayMs,
  };
}
