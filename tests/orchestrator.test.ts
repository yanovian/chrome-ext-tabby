import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialCat } from '../utils/cat-sim';
import {
  cancelDoNotDisturb,
  clearCompanionSpeech,
  devForceCompanionHide,
  devForceCompanionShow,
  enableDoNotDisturb,
  getCurrentPresentation,
  persistPresentation,
  presentOnActiveTab,
  recordPageVisit,
  runMinuteTick,
  restartIntroSession,
  settleAfterIntro,
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
      sprite: 'animations/adult/idle.json',
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
      eatingUntil: null,
      playingUntil: null,
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
      sprite: 'animations/adult/idle.json',
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
      eatingUntil: null,
      playingUntil: null,
    });

    await runMinuteTick(NOW, { present: false });

    const cached = (await browser.storage.local.get([STORAGE_KEYS.presentation]))[
      STORAGE_KEYS.presentation
    ] as { speech?: string };

    expect(cached.speech).toBe('Still cached');
  });

  it('force tick speaks and keeps Tabby visible for dev testing', async () => {
    store[STORAGE_KEYS.settings] = { ...DEFAULT_SETTINGS, devModeEnabled: true };
    store[STORAGE_KEYS.introCompleted] = true;
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'animations/adult/idle.json',
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
      eatingUntil: null,
      playingUntil: null,
    });

    const state = await runMinuteTick(NOW, { forceTick: true });

    expect(state.lastPresentation?.companionVisible).toBe(true);
    expect(state.lastPresentation?.speech).toBeTruthy();
    expect(state.lastPresentation?.triggerKind).toBeTruthy();
  });
});

describe('getCurrentPresentation', () => {
  it('shows Tabby while the intro tour is pending even if cache hid her', async () => {
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'animations/adult/idle.json',
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
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await getCurrentPresentation();

    expect(presentation.companionVisible).toBe(true);
  });

  it('keeps Tabby hidden while do not disturb is active', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'animations/adult/idle.json',
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
      eatingUntil: null,
      playingUntil: null,
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
      sprite: 'animations/adult/idle.json',
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
      eatingUntil: null,
      playingUntil: null,
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
      sprite: 'animations/adult/idle.json',
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
      eatingUntil: null,
      playingUntil: null,
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
      sprite: 'animations/adult/idle.json',
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
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await cancelDoNotDisturb(NOW);

    expect(store[STORAGE_KEYS.doNotDisturbUntil]).toBeUndefined();
    expect(presentation.companionVisible).toBe(false);

    vi.useRealTimers();
  });
});

describe('devForceCompanionShow', () => {
  beforeEach(() => {
    store[STORAGE_KEYS.settings] = { ...DEFAULT_SETTINGS, devModeEnabled: true };
    store[STORAGE_KEYS.introCompleted] = true;
  });

  it('forces Tabby visible using the dev mood override', async () => {
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      devForceMood: 'curious',
    };

    const presentation = await devForceCompanionShow(NOW);

    expect(presentation.companionVisible).toBe(true);
    expect(presentation.mood).toBe('curious');
    expect(presentation.speech).toBeNull();
    expect(presentation.ambientActivity).toBeNull();
  });

  it('uses peek rise and duck assets when peek is selected', async () => {
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      devForceMood: 'peek',
    };

    const presentation = await devForceCompanionShow(NOW);

    expect(presentation.mood).toBe('peek');
    expect(presentation.sprite).toContain('peek.json');
    expect(presentation.ambientActivity).toBeNull();
  });
});

describe('clearCompanionSpeech', () => {
  it('clears cached speech from presentation', async () => {
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'animations/adult/idle.json',
      speech: 'Hello there',
      triggerKind: 'hungry',
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
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await clearCompanionSpeech(NOW);

    expect(presentation.speech).toBeNull();
    expect(presentation.triggerKind).toBeNull();
  });
});

describe('restartIntroSession', () => {
  it('clears intro completion and shows Tabby for the tour', async () => {
    store[STORAGE_KEYS.introCompleted] = true;
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'animations/adult/idle.json',
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
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await restartIntroSession(NOW);

    expect(store[STORAGE_KEYS.introCompleted]).toBeUndefined();
    expect(presentation.companionVisible).toBe(true);
  });
});

describe('settleAfterIntro', () => {
  it('clears speech and keeps Tabby visible after intro ends', async () => {
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'animations/adult/idle.json',
      speech: 'a snoopy - a snoopy - a s',
      triggerKind: 'hungry',
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
      eatingUntil: null,
      playingUntil: null,
    });
    store[STORAGE_KEYS.introCompleted] = true;

    const presentation = await settleAfterIntro(NOW);

    expect(presentation.speech).toBeNull();
    expect(presentation.triggerKind).toBeNull();
    expect(presentation.companionVisible).toBe(true);
  });

  it('shows Tabby even when cached presentation had her hidden', async () => {
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'animations/adult/idle.json',
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
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await settleAfterIntro(NOW);

    expect(presentation.companionVisible).toBe(true);
    expect(presentation.speech).toBeNull();
  });
});

describe('devForceCompanionHide', () => {
  beforeEach(() => {
    store[STORAGE_KEYS.settings] = { ...DEFAULT_SETTINGS, devModeEnabled: true };
  });

  it('hides Tabby immediately for testing', async () => {
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'animations/adult/idle.json',
      speech: 'Hello',
      triggerKind: 'dev',
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
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await devForceCompanionHide(NOW);

    expect(presentation.companionVisible).toBe(false);
    expect(presentation.speech).toBeNull();
    expect(presentation.ambientActivity).toBeNull();
  });

  it('keeps peek mood while hiding so duck-out can play', async () => {
    await persistPresentation({
      mood: 'peek',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: '/animations/adult/peek.json',
      speech: 'Peek!',
      triggerKind: 'curious',
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
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await devForceCompanionHide(NOW);

    expect(presentation.companionVisible).toBe(false);
    expect(presentation.mood).toBe('peek');
  });
});
