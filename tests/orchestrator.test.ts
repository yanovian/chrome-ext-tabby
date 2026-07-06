import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialCat } from '../utils/cat-sim';
import {
  cancelDoNotDisturb,
  enableDoNotDisturb,
  getCurrentPresentation,
  persistPresentation,
  presentOnActiveTab,
  recordPageVisit,
  runMinuteTick,
  showOverlayOnPage,
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
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
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
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
    });

    await runMinuteTick(NOW, { present: false });

    const cached = (await browser.storage.local.get([STORAGE_KEYS.presentation]))[
      STORAGE_KEYS.presentation
    ] as { speech?: string };

    expect(cached.speech).toBe('Still cached');
  });
});

describe('getCurrentPresentation', () => {
  it('keeps Tabby hidden while do not disturb is active', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: '/sprites/adult/content.png',
      speech: 'Hello',
      triggerKind: 'hungry',
      overlayHidden: false,
      canPet: true,
      canTreat: false,
      canPlay: false,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: null,
      companionVisible: true,
      ambientActivity: 'sleeping',
      ambientPeekUntil: NOW + 60_000,
    });
    store[STORAGE_KEYS.doNotDisturbUntil] = NOW + 30 * 60_000;

    const presentation = await getCurrentPresentation();

    expect(presentation.companionVisible).toBe(false);
    expect(presentation.ambientActivity).toBeNull();
    expect(presentation.speech).toBeNull();

    vi.useRealTimers();
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
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
    });

    const result = await presentOnActiveTab(NOW, {
      title: 'News',
      url: 'https://example.com/news',
    });

    expect(result.lastPresentation).not.toBeNull();
    expect(result.lastPresentation?.speech).not.toBe('Old line');
  });
});

describe('showOverlayOnPage', () => {
  it('clears do not disturb and shows Tabby immediately', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    store[STORAGE_KEYS.doNotDisturbUntil] = NOW + 30 * 60_000;
    store[STORAGE_KEYS.doNotDisturbDuration] = '30m';
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: '/sprites/adult/content.png',
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      canPet: true,
      canTreat: false,
      canPlay: false,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: null,
      companionVisible: false,
      ambientActivity: null,
      ambientPeekUntil: null,
    });

    const presentation = await showOverlayOnPage(NOW, {
      title: 'Example',
      url: 'https://example.com/page',
    });

    expect(store[STORAGE_KEYS.doNotDisturbUntil]).toBeUndefined();
    expect(presentation.companionVisible).toBe(true);
    expect(presentation.speech).toBeTruthy();

    vi.useRealTimers();
  });
});

describe('enableDoNotDisturb', () => {
  it('hides Tabby and stores do not disturb', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const presentation = await enableDoNotDisturb('30m', NOW);

    expect(store[STORAGE_KEYS.doNotDisturbUntil]).toBe(NOW + 30 * 60_000);
    expect(store[STORAGE_KEYS.doNotDisturbDuration]).toBe('30m');
    expect(presentation.companionVisible).toBe(false);

    vi.useRealTimers();
  });
});

describe('cancelDoNotDisturb', () => {
  it('clears do not disturb without forcing Tabby visible', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    store[STORAGE_KEYS.doNotDisturbUntil] = NOW + 30 * 60_000;
    store[STORAGE_KEYS.doNotDisturbDuration] = '30m';
    store[STORAGE_KEYS.introCompleted] = true;
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: '/sprites/adult/content.png',
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      canPet: true,
      canTreat: false,
      canPlay: false,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: null,
      companionVisible: false,
      ambientActivity: null,
      ambientPeekUntil: null,
    });

    const presentation = await cancelDoNotDisturb(NOW);

    expect(store[STORAGE_KEYS.doNotDisturbUntil]).toBeUndefined();
    expect(presentation.companionVisible).toBe(false);

    vi.useRealTimers();
  });
});
