import { isQuietHour } from './settings';
import type { CatState, ExtensionSettings } from './types';

/** Hunger level after a treat — well below the hungry threshold. */
export const SATIATED_HUNGER_LEVEL = 30;

export const MOOD_GRACE = {
  satiatedMs: 2 * 60 * 60_000,
  happyMs: 20 * 60_000,
  sleepDeferMs: 30 * 60_000,
} as const;

export function effectiveMoodGrace(): typeof MOOD_GRACE {
  return MOOD_GRACE;
}

export function isSatiated(
  cat: CatState,
  now: number,
): boolean {
  return cat.satiatedUntil > now;
}

export function isInHappyGrace(
  cat: CatState,
  now: number,
): boolean {
  return cat.happyUntil > now;
}

export function isSleepDeferred(
  cat: CatState,
  now: number,
): boolean {
  const { sleepDeferMs } = MOOD_GRACE;
  return cat.lastCareAt > 0 && now - cat.lastCareAt < sleepDeferMs;
}

/** Scale passive hunger rise by local hour — faster around mealtimes, slower at night. */
export function hungerRateMultiplier(hour: number, settings: ExtensionSettings): number {
  if (isQuietHour(hour, settings)) {
    return 0.15;
  }
  if (hour >= 7 && hour < 10) {
    return 0.7;
  }
  if (hour >= 11 && hour < 14) {
    return 0.85;
  }
  if (hour >= 17 && hour < 20) {
    return 0.75;
  }
  if (hour >= 14 && hour < 17) {
    return 0.5;
  }
  return 0.4;
}
