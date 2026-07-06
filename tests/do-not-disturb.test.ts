import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDoNotDisturbStatus,
  careActionToDoNotDisturb,
  clearDoNotDisturb,
  doNotDisturbDurationToCareAction,
  formatDoNotDisturbSummary,
  getDoNotDisturbStatus,
  isDoNotDisturbActive,
  resolveDoNotDisturbUntil,
  setDoNotDisturb,
} from '../utils/do-not-disturb';
import { STORAGE_KEYS } from '../utils/types';

const NOW = Date.parse('2026-07-06T14:00:00.000Z');

const store: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  vi.stubGlobal('browser', {
    storage: {
      local: {
        get: async (keys: string | string[] | Record<string, unknown>) => {
          if (typeof keys === 'string') {
            return { [keys]: store[keys] };
          }
          if (Array.isArray(keys)) {
            return Object.fromEntries(keys.map((key) => [key, store[key]]));
          }
          return { ...store };
        },
        set: async (items: Record<string, unknown>) => {
          Object.assign(store, items);
        },
        remove: async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys];
          for (const key of list) {
            delete store[key];
          }
        },
      },
    },
  });
});

describe('resolveDoNotDisturbUntil', () => {
  it('adds 30 minutes for a short break', () => {
    expect(resolveDoNotDisturbUntil('30m', NOW)).toBe(NOW + 30 * 60_000);
  });

  it('ends today at local midnight boundary', () => {
    const until = resolveDoNotDisturbUntil('today', NOW);
    const end = new Date(until);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });
});

describe('isDoNotDisturbActive', () => {
  it('is active before the until timestamp', () => {
    expect(isDoNotDisturbActive({ until: NOW + 60_000, duration: '30m' }, NOW)).toBe(true);
  });

  it('is inactive after the until timestamp', () => {
    expect(isDoNotDisturbActive({ until: NOW - 1, duration: '30m' }, NOW)).toBe(false);
  });
});

describe('careActionToDoNotDisturb', () => {
  it('maps care actions to durations', () => {
    expect(careActionToDoNotDisturb('dnd_30')).toBe('30m');
    expect(careActionToDoNotDisturb('dnd_today')).toBe('today');
    expect(careActionToDoNotDisturb('pet')).toBeNull();
  });
});

describe('doNotDisturbDurationToCareAction', () => {
  it('maps durations to care actions', () => {
    expect(doNotDisturbDurationToCareAction('30m')).toBe('dnd_30');
    expect(doNotDisturbDurationToCareAction('60m')).toBe('dnd_60');
    expect(doNotDisturbDurationToCareAction('today')).toBe('dnd_today');
  });
});

describe('formatDoNotDisturbSummary', () => {
  it('includes duration, remaining minutes, and end time', () => {
    const summary = formatDoNotDisturbSummary({
      until: NOW + 28 * 60_000,
      duration: '30m',
      now: NOW,
    });

    expect(summary).toContain('30 minutes');
    expect(summary).toContain('28 min left');
    expect(summary).toContain('until');
  });
});

describe('getDoNotDisturbStatus', () => {
  it('returns inactive when do not disturb is not set', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const status = await getDoNotDisturbStatus();

    expect(status.active).toBe(false);
    expect(status.summary).toBeNull();

    vi.useRealTimers();
  });

  it('returns a summary while do not disturb is active', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    await setDoNotDisturb('60m', NOW);

    const status = await getDoNotDisturbStatus();

    expect(status.active).toBe(true);
    expect(status.duration).toBe('60m');
    expect(status.summary).toContain('1 hour');

    vi.useRealTimers();
  });
});

describe('clearDoNotDisturb', () => {
  it('removes stored do not disturb values', async () => {
    await setDoNotDisturb('30m', NOW);
    await clearDoNotDisturb();

    expect(store[STORAGE_KEYS.doNotDisturbUntil]).toBeUndefined();
    expect(store[STORAGE_KEYS.doNotDisturbDuration]).toBeUndefined();
  });
});

describe('buildDoNotDisturbStatus', () => {
  it('returns inactive when until has passed', () => {
    const status = buildDoNotDisturbStatus({ until: NOW - 1, duration: '30m' }, NOW);
    expect(status.active).toBe(false);
  });
});
