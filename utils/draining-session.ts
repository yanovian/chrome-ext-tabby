import { matchDrainingSessionKind } from './site-registry';
import { resolveMoodTimers } from './mood-timers';
import type { DrainingSessionKind, ExtensionSettings } from './types';
import { STORAGE_KEYS } from './types';
export const DRAINING_SESSION_THRESHOLD_MS = 60 * 60_000;
export const DEV_DRAINING_SESSION_THRESHOLD_MS = 3 * 60_000;
export const RECOVERY_THANKS_THRESHOLD_MS = 60_000;
export const DEV_RECOVERY_THANKS_THRESHOLD_MS = 15_000;

export type CareRecoveryAction = 'pet' | 'play';

/** Comfort chipped off an active draining session per care action (never clears it outright). */
export const CARE_RECOVERY_CREDIT_MS: Record<CareRecoveryAction, number> = {
  pet: 5 * 60_000,
  play: 10 * 60_000,
};

/** Comfort added to "time away" progress once recovery has already started. */
export const CARE_RECOVERY_AWAY_CREDIT_MS: Record<CareRecoveryAction, number> = {
  pet: 15_000,
  play: 30_000,
};

export type DrainingRecoveryNudge = 'easing' | 'thanks';

export interface DrainingSessionState {
  kind: DrainingSessionKind | null;
  accumulatedMs: number;
  /** When Tabby last spoke for this accumulation cycle. */
  lastNudgedAt: number | null;
  /** Set when accumulated time crosses the threshold until the nudge is shown. */
  pendingNudgeKind: DrainingSessionKind | null;
  /** When the user left a long social/news session. */
  recoveryStartedAt: number | null;
  /** Time on non-draining pages since recovery began. */
  recoveryAwayMs: number;
  /** Queued recovery speech after leaving an overwhelmed session. */
  pendingRecoveryNudge: DrainingRecoveryNudge | null;
  /** When the easing line was shown (thanks wait starts after this). */
  recoveryEasingAckedAt: number | null;
}

export const EMPTY_DRAINING_SESSION: DrainingSessionState = {
  kind: null,
  accumulatedMs: 0,
  lastNudgedAt: null,
  pendingNudgeKind: null,
  recoveryStartedAt: null,
  recoveryAwayMs: 0,
  pendingRecoveryNudge: null,
  recoveryEasingAckedAt: null,
};

export function drainingSessionThresholdMs(settings: ExtensionSettings): number {
  return resolveMoodTimers(settings).overwhelmedThresholdMs;
}

export function recoveryThanksThresholdMs(settings: ExtensionSettings): number {
  return resolveMoodTimers(settings).recoveryThanksThresholdMs;
}

export function isInDrainingRecovery(state: DrainingSessionState): boolean {
  return state.recoveryStartedAt !== null;
}

/** Long social/news session — display `overwhelmed` instead of vitals `stressed`. */
export function isDrainingSessionOverwhelmed(
  state: DrainingSessionState,
  settings: ExtensionSettings,
): boolean {
  if (!state.kind || isInDrainingRecovery(state)) {
    return false;
  }
  return state.accumulatedMs >= drainingSessionThresholdMs(settings);
}

/** Active social/news dwell below overwhelmed — show vitals `stressed` tier. */
export function isDrainingSessionStressed(
  state: DrainingSessionState,
  settings: ExtensionSettings,
): boolean {
  if (!state.kind || isInDrainingRecovery(state)) {
    return false;
  }
  if (isDrainingSessionOverwhelmed(state, settings)) {
    return false;
  }
  return state.accumulatedMs > 0;
}

/** Speech nudge queued for the current long session, if any. */
export function pendingOverwhelmedNudge(
  state: DrainingSessionState,
): DrainingSessionKind | null {
  return state.pendingNudgeKind;
}

export function pendingRecoveryNudge(
  state: DrainingSessionState,
): DrainingRecoveryNudge | null {
  return state.pendingRecoveryNudge;
}

export function isDrainingRecoveryThanksDue(
  state: DrainingSessionState,
  settings: ExtensionSettings,
): boolean {
  if (!isInDrainingRecovery(state) || state.recoveryEasingAckedAt === null) {
    return false;
  }
  return state.recoveryAwayMs >= recoveryThanksThresholdMs(settings);
}

function wasOverwhelmedSession(
  state: DrainingSessionState,
  thresholdMs: number,
): boolean {
  return Boolean(state.kind) && state.accumulatedMs >= thresholdMs;
}

function beginRecovery(now: number): DrainingSessionState {
  return {
    ...EMPTY_DRAINING_SESSION,
    recoveryStartedAt: now,
    recoveryAwayMs: 0,
    pendingRecoveryNudge: 'easing',
  };
}

function startDrainingKind(
  kind: DrainingSessionKind,
  elapsedMs: number,
  thresholdMs: number,
): DrainingSessionState {
  const next: DrainingSessionState = {
    ...EMPTY_DRAINING_SESSION,
    kind,
    accumulatedMs: elapsedMs,
  };
  return maybeQueueOverwhelmedNudge(next, thresholdMs);
}

function advanceRecoveryAway(
  state: DrainingSessionState,
  elapsedMs: number,
  recoveryThanksThresholdMs: number,
): DrainingSessionState {
  const recoveryAwayMs = state.recoveryAwayMs + elapsedMs;
  const next: DrainingSessionState = {
    ...state,
    recoveryAwayMs,
  };
  if (
    next.recoveryEasingAckedAt !== null &&
    recoveryAwayMs >= recoveryThanksThresholdMs &&
    !next.pendingRecoveryNudge
  ) {
    return { ...next, pendingRecoveryNudge: 'thanks' };
  }
  return next;
}

/** Petting or playing chips away at a long draining session: while still on the draining tab
 * it knocks time off the accumulated total, and once recovery has started (tab already left)
 * it adds to the "time away" progress. Matches the "step away" nudge by never clearing a
 * session outright, only speeding it up. */
export function applyCareRecoveryCredit(
  state: DrainingSessionState,
  action: CareRecoveryAction,
  settings: ExtensionSettings,
): DrainingSessionState {
  if (isInDrainingRecovery(state)) {
    return advanceRecoveryAway(
      state,
      CARE_RECOVERY_AWAY_CREDIT_MS[action],
      recoveryThanksThresholdMs(settings),
    );
  }
  if (!state.kind || state.accumulatedMs <= 0) {
    return state;
  }
  const accumulatedMs = Math.max(0, state.accumulatedMs - CARE_RECOVERY_CREDIT_MS[action]);
  if (accumulatedMs === state.accumulatedMs) {
    return state;
  }
  return { ...state, accumulatedMs };
}

/** Update session when the active tab changes (leave or return to social/news). */
export function applyDrainingSessionPageChange(
  state: DrainingSessionState,
  input: {
    title?: string;
    url?: string;
    now: number;
    thresholdMs: number;
  },
): DrainingSessionState {
  const currentKind = matchDrainingSessionKind(input.title, input.url);

  if (currentKind) {
    if (isInDrainingRecovery(state)) {
      return startDrainingKind(currentKind, 0, input.thresholdMs);
    }
    if (state.kind !== currentKind) {
      return startDrainingKind(currentKind, 0, input.thresholdMs);
    }
    return state;
  }

  if (isInDrainingRecovery(state)) {
    return state;
  }

  if (wasOverwhelmedSession(state, input.thresholdMs)) {
    return beginRecovery(input.now);
  }

  if (state.kind) {
    return { ...EMPTY_DRAINING_SESSION };
  }

  return state;
}

export function advanceDrainingSession(
  state: DrainingSessionState,
  input: {
    title?: string;
    url?: string;
    elapsedMs: number;
    now: number;
    thresholdMs: number;
    recoveryThanksThresholdMs: number;
  },
): DrainingSessionState {
  const elapsedMs = Math.max(0, input.elapsedMs);
  const currentKind = matchDrainingSessionKind(input.title, input.url);

  if (isInDrainingRecovery(state)) {
    if (currentKind) {
      return startDrainingKind(currentKind, elapsedMs, input.thresholdMs);
    }
    if (elapsedMs > 0) {
      return advanceRecoveryAway(state, elapsedMs, input.recoveryThanksThresholdMs);
    }
    return state;
  }

  if (!currentKind || elapsedMs === 0) {
    if (!currentKind) {
      return state;
    }
    return state.kind === currentKind ? state : startDrainingKind(currentKind, 0, input.thresholdMs);
  }

  if (state.kind !== currentKind) {
    return startDrainingKind(currentKind, elapsedMs, input.thresholdMs);
  }

  const accumulatedMs = state.accumulatedMs + elapsedMs;
  const next: DrainingSessionState = {
    ...state,
    kind: currentKind,
    accumulatedMs,
  };
  return maybeQueueOverwhelmedNudge(next, input.thresholdMs);
}

function maybeQueueOverwhelmedNudge(
  state: DrainingSessionState,
  thresholdMs: number,
): DrainingSessionState {
  if (!state.kind || state.accumulatedMs < thresholdMs) {
    return state;
  }
  if (state.pendingNudgeKind || state.lastNudgedAt !== null) {
    return state;
  }
  return {
    ...state,
    pendingNudgeKind: state.kind,
  };
}

export function acknowledgeDrainingNudge(
  state: DrainingSessionState,
  now: number,
): DrainingSessionState {
  return {
    ...state,
    pendingNudgeKind: null,
    lastNudgedAt: now,
  };
}

export function acknowledgeRecoveryEasing(
  state: DrainingSessionState,
  now: number,
): DrainingSessionState {
  return {
    ...state,
    pendingRecoveryNudge: null,
    recoveryEasingAckedAt: now,
  };
}

export function completeDrainingRecovery(
  _state: DrainingSessionState,
): DrainingSessionState {
  return { ...EMPTY_DRAINING_SESSION };
}

export async function readDrainingSessionState(): Promise<DrainingSessionState> {
  const result = await browser.storage.local.get([STORAGE_KEYS.drainingSession]);
  const raw = result[STORAGE_KEYS.drainingSession];
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_DRAINING_SESSION };
  }
  const record = raw as Partial<DrainingSessionState>;
  const kind =
    record.kind === 'social' || record.kind === 'news' ? record.kind : null;
  const pendingRecoveryNudge =
    record.pendingRecoveryNudge === 'easing' || record.pendingRecoveryNudge === 'thanks'
      ? record.pendingRecoveryNudge
      : null;
  return {
    kind,
    accumulatedMs:
      typeof record.accumulatedMs === 'number' && record.accumulatedMs >= 0
        ? record.accumulatedMs
        : 0,
    lastNudgedAt:
      typeof record.lastNudgedAt === 'number' ? record.lastNudgedAt : null,
    pendingNudgeKind:
      record.pendingNudgeKind === 'social' || record.pendingNudgeKind === 'news'
        ? record.pendingNudgeKind
        : null,
    recoveryStartedAt:
      typeof record.recoveryStartedAt === 'number' ? record.recoveryStartedAt : null,
    recoveryAwayMs:
      typeof record.recoveryAwayMs === 'number' && record.recoveryAwayMs >= 0
        ? record.recoveryAwayMs
        : 0,
    pendingRecoveryNudge,
    recoveryEasingAckedAt:
      typeof record.recoveryEasingAckedAt === 'number'
        ? record.recoveryEasingAckedAt
        : null,
  };
}

export async function writeDrainingSessionState(
  state: DrainingSessionState,
): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEYS.drainingSession]: state,
  });
}

export async function syncDrainingSessionToPage(input: {
  title?: string;
  url?: string;
  now: number;
  settings: ExtensionSettings;
}): Promise<DrainingSessionState> {
  const current = await readDrainingSessionState();
  const next = applyDrainingSessionPageChange(current, {
    title: input.title,
    url: input.url,
    now: input.now,
    thresholdMs: drainingSessionThresholdMs(input.settings),
  });
  if (next !== current) {
    await writeDrainingSessionState(next);
  }
  return next;
}

export async function recordDrainingSessionElapsed(input: {
  title?: string;
  url?: string;
  elapsedMs: number;
  now: number;
  settings: ExtensionSettings;
}): Promise<DrainingSessionState> {
  const current = await readDrainingSessionState();
  const next = advanceDrainingSession(current, {
    title: input.title,
    url: input.url,
    elapsedMs: input.elapsedMs,
    now: input.now,
    thresholdMs: drainingSessionThresholdMs(input.settings),
    recoveryThanksThresholdMs: recoveryThanksThresholdMs(input.settings),
  });
  await writeDrainingSessionState(next);
  return next;
}
