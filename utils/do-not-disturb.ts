import { t } from './i18n';
import type { DoNotDisturbDuration, DoNotDisturbStatus } from './types';
import { STORAGE_KEYS } from './types';

export interface DoNotDisturbState {
  until: number | null;
  duration?: DoNotDisturbDuration | null;
}

export function resolveDoNotDisturbUntil(
  duration: DoNotDisturbDuration,
  now: number,
): number {
  switch (duration) {
    case '30m':
      return now + 30 * 60_000;
    case '60m':
      return now + 60 * 60_000;
    case 'today': {
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return end.getTime();
    }
  }
}

export function describeDoNotDisturbDuration(duration: DoNotDisturbDuration): string {
  switch (duration) {
    case '30m':
      return t('dnd.minutes30');
    case '60m':
      return t('dnd.hour1');
    case 'today':
      return t('dnd.today');
  }
}

export function formatDoNotDisturbSummary(input: {
  until: number;
  duration: DoNotDisturbDuration | null;
  now: number;
}): string {
  const remainingMin = Math.max(1, Math.ceil((input.until - input.now) / 60_000));
  const untilTime = new Date(input.until).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const durationLabel = input.duration
    ? describeDoNotDisturbDuration(input.duration)
    : `${remainingMin} minutes`;

  return t('dnd.summary', {
    duration: durationLabel,
    remaining: remainingMin,
    until: untilTime,
  });
}

export function isDoNotDisturbActive(state: DoNotDisturbState, now: number): boolean {
  return state.until !== null && now < state.until;
}

export function careActionToDoNotDisturb(
  action: string,
): DoNotDisturbDuration | null {
  switch (action) {
    case 'dnd_30':
      return '30m';
    case 'dnd_60':
      return '60m';
    case 'dnd_today':
      return 'today';
    default:
      return null;
  }
}

export function doNotDisturbDurationToCareAction(
  duration: DoNotDisturbDuration,
): 'dnd_30' | 'dnd_60' | 'dnd_today' {
  switch (duration) {
    case '30m':
      return 'dnd_30';
    case '60m':
      return 'dnd_60';
    case 'today':
      return 'dnd_today';
  }
}

export async function readDoNotDisturbState(): Promise<DoNotDisturbState> {
  const result = await browser.storage.local.get([
    STORAGE_KEYS.doNotDisturbUntil,
    STORAGE_KEYS.doNotDisturbDuration,
  ]);
  const until = result[STORAGE_KEYS.doNotDisturbUntil];
  const duration = result[STORAGE_KEYS.doNotDisturbDuration];
  return {
    until: typeof until === 'number' ? until : null,
    duration:
      duration === '30m' || duration === '60m' || duration === 'today'
        ? duration
        : null,
  };
}

export async function setDoNotDisturb(
  duration: DoNotDisturbDuration,
  now: number,
): Promise<DoNotDisturbState> {
  const state = {
    until: resolveDoNotDisturbUntil(duration, now),
    duration,
  };
  await browser.storage.local.set({
    [STORAGE_KEYS.doNotDisturbUntil]: state.until,
    [STORAGE_KEYS.doNotDisturbDuration]: state.duration,
  });
  return state;
}

export async function clearDoNotDisturb(): Promise<void> {
  await browser.storage.local.remove([
    STORAGE_KEYS.doNotDisturbUntil,
    STORAGE_KEYS.doNotDisturbDuration,
  ]);
}

export async function clearExpiredDoNotDisturb(now: number): Promise<DoNotDisturbState> {
  const state = await readDoNotDisturbState();
  if (!isDoNotDisturbActive(state, now)) {
    if (state.until !== null) {
      await clearDoNotDisturb();
    }
    return { until: null, duration: null };
  }
  return state;
}

export function buildDoNotDisturbStatus(
  state: DoNotDisturbState,
  now: number,
): DoNotDisturbStatus {
  if (!isDoNotDisturbActive(state, now) || state.until === null) {
    return {
      active: false,
      until: null,
      duration: null,
      summary: null,
    };
  }

  return {
    active: true,
    until: state.until,
    duration: state.duration ?? null,
    summary: formatDoNotDisturbSummary({
      until: state.until,
      duration: state.duration ?? null,
      now,
    }),
  };
}

export async function getDoNotDisturbStatus(now = Date.now()): Promise<DoNotDisturbStatus> {
  const state = await clearExpiredDoNotDisturb(now);
  return buildDoNotDisturbStatus(state, now);
}
