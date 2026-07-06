import type {
  BrowseCategory,
  CatLifeStage,
  CatMood,
  CatState,
  CatVitals,
  DevLifeStageOverride,
  ExtensionSettings,
  MemorySeed,
} from './types';
import { CAT_NAME } from './types';
import { effectiveAppearanceLimits } from './settings';

export const VITAL_MIN = 0;
export const VITAL_MAX = 100;

export interface StatDeltaInput {
  category: BrowseCategory;
  activeDurationMs: number;
  statMultiplier: number;
}

export interface VisitStatInput {
  category: BrowseCategory;
  statMultiplier: number;
}

export interface TickInput {
  cat: CatState;
  now: number;
  settings: ExtensionSettings;
  isUserIdle: boolean;
}

export interface MoodInput {
  vitals: CatVitals;
  now: number;
  settings: ExtensionSettings;
  isUserIdle: boolean;
}

function clampVital(value: number): number {
  return Math.max(VITAL_MIN, Math.min(VITAL_MAX, value));
}

function dayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function createInitialCat(now: number): CatState {
  return {
    name: CAT_NAME,
    adoptedAt: now,
    stage: 'newborn',
    vitals: {
      hunger: 35,
      happiness: 70,
      stress: 15,
      energy: 80,
    },
    lastCareAt: now,
    lastSeenAt: now,
    lastSpeechAt: 0,
    nudgesToday: 0,
    nudgesDayKey: dayKey(now),
    mischiefCooldownAt: 0,
  };
}

/** Apply browsing activity to internal vitals. */
export function applyBrowsingToVitals(
  vitals: CatVitals,
  input: StatDeltaInput,
): CatVitals {
  const minutes = input.activeDurationMs / 60_000;
  const scale = input.statMultiplier;
  const next = { ...vitals };

  switch (input.category) {
    case 'nourishing':
      next.hunger = clampVital(next.hunger - 8 * minutes * scale);
      next.happiness = clampVital(next.happiness + 6 * minutes * scale);
      next.stress = clampVital(next.stress - 4 * minutes * scale);
      next.energy = clampVital(next.energy - 2 * minutes * scale);
      break;
    case 'draining':
      next.stress = clampVital(next.stress + 10 * minutes * scale);
      next.happiness = clampVital(next.happiness - 5 * minutes * scale);
      next.energy = clampVital(next.energy - 4 * minutes * scale);
      next.hunger = clampVital(next.hunger + 3 * minutes * scale);
      break;
    case 'neutral':
      next.hunger = clampVital(next.hunger + 2 * minutes * scale);
      next.energy = clampVital(next.energy - 1 * minutes * scale);
      break;
  }

  return next;
}

/** Small fixed bump when the user lands on a new page (title + URL classification). */
export function applyVisitToVitals(
  vitals: CatVitals,
  input: VisitStatInput,
): CatVitals {
  const scale = input.statMultiplier;
  const next = { ...vitals };

  switch (input.category) {
    case 'nourishing':
      next.hunger = clampVital(next.hunger - 1 * scale);
      next.happiness = clampVital(next.happiness + 1 * scale);
      next.stress = clampVital(next.stress - 1 * scale);
      break;
    case 'draining':
      next.stress = clampVital(next.stress + 1 * scale);
      next.happiness = clampVital(next.happiness - 1 * scale);
      break;
    case 'neutral':
      next.hunger = clampVital(next.hunger + 1 * scale);
      break;
  }

  return next;
}

/** Passive drift each minute when the user is browsing or idle. */
export function applyMinuteTick(vitals: CatVitals, input: TickInput): CatVitals {
  const { statMultiplier } = effectiveAppearanceLimits(input.settings);
  const next = { ...vitals };

  next.hunger = clampVital(next.hunger + 0.4 * statMultiplier);
  next.stress = clampVital(next.stress - 0.2 * statMultiplier);

  if (input.isUserIdle) {
    next.energy = clampVital(next.energy + 1.5 * statMultiplier);
    next.stress = clampVital(next.stress - 0.5 * statMultiplier);
  } else {
    next.energy = clampVital(next.energy - 0.3 * statMultiplier);
  }

  if (next.hunger < 25 && next.stress < 40) {
    next.happiness = clampVital(next.happiness + 0.2 * statMultiplier);
  }

  if (next.stress > 70) {
    next.happiness = clampVital(next.happiness - 0.4 * statMultiplier);
  }

  return next;
}

/** Map vitals to a visible mood — includes funny extremes, never death. */
export function deriveMoodFromVitals(input: MoodInput): CatMood {
  const { vitals, isUserIdle, settings } = input;
  const hour = new Date(input.now).getHours();
  const quiet =
    settings.quietHoursStart !== settings.quietHoursEnd &&
    (settings.quietHoursStart < settings.quietHoursEnd
      ? hour >= settings.quietHoursStart && hour < settings.quietHoursEnd
      : hour >= settings.quietHoursStart || hour < settings.quietHoursEnd);

  if (isUserIdle || (quiet && vitals.energy < 45)) {
    return 'sleepy';
  }

  if (vitals.hunger >= 88) {
    return 'starving';
  }

  if (vitals.hunger >= 65) {
    return 'hungry';
  }

  if (vitals.stress >= 72) {
    return 'stressed';
  }

  if (vitals.happiness >= 82 && vitals.stress < 35) {
    return 'happy';
  }

  if (vitals.hunger < 40 && vitals.stress < 45 && vitals.happiness >= 60) {
    return 'curious';
  }

  if (vitals.happiness >= 55 && vitals.stress < 55) {
    return 'content';
  }

  return 'content';
}

export function applyCareAction(
  cat: CatState,
  action: 'pet' | 'treat' | 'play',
  now: number,
): CatState {
  const vitals = { ...cat.vitals };

  switch (action) {
    case 'pet':
      vitals.happiness = clampVital(vitals.happiness + 12);
      vitals.stress = clampVital(vitals.stress - 8);
      break;
    case 'treat':
      vitals.hunger = clampVital(vitals.hunger - 25);
      vitals.happiness = clampVital(vitals.happiness + 8);
      break;
    case 'play':
      vitals.happiness = clampVital(vitals.happiness + 15);
      vitals.energy = clampVital(vitals.energy - 10);
      vitals.stress = clampVital(vitals.stress - 10);
      break;
  }

  return {
    ...cat,
    vitals,
    lastCareAt: now,
    lastSeenAt: now,
  };
}

export function resetDailyNudgeCounter(cat: CatState, now: number): CatState {
  const today = dayKey(now);
  if (cat.nudgesDayKey === today) {
    return cat;
  }
  return {
    ...cat,
    nudgesToday: 0,
    nudgesDayKey: today,
  };
}

export function recordAppearance(cat: CatState, now: number): CatState {
  const withDay = resetDailyNudgeCounter(cat, now);
  return {
    ...withDay,
    nudgesToday: withDay.nudgesToday + 1,
    lastSpeechAt: now,
    lastSeenAt: now,
  };
}

/** Real-world age gates — growth over weeks and months, not days of grinding. */
export const LIFE_STAGE_THRESHOLDS_DAYS = {
  newbornMax: 14,
  playfulMax: 120,
} as const;

export function deriveLifeStage(adoptedAt: number, now: number): CatLifeStage {
  const days = daysTogether(adoptedAt, now);
  if (days <= LIFE_STAGE_THRESHOLDS_DAYS.newbornMax) {
    return 'newborn';
  }
  if (days <= LIFE_STAGE_THRESHOLDS_DAYS.playfulMax) {
    return 'playful';
  }
  return 'adult';
}

export function resolveLifeStage(
  adoptedAt: number,
  now: number,
  devForceLifeStage: DevLifeStageOverride = 'auto',
): CatLifeStage {
  if (devForceLifeStage !== 'auto') {
    return devForceLifeStage;
  }
  return deriveLifeStage(adoptedAt, now);
}

export function pickMemoryForRecall(
  memories: MemorySeed[],
  now: number,
): MemorySeed | null {
  const eligible = memories
    .filter((memory) => {
      if (!memory.lastRecalledAt) {
        return true;
      }
      return now - memory.lastRecalledAt > 1000 * 60 * 60 * 24 * 3;
    })
    .sort((left, right) => right.lastSeenAt - left.lastSeenAt);

  return eligible[0] ?? null;
}

export function markMemoryRecalled(
  memory: MemorySeed,
  now: number,
): MemorySeed {
  return {
    ...memory,
    lastRecalledAt: now,
  };
}

export function daysTogether(adoptedAt: number, now: number): number {
  return Math.floor((now - adoptedAt) / (1000 * 60 * 60 * 24));
}
