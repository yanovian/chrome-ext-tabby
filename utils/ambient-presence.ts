import { isQuietHour } from './settings';
import { isSleepDeferred } from './mood-grace';
import type { CatState, ExtensionSettings } from './types';

export type AmbientActivity = 'sleeping' | 'grooming' | 'peeking';

/** Which screen edge Tabby peeks from. */
export type PeekEdge = 'bottom' | 'left' | 'right';

/** Horizontal corner when peeking from the bottom edge. */
export type PeekCorner = 'left' | 'right';

/** On bottom edge: horizontal corner. On left/right edges: `left` = low, `right` = high. */

export interface PeekPlacement {
  edge: PeekEdge;
  inset: number;
  corner: PeekCorner;
}

export const PEEK_INSET_MIN = 8;
export const PEEK_INSET_MAX = 32;

/** How long hidden rest breaks last before Tabby may return. */
export const AMBIENT_PEEK_MIN_MS = 60_000;
export const AMBIENT_PEEK_MAX_MS = 15 * 60_000;
export const DEV_AMBIENT_PEEK_MIN_MS = 45_000;
export const DEV_AMBIENT_PEEK_MAX_MS = 3 * 60_000;

/** How long a visible edge peek lasts before she ducks away. */
export const AMBIENT_PEEK_VISIT_MIN_MS = 10_000;
export const AMBIENT_PEEK_VISIT_MAX_MS = 45_000;

/** Hidden pause between peek visits before she peeks from another corner. */
export const AMBIENT_PEEK_DUCK_GAP_MIN_MS = 5_000;
export const AMBIENT_PEEK_DUCK_GAP_MAX_MS = 10_000;

/** After the user taps a peek, Tabby stays fully on screen this long. */
export const STAY_VISIBLE_AFTER_REVEAL_MIN_MS = 60_000;
export const STAY_VISIBLE_AFTER_REVEAL_MAX_MS = 3 * 60_000;

/** Daytime = outside quiet hours (when Tabby stays mostly visible). */
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

/** Activity during a hidden rest break. Never peeking (that is a visible peek mood). */
export function pickAmbientRestActivity(seed: number): AmbientActivity {
  return Math.abs(seed) % 2 === 0 ? 'sleeping' : 'grooming';
}

function pickDurationMs(
  settings: ExtensionSettings,
  now: number,
  adoptedAt: number,
  minMs: number,
  maxMs: number,
): number {
  const spread = maxMs - minMs;
  const roll = Math.abs(now + adoptedAt) % (spread + 1);
  return minMs + roll;
}

/** Random hidden rest length between 1 and 15 minutes (shorter band in dev). */
export function pickAmbientPeekDurationMs(
  settings: ExtensionSettings,
  now: number,
  adoptedAt: number,
): number {
  return pickDurationMs(
    settings,
    now,
    adoptedAt,
    settings.devModeEnabled ? DEV_AMBIENT_PEEK_MIN_MS : AMBIENT_PEEK_MIN_MS,
    settings.devModeEnabled ? DEV_AMBIENT_PEEK_MAX_MS : AMBIENT_PEEK_MAX_MS,
  );
}

/** Random visible edge peek length before she ducks away. */
export function pickAmbientPeekVisitDurationMs(
  settings: ExtensionSettings,
  now: number,
  adoptedAt: number,
): number {
  return pickDurationMs(
    settings,
    now,
    adoptedAt,
    AMBIENT_PEEK_VISIT_MIN_MS,
    AMBIENT_PEEK_VISIT_MAX_MS,
  );
}

/** Random pause after ducking before peeking from another corner. */
export function pickAmbientPeekDuckGapMs(
  settings: ExtensionSettings,
  now: number,
  adoptedAt: number,
): number {
  return pickDurationMs(
    settings,
    now,
    adoptedAt,
    AMBIENT_PEEK_DUCK_GAP_MIN_MS,
    AMBIENT_PEEK_DUCK_GAP_MAX_MS,
  );
}

/** How long Tabby stays fully visible after the user taps a peek. */
export function pickStayVisibleAfterRevealMs(
  settings: ExtensionSettings,
  now: number,
  adoptedAt: number,
): number {
  return pickDurationMs(
    settings,
    now,
    adoptedAt,
    STAY_VISIBLE_AFTER_REVEAL_MIN_MS,
    STAY_VISIBLE_AFTER_REVEAL_MAX_MS,
  );
}

interface StayVisiblePresentation {
  companionVisible: boolean;
  stayVisibleUntil: number | null;
}

/** True while Tabby should stay on screen with her real mood after a reveal tap. */
export function isStayVisibleAfterReveal(
  presentation: StayVisiblePresentation,
  now: number,
): boolean {
  return (
    presentation.companionVisible &&
    presentation.stayVisibleUntil !== null &&
    isAmbientPeekActive(presentation.stayVisibleUntil, now)
  );
}

/** True when the post-reveal stay-visible window has ended. */
export function isStayVisibleAfterRevealExpired(
  presentation: StayVisiblePresentation,
  now: number,
): boolean {
  return (
    presentation.companionVisible &&
    presentation.stayVisibleUntil !== null &&
    !isAmbientPeekActive(presentation.stayVisibleUntil, now)
  );
}

export function pickPeekPlacement(seed: number): PeekPlacement {
  const edgeSlot = Math.abs(seed) % 3;
  const edge: PeekEdge = edgeSlot === 0 ? 'bottom' : edgeSlot === 1 ? 'left' : 'right';
  const insetSpread = PEEK_INSET_MAX - PEEK_INSET_MIN + 1;
  const inset = PEEK_INSET_MIN + (Math.abs(seed >> 3) % insetSpread);
  const corner: PeekCorner = Math.abs(seed >> 11) % 2 === 0 ? 'left' : 'right';
  return { edge, inset, corner };
}

export interface AmbientRestInput {
  cat: CatState;
  settings: ExtensionSettings;
  now: number;
  speechWouldAppear: boolean;
  restUntil: number | null;
}

/** Whether Tabby should duck away quietly for a short rest. */
export function shouldStartAmbientRest(input: AmbientRestInput): boolean {
  const hour = new Date(input.now).getHours();
  if (!isDaytime(hour, input.settings)) {
    return false;
  }

  if (isSleepDeferred(input.cat, input.now)) {
    return false;
  }

  if (input.speechWouldAppear) {
    return false;
  }

  if (input.restUntil !== null && input.restUntil > input.now) {
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

  const roll = Math.abs(input.now + cat.adoptedAt + 5) % 10;
  return roll < 1;
}

export function isAmbientPeekActive(peekUntil: number | null, now: number): boolean {
  return peekUntil !== null && now < peekUntil;
}

interface AmbientPeekPresentation {
  companionVisible: boolean;
  ambientActivity: AmbientActivity | null;
  ambientPeekUntil: number | null;
}

/** True when a visible edge peek timer has elapsed and Tabby should duck away. */
export function isAmbientPeekVisitExpired(
  presentation: AmbientPeekPresentation,
  now: number,
): boolean {
  return (
    presentation.companionVisible &&
    presentation.ambientActivity === 'peeking' &&
    presentation.ambientPeekUntil !== null &&
    !isAmbientPeekActive(presentation.ambientPeekUntil, now)
  );
}

/** Hidden and mid-cycle: the peek timer is set, waiting to become active or expire. */
function isDuckGapState(presentation: AmbientPeekPresentation): boolean {
  return (
    !presentation.companionVisible &&
    presentation.ambientActivity === 'peeking' &&
    presentation.ambientPeekUntil !== null
  );
}

/** True while Tabby is hidden between peek visits (duck gap). */
export function isAmbientPeekDuckGapActive(
  presentation: AmbientPeekPresentation,
  now: number,
): boolean {
  return isDuckGapState(presentation) && isAmbientPeekActive(presentation.ambientPeekUntil, now);
}

/** True when the duck gap ended and Tabby should peek from a new corner. */
export function isAmbientPeekDuckGapExpired(
  presentation: AmbientPeekPresentation,
  now: number,
): boolean {
  return isDuckGapState(presentation) && !isAmbientPeekActive(presentation.ambientPeekUntil, now);
}

/** True when an ambient rest timer has elapsed and Tabby should come back. */
export function isAmbientRestExpired(
  presentation: AmbientPeekPresentation,
  now: number,
): boolean {
  return (
    !presentation.companionVisible &&
    presentation.ambientActivity !== null &&
    presentation.ambientPeekUntil !== null &&
    !isAmbientPeekActive(presentation.ambientPeekUntil, now)
  );
}
