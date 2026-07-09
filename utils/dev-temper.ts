import {
  EMPTY_DRAINING_SESSION,
  type DrainingSessionState,
} from './draining-session';
import {
  inferTemperMood,
  readTemperSimulation,
  resolveMoodTimers,
  temperSimulationForDevMood,
  type TemperSimulation,
} from './mood-timers';
import type { CatMood, DevMoodOverride, ExtensionSettings } from './types';

const TEMPER_DEV_MOODS: CatMood[] = ['overwhelmed', 'stressed', 'happy'];

function isTemperDevMood(mood: DevMoodOverride): mood is 'overwhelmed' | 'stressed' | 'happy' {
  return mood !== 'auto' && TEMPER_DEV_MOODS.includes(mood);
}

export interface DevTemperSnapshot {
  settings: ExtensionSettings;
  drainingSession: DrainingSessionState;
  inferredMood: CatMood;
}

function buildDrainingSessionFromSimulation(
  simulation: TemperSimulation,
  timers: ReturnType<typeof resolveMoodTimers>,
  now: number,
): DrainingSessionState {
  if (simulation.scenario === 'on_feed') {
    const overwhelmed = simulation.simulatedDrainingMs >= timers.overwhelmedThresholdMs;
    return {
      ...EMPTY_DRAINING_SESSION,
      kind: 'social',
      accumulatedMs: simulation.simulatedDrainingMs,
      pendingNudgeKind: overwhelmed ? 'social' : null,
    };
  }

  const thanksDue =
    simulation.simulatedRecoveryAwayMs >= timers.recoveryThanksThresholdMs;
  const easingOnly = simulation.simulatedRecoveryAwayMs === 0;
  return {
    ...EMPTY_DRAINING_SESSION,
    recoveryStartedAt: now,
    recoveryAwayMs: simulation.simulatedRecoveryAwayMs,
    recoveryEasingAckedAt: easingOnly ? null : now - 1,
    pendingRecoveryNudge: thanksDue ? 'thanks' : easingOnly ? 'easing' : null,
  };
}

/** Apply simulated dwell time and optional mood override (does not change thresholds). */
export function applyTemperSimulation(
  settings: ExtensionSettings,
  simulation: TemperSimulation,
  options: { devForceMood?: DevMoodOverride; now?: number } = {},
): DevTemperSnapshot {
  const timers = resolveMoodTimers(settings);
  const normalized = readTemperSimulation({
    ...settings,
    devTemperScenario: simulation.scenario,
    devSimulatedDrainingMs: simulation.simulatedDrainingMs,
    devSimulatedRecoveryAwayMs: simulation.simulatedRecoveryAwayMs,
  });
  const nextSettings: ExtensionSettings = {
    ...settings,
    devTemperScenario: normalized.scenario,
    devSimulatedDrainingMs: normalized.simulatedDrainingMs,
    devSimulatedRecoveryAwayMs: normalized.simulatedRecoveryAwayMs,
    devForceMood: options.devForceMood ?? settings.devForceMood,
  };
  const drainingSession = buildDrainingSessionFromSimulation(
    normalized,
    timers,
    options.now ?? Date.now(),
  );
  const inferredMood = inferTemperMood(timers, normalized, 'content');
  return { settings: nextSettings, drainingSession, inferredMood };
}

/** @deprecated Use applyTemperSimulation */
export const applyTemperSliders = applyTemperSimulation;

/** Sync simulation when the dev mood dropdown changes. */
export function applyDevMoodToTemper(
  settings: ExtensionSettings,
  mood: DevMoodOverride,
): DevTemperSnapshot {
  if (mood === 'auto') {
    return applyTemperSimulation(settings, readTemperSimulation(settings), { devForceMood: 'auto' });
  }

  const timers = resolveMoodTimers(settings);
  const current = readTemperSimulation(settings);

  if (isTemperDevMood(mood)) {
    const simulation = temperSimulationForDevMood(mood, timers, current);
    return applyTemperSimulation(settings, simulation, { devForceMood: mood });
  }

  const neutralSimulation: TemperSimulation = {
    scenario: 'on_feed',
    simulatedDrainingMs: 0,
    simulatedRecoveryAwayMs: 0,
  };
  const snapshot = applyTemperSimulation(settings, neutralSimulation, { devForceMood: mood });
  return {
    ...snapshot,
    drainingSession: { ...EMPTY_DRAINING_SESSION },
  };
}

/** Load simulation values from settings + live draining session (if any). */
export function temperSimulationFromSession(
  settings: ExtensionSettings,
  session: DrainingSessionState,
): TemperSimulation {
  const base = readTemperSimulation(settings);
  if (session.recoveryStartedAt !== null) {
    return {
      ...base,
      scenario: 'away_from_feed',
      simulatedRecoveryAwayMs: session.recoveryAwayMs,
    };
  }
  if (session.kind) {
    return {
      ...base,
      scenario: 'on_feed',
      simulatedDrainingMs: session.accumulatedMs,
    };
  }
  return base;
}

/** @deprecated Use temperSimulationFromSession */
export const temperSlidersFromSession = temperSimulationFromSession;
