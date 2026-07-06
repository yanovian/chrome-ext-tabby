import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCareActionPageUrl } from '../utils/care-action';
import { createInitialCat } from '../utils/cat-sim';
import { handleCareAction, persistPresentation } from '../utils/orchestrator';
import { pageOverlayKey } from '../utils/page-overlay';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../utils/types';

const NOW = Date.parse('2026-07-05T14:00:00.000Z');
const PAGE_URL = 'https://example.com/article';

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
  appendObservation: async () => ({ category: null, topic: null }),
}));

describe('resolveCareActionPageUrl', () => {
  it('prefers the page URL sent by the content script', () => {
    expect(
      resolveCareActionPageUrl(
        PAGE_URL,
        'https://other.example/tab',
        'https://stale.example/tab',
      ),
    ).toBe(PAGE_URL);
  });

  it('falls back to the sender tab when the message omits a URL', () => {
    expect(
      resolveCareActionPageUrl(
        undefined,
        PAGE_URL,
        'https://stale.example/tab',
      ),
    ).toBe(PAGE_URL);
  });

  it('uses the active snapshot only as a last resort', () => {
    expect(
      resolveCareActionPageUrl(undefined, undefined, PAGE_URL),
    ).toBe(PAGE_URL);
  });
});

describe('handleCareAction dismiss', () => {
  it('records the current page as hidden when the user chooses Hide Tabby', async () => {
    await browser.storage.local.set({ [STORAGE_KEYS.hiddenPageKeys]: [] });

    const presentation = await handleCareAction('dismiss', NOW, {
      url: PAGE_URL,
    });

    const hidden = (await browser.storage.local.get([STORAGE_KEYS.hiddenPageKeys]))[
      STORAGE_KEYS.hiddenPageKeys
    ] as string[];

    expect(hidden).toContain(pageOverlayKey(PAGE_URL));
    expect(presentation.lastCareAction).toBe('dismiss');
    expect(presentation.speech).toMatch(/hide|here|soon/i);
  });

  it('does not hide anything when dismiss has no page URL', async () => {
    await browser.storage.local.set({ [STORAGE_KEYS.hiddenPageKeys]: [] });

    await handleCareAction('dismiss', NOW, { url: undefined });

    const hidden = (await browser.storage.local.get([STORAGE_KEYS.hiddenPageKeys]))[
      STORAGE_KEYS.hiddenPageKeys
    ] as string[];

    expect(hidden).toEqual([]);
  });
});

describe('handleCareAction during peek', () => {
  it('pet ends peek and shows a happy mood from vitals', async () => {
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      devForceMood: 'peek',
    };
    await persistPresentation({
      mood: 'peek',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: '/animations/adult/peek.json',
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      canPet: true,
      canTreat: false,
      canPlay: true,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: null,
      companionVisible: true,
      ambientActivity: 'peeking',
      ambientPeekUntil: NOW + 60_000,
    });

    const presentation = await handleCareAction('pet', NOW, { url: PAGE_URL });

    expect(presentation.mood).toBe('happy');
    expect(presentation.ambientActivity).toBeNull();
    expect(presentation.sprite).toContain('happy.json');
    expect(presentation.speech).toBeTruthy();
  });
});
