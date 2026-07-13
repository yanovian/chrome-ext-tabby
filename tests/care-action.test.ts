import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCareActionPageUrl } from '../utils/care-action';
import { createInitialCat } from '../utils/cat-sim';
import {
  completeFeedingIfDue,
  completePlayingIfDue,
  handleCareAction,
  persistPresentation,
} from '../utils/orchestrator';
import { pickFeedingDurationMs } from '../utils/feeding-moment';
import { pickPlayingDurationMs } from '../utils/play-moment';
import { pageOverlayKey } from '../utils/page-overlay';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../utils/types';

const NOW = Date.parse('2026-07-05T14:00:00.000Z');
const PAGE_URL = 'https://example.com/article';

const store: Record<string, unknown> = {};
let catForTests = createInitialCat(NOW);

beforeEach(() => {
  catForTests = createInitialCat(NOW);
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
    alarms: {
      clear: async () => {},
      create: async () => {},
    },
  });
});

vi.mock('../utils/db', () => ({
  getCatState: async () => catForTests,
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
  it('reveal ends peek and keeps the real mood on screen', async () => {
    await persistPresentation({
      mood: 'peek',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: '/gif/adult/peek.gif',
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      canPet: false,
      canTreat: false,
      canPlay: false,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: null,
      companionVisible: true,
      ambientActivity: 'peeking',
      ambientPeekUntil: NOW + 60_000,
      peekEdge: 'bottom',
      peekInset: 16,
      peekCorner: 'left',
      peekRestoreAmbientActivity: 'grooming',
      peekRestoreAmbientUntil: NOW + 120_000,
      stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await handleCareAction('reveal', NOW, { url: PAGE_URL });

    expect(presentation.mood).not.toBe('peek');
    expect(presentation.ambientActivity).toBe('grooming');
    expect(presentation.peekEdge).toBeNull();
    expect(presentation.companionVisible).toBe(true);
    expect(presentation.stayVisibleUntil).toBeGreaterThan(NOW);
  });

  it('reveal from dev peek preview restores auto mood', async () => {
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      devForceMood: 'peek',
    };
    await persistPresentation({
      mood: 'peek',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: '/gif/adult/peek.gif',
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      canPet: false,
      canTreat: false,
      canPlay: false,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: null,
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
      peekEdge: 'right',
      peekInset: 20,
      peekCorner: 'left',
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
  stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await handleCareAction('reveal', NOW, { url: PAGE_URL });

    expect(presentation.mood).not.toBe('peek');
    const settingsAfter = store[STORAGE_KEYS.settings] as typeof DEFAULT_SETTINGS;
    expect(settingsAfter.devForceMood).toBe('auto');
    // Regression: reveal's saveSettings() call was missing the isDevBuild
    // flag, so mergeSettings() silently forced devModeEnabled back to
    // false. That locked the whole dev menu out right after revealing a
    // dev-forced peek, with no error and no visible cause.
    expect(settingsAfter.devModeEnabled).toBe(true);
  });
});

describe('handleCareAction treat while hungry', () => {
  beforeEach(() => {
    catForTests = {
      ...createInitialCat(NOW),
      vitals: {
        ...createInitialCat(NOW).vitals,
        hunger: 90,
        happiness: 40,
        stress: 30,
        energy: 60,
      },
    };
  });

  it('starts a bowl-eating moment with munching speech', async () => {
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
    };
    await persistPresentation({
      mood: 'starving',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/eat.gif',
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      canPet: true,
      canTreat: true,
      canPlay: true,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: null,
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
  peekRestoreAmbientActivity: null,
  peekRestoreAmbientUntil: null,
  stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await handleCareAction('treat', NOW, { url: PAGE_URL });

    expect(presentation.sprite).toContain('feeding.gif');
    expect(presentation.lastCareAction).toBe('feed');
    expect(presentation.eatingUntil).toBe(NOW + pickFeedingDurationMs(DEFAULT_SETTINGS, NOW));
    expect(presentation.speech).toMatch(/yum|nom|munch|hmm|mmm/i);
    expect(presentation.triggerKind).toBe('happy');
    expect(presentation.canTreat).toBe(false);
  });

  it('thanks the user after the eating moment ends', async () => {
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
    };
    const eatingUntil = NOW + pickFeedingDurationMs(DEFAULT_SETTINGS, NOW);
    await persistPresentation({
      mood: 'starving',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/feeding.gif',
      speech: '[hmm] yummy…',
      triggerKind: 'happy',
      overlayHidden: false,
      canPet: true,
      canTreat: false,
      canPlay: true,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: 'feed',
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
  peekRestoreAmbientActivity: null,
  peekRestoreAmbientUntil: null,
  stayVisibleUntil: null,
      eatingUntil,
      playingUntil: null,
    });

    const completed = await completeFeedingIfDue(eatingUntil);

    expect(completed?.mood).toBe('happy');
    expect(completed?.eatingUntil).toBeNull();
    expect(completed?.lastCareAction).toBeNull();
    expect(completed?.sprite).toContain('happy.gif');
    expect(completed?.speech).toMatch(/thank|human|delici|best|love|amazing|saved/i);
  });

  it('stays full and happy after feeding even when hunger vitals were high', async () => {
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
    };
    await persistPresentation({
      mood: 'starving',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/eat.gif',
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      canPet: true,
      canTreat: true,
      canPlay: true,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: null,
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
  peekRestoreAmbientActivity: null,
  peekRestoreAmbientUntil: null,
  stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await handleCareAction('treat', NOW, { url: PAGE_URL });

    expect(presentation.mood).not.toBe('hungry');
    expect(presentation.mood).not.toBe('starving');
    expect(presentation.canTreat).toBe(false);
  });
});

describe('handleCareAction ask while hungry', () => {
  beforeEach(() => {
    catForTests = {
      ...createInitialCat(NOW),
      vitals: {
        ...createInitialCat(NOW).vitals,
        hunger: 20,
        happiness: 70,
        stress: 10,
        energy: 60,
      },
    };
  });

  it('keeps a starving preview mood until Tabby is fed', async () => {
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      devForceMood: 'starving',
    };
    await persistPresentation({
      mood: 'starving',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/eat.gif',
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      canPet: true,
      canTreat: true,
      canPlay: true,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: null,
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
  peekRestoreAmbientActivity: null,
  peekRestoreAmbientUntil: null,
  stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await handleCareAction('ask', NOW, { url: PAGE_URL });

    expect(presentation.mood).toBe('starving');
    expect(presentation.sprite).toContain('eat.gif');
    expect(presentation.speech).toMatch(/hungry|feed|tummy|starv|mew/i);
  });
});

describe('handleCareAction ask while content', () => {
  it('shows a happy mood after a what’s up check-in', async () => {
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/idle.gif',
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
      ambientActivity: null,
      ambientPeekUntil: null,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
  peekRestoreAmbientActivity: null,
  peekRestoreAmbientUntil: null,
  stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await handleCareAction('ask', NOW, { url: PAGE_URL });

    expect(presentation.mood).toBe('happy');
    expect(presentation.sprite).toContain('happy.gif');
  });
});

describe('handleCareAction pet while hungry', () => {
  beforeEach(() => {
    catForTests = {
      ...createInitialCat(NOW),
      vitals: {
        ...createInitialCat(NOW).vitals,
        hunger: 90,
        happiness: 40,
        stress: 30,
        energy: 60,
      },
    };
  });

  it('snaps back with censored frustration and stays starving', async () => {
    await persistPresentation({
      mood: 'starving',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/eat.gif',
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      canPet: true,
      canTreat: true,
      canPlay: true,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: null,
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
  peekRestoreAmbientActivity: null,
  peekRestoreAmbientUntil: null,
  stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await handleCareAction('pet', NOW, { url: PAGE_URL });

    expect(presentation.mood).toBe('starving');
    expect(presentation.sprite).toContain('eat.gif');
    expect(presentation.speech).toMatch(/f\*{3}|d\*{3}|s\*{2,}/i);
    expect(presentation.speech).toMatch(/feed|hungry|starv|food|bowl|tummy/i);
    expect(presentation.speech).not.toMatch(/purrr|that was nice|purr motor/i);
  });
});

describe('handleCareAction play', () => {
  beforeEach(() => {
    catForTests = {
      ...createInitialCat(NOW),
      vitals: {
        ...createInitialCat(NOW).vitals,
        hunger: 35,
        happiness: 45,
        stress: 20,
        energy: 55,
      },
    };
  });

  it('starts a wild play moment with funny speech', async () => {
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
    };
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/idle.gif',
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
      ambientActivity: null,
      ambientPeekUntil: null,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
  peekRestoreAmbientActivity: null,
  peekRestoreAmbientUntil: null,
  stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await handleCareAction('play', NOW, { url: PAGE_URL });

    expect(presentation.sprite).toContain('playing.gif');
    expect(presentation.lastCareAction).toBe('play');
    expect(presentation.playingUntil).toBe(NOW + pickPlayingDurationMs(DEFAULT_SETTINGS, NOW));
    expect(presentation.speech).toMatch(/whee|zoom|pounce|bounce|chaos|wild|mew|mrrp/i);
    expect(presentation.triggerKind).toBe('happy');
    expect(presentation.canPlay).toBe(false);
  });

  it('ends play with a happy thank-you line', async () => {
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
    };
    const playingUntil = NOW + pickPlayingDurationMs(DEFAULT_SETTINGS, NOW);
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/playing.gif',
      speech: 'WHEEE! Pounce pounce pounce!',
      triggerKind: 'happy',
      overlayHidden: false,
      canPet: true,
      canTreat: false,
      canPlay: false,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: 'play',
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
  peekRestoreAmbientActivity: null,
  peekRestoreAmbientUntil: null,
  stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil,
    });

    const completed = await completePlayingIfDue(playingUntil);

    expect(completed?.mood).toBe('happy');
    expect(completed?.playingUntil).toBeNull();
    expect(completed?.lastCareAction).toBeNull();
    expect(completed?.sprite).toContain('happy.gif');
    expect(completed?.speech).toMatch(/thank|fun|play|happy|paws|zoom|amazing|best/i);
  });
});
