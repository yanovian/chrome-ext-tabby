import { isQuietHour } from './settings';
import type { CatState, ExtensionSettings } from './types';

export type AmbientActivity = 'sleeping' | 'grooming' | 'peeking';

/** How long ambient visits last before Tabby hides again. */
export const AMBIENT_PEEK_MIN_MS = 60_000;
export const AMBIENT_PEEK_MAX_MS = 15 * 60_000;
export const DEV_AMBIENT_PEEK_MIN_MS = 45_000;
export const DEV_AMBIENT_PEEK_MAX_MS = 3 * 60_000;

/** Daytime = outside quiet hours (when Tabby stays mostly hidden). */
export function isDaytime(hour: number, settings: ExtensionSettings): boolean {
  return !isQuietHour(hour, settings);
}

export function effectiveAmbientLimits(settings: ExtensionSettings): {
  maxPerDay: number;
  cooldownMinutes: number;
} {
  if (settings.devModeEnabled) {
    return {
      maxPerDay: 48,
      cooldownMinutes: 1,
    };
  }

  return {
    maxPerDay: 12,
    cooldownMinutes: 10,
  };
}

function minutesSince(timestamp: number, now: number): number {
  if (timestamp <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return (now - timestamp) / 60_000;
}

function dayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function resetDailyAmbientCounter(cat: CatState, now: number): CatState {
  const today = dayKey(now);
  if (cat.ambientsDayKey === today) {
    return cat;
  }
  return {
    ...cat,
    ambientsToday: 0,
    ambientsDayKey: today,
  };
}

export function recordAmbientAppearance(cat: CatState, now: number): CatState {
  const withDay = resetDailyAmbientCounter(cat, now);
  return {
    ...withDay,
    ambientsToday: withDay.ambientsToday + 1,
    lastAmbientAt: now,
    lastSeenAt: now,
  };
}

export function pickAmbientActivity(seed: number): AmbientActivity {
  const slot = Math.abs(seed) % 3;
  if (slot === 0) {
    return 'sleeping';
  }
  if (slot === 1) {
    return 'grooming';
  }
  return 'peeking';
}

/** Random visit length between 1 and 15 minutes (shorter band in dev). */
export function pickAmbientPeekDurationMs(
  settings: ExtensionSettings,
  now: number,
  adoptedAt: number,
): number {
  const minMs = settings.devModeEnabled ? DEV_AMBIENT_PEEK_MIN_MS : AMBIENT_PEEK_MIN_MS;
  const maxMs = settings.devModeEnabled ? DEV_AMBIENT_PEEK_MAX_MS : AMBIENT_PEEK_MAX_MS;
  const spread = maxMs - minMs;
  const roll = Math.abs(now + adoptedAt) % (spread + 1);
  return minMs + roll;
}

export interface AmbientPeekInput {
  cat: CatState;
  settings: ExtensionSettings;
  now: number;
  speechWouldAppear: boolean;
  peekUntil: number | null;
}

/** Whether Tabby should peek in quietly (no speech) for a short moment. */
export function shouldStartAmbientPeek(input: AmbientPeekInput): boolean {
  const hour = new Date(input.now).getHours();
  if (!isDaytime(hour, input.settings)) {
    return false;
  }

  if (input.speechWouldAppear) {
    return false;
  }

  if (input.peekUntil !== null && input.peekUntil > input.now) {
    return false;
  }

  const limits = effectiveAmbientLimits(input.settings);
  const cat = resetDailyAmbientCounter(input.cat, input.now);

  if (cat.ambientsToday >= limits.maxPerDay) {
    return false;
  }

  if (minutesSince(cat.lastAmbientAt, input.now) < limits.cooldownMinutes) {
    return false;
  }

  const roll = Math.abs(input.now + cat.adoptedAt) % 5;
  return roll < 2;
}

export function isAmbientPeekActive(peekUntil: number | null, now: number): boolean {
  return peekUntil !== null && now < peekUntil;
}

/** True when an ambient visit timer has elapsed and Tabby should duck away. */
export function isAmbientPeekExpired(
  presentation: {
    companionVisible: boolean;
    ambientActivity: AmbientActivity | null;
    ambientPeekUntil: number | null;
  },
  now: number,
): boolean {
  return (
    presentation.companionVisible &&
    presentation.ambientActivity !== null &&
    presentation.ambientPeekUntil !== null &&
    !isAmbientPeekActive(presentation.ambientPeekUntil, now)
  );
}
