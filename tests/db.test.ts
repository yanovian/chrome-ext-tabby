import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { daysTogether } from '../utils/cat-sim';
import { DEFAULT_SETTINGS, STORAGE_KEYS, type CatState } from '../utils/types';

const NOW = Date.parse('2026-07-05T14:00:00.000Z');
const THREE_WEEKS_AGO = NOW - 21 * 24 * 60 * 60 * 1000;

const store: Record<string, unknown> = {};

function stubBrowserStorage(): void {
  vi.stubGlobal('browser', {
    storage: {
      local: {
        get: async (keys: string[]) => Object.fromEntries(keys.map((key) => [key, store[key]])),
        set: async (items: Record<string, unknown>) => {
          Object.assign(store, items);
        },
      },
    },
  });
}

beforeEach(() => {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  store[STORAGE_KEYS.settings] = DEFAULT_SETTINGS;
  stubBrowserStorage();
  // fake-indexeddb persists across tests by default (module-level singleton) — start each
  // test from a genuinely empty database, same as a fresh install.
  vi.stubGlobal('indexedDB', new IDBFactory());
  // db.ts caches its database connection in a module-level variable, so a stale import would
  // still see the previous test's (now-replaced) indexedDB instance — force a fresh module
  // per test, or "the record is missing" below wouldn't actually take effect.
  vi.resetModules();
});

describe('getCatState', () => {
  it('creates a brand-new cat (adoptedAt = now) on a genuine first launch', async () => {
    const { getCatState } = await import('../utils/db');
    const cat = await getCatState(NOW);
    expect(cat.adoptedAt).toBe(NOW);
  });

  it('restores her age from the chrome.storage.local backup if the IndexedDB record is ever lost', async () => {
    // Regression: a real user saw the day-1 "First day together" message three weeks in — the
    // IndexedDB cat record went missing somehow, and getCatState's old "not found" fallback
    // just started her over at day one. saveCatState always mirrors adoptedAt into
    // chrome.storage.local (a separate storage backend) precisely so this can be recovered
    // instead of reset.
    const seedCat: CatState = {
      name: 'Tabby',
      adoptedAt: THREE_WEEKS_AGO,
      stage: 'adult',
      vitals: { hunger: 35, happiness: 70, stress: 15, energy: 80 },
      lastCareAt: THREE_WEEKS_AGO,
      satiatedUntil: 0,
      happyUntil: 0,
      lastSeenAt: THREE_WEEKS_AGO,
      lastSpeechAt: 0,
      nudgesToday: 0,
      nudgesDayKey: '2026-06-14',
      mischiefCooldownAt: 0,
      lastAmbientAt: 0,
      ambientsToday: 0,
      ambientsDayKey: '2026-06-14',
    };

    {
      const { saveCatState } = await import('../utils/db');
      await saveCatState(seedCat);
    }

    // Simulate the IndexedDB record disappearing (browser storage clear, corruption, a fresh
    // profile, etc.) while the chrome.storage.local backup survives — a fresh module instance
    // against a fresh, empty database, same as db.ts would see after an actual restart.
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.resetModules();

    const { getCatState } = await import('../utils/db');
    const restored = await getCatState(NOW);

    expect(restored.adoptedAt).toBe(THREE_WEEKS_AGO);
    expect(daysTogether(restored.adoptedAt, NOW)).toBe(21);
  });

  it('keeps mirroring the backup forward as she ages, not just on first save', async () => {
    {
      const { getCatState, saveCatState } = await import('../utils/db');
      const first = await getCatState(THREE_WEEKS_AGO);
      await saveCatState({ ...first, lastCareAt: NOW });
    }

    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.resetModules();

    const { getCatState } = await import('../utils/db');
    const restored = await getCatState(NOW);

    expect(restored.adoptedAt).toBe(THREE_WEEKS_AGO);
  });
});
