import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialCat } from '../utils/cat-sim';
import {
  persistPresentation,
  presentOnActiveTab,
  recordPageVisit,
  runMinuteTick,
} from '../utils/orchestrator';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../utils/types';

const NOW = Date.parse('2026-07-05T14:00:00.000Z');

const store: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  store[STORAGE_KEYS.settings] = DEFAULT_SETTINGS;
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
      },
    },
  });
});

vi.mock('../utils/db', () => ({
  getCatState: async () => createInitialCat(NOW),
  saveCatState: async () => {},
  getMemories: async () => [],
  pickRecallCandidate: async () => null,
  recallMemory: async () => {},
  appendObservation: async () => ({
    category: 'nourishing',
    topic: 'TypeScript',
  }),
}));

describe('recordPageVisit', () => {
  it('updates cat state without recomputing presentation', async () => {
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: '/sprites/adult/content.png',
      speech: 'Cached line',
      triggerKind: null,
      overlayHidden: false,
      canPet: true,
      canTreat: false,
      canPlay: false,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: null,
    });

    await recordPageVisit({
      title: 'Docs',
      url: 'https://example.com/docs',
      hostname: 'example.com',
      activeDurationMs: 60_000,
      now: NOW,
    });

    const cached = (await browser.storage.local.get([STORAGE_KEYS.presentation]))[
      STORAGE_KEYS.presentation
    ] as { speech?: string };

    expect(cached.speech).toBe('Cached line');
  });

  it('skips duplicate visits to the same page', async () => {
    const first = await recordPageVisit({
      title: 'Docs',
      url: 'https://example.com/docs',
      hostname: 'example.com',
      activeDurationMs: 60_000,
      now: NOW,
    });

    const second = await recordPageVisit({
      title: 'Docs',
      url: 'https://example.com/docs',
      hostname: 'example.com',
      activeDurationMs: 60_000,
      now: NOW + 1000,
    });

    expect(first.counted).toBe(true);
    expect(second.counted).toBe(false);
  });
});

describe('runMinuteTick', () => {
  it('updates vitals without recomputing presentation when present is false', async () => {
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: '/sprites/adult/content.png',
      speech: 'Still cached',
      triggerKind: null,
      overlayHidden: false,
      canPet: true,
      canTreat: false,
      canPlay: false,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: null,
    });

    await runMinuteTick(NOW, { present: false });

    const cached = (await browser.storage.local.get([STORAGE_KEYS.presentation]))[
      STORAGE_KEYS.presentation
    ] as { speech?: string };

    expect(cached.speech).toBe('Still cached');
  });
});

describe('presentOnActiveTab', () => {
  it('recomputes presentation for the active page', async () => {
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: '/sprites/adult/content.png',
      speech: 'Old line',
      triggerKind: null,
      overlayHidden: false,
      canPet: true,
      canTreat: false,
      canPlay: false,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: null,
    });

    const result = await presentOnActiveTab(NOW, {
      title: 'News',
      url: 'https://example.com/news',
    });

    expect(result.lastPresentation).not.toBeNull();
    expect(result.lastPresentation?.speech).not.toBe('Old line');
  });
});
