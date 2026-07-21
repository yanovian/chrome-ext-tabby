import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialCat } from '../utils/cat-sim';
import {
  clearCompanionSpeech,
  devForceCompanionHide,
  devForceCompanionShow,
  getCurrentPresentation,
  handleCareAction,
  persistPresentation,
  presentOnActiveTab,
  syncDevTemperControls,
  restartIntroSession,
  settleAfterIntro,
  showOverlayOnPage,
} from '../utils/cat';
import {
  cancelDoNotDisturb,
  enableDoNotDisturb,
  recordPageVisit,
  runMinuteTick,
} from '../utils/orchestrator';
import { DEFAULT_SETTINGS, STORAGE_KEYS, type CatPresentation } from '../utils/types';

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
      sprite: 'gif/adult/idle.gif',
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
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
      sprite: 'gif/adult/idle.gif',
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
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
      sprite: 'gif/adult/idle.gif',
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
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
      sprite: 'gif/adult/idle.gif',
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
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
      sprite: 'gif/adult/idle.gif',
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
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

  it('clears an expired hidden rest without showing Tabby', async () => {
    // Pinned to quiet hours: this now delegates to the full evaluateAndPresent recompute
    // (like every other expiry case here) instead of a bespoke "just go idle" branch, and
    // that recompute only settles fully idle rather than rolling straight into a fresh
    // ambient moment when it's not daytime — so time must be pinned for a deterministic
    // expectation instead of relying on whatever the local machine's wall-clock happens to be.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    store[STORAGE_KEYS.settings] = { ...DEFAULT_SETTINGS, quietHoursStart: 0, quietHoursEnd: 24 };
    await persistPresentation({
      mood: 'sleepy',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/sleep.gif',
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
      ambientActivity: 'sleeping',
      ambientPeekUntil: NOW - 1,
      peekEdge: 'left',
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil: null,
    });
    store[STORAGE_KEYS.introCompleted] = true;

    const presentation = await getCurrentPresentation();

    expect(presentation.companionVisible).toBe(false);
    expect(presentation.ambientActivity).toBeNull();
    expect(presentation.ambientPeekUntil).toBeNull();

    vi.useRealTimers();
  });

  it('ducks away when a visible peek visit expires', async () => {
    await persistPresentation({
      mood: 'peek',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/peek.gif',
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
      ambientPeekUntil: NOW - 1,
      peekEdge: 'right',
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil: null,
    });
    store[STORAGE_KEYS.introCompleted] = true;

    const presentation = await getCurrentPresentation();

    expect(presentation.companionVisible).toBe(false);
    expect(presentation.mood).toBe('peek');
    expect(presentation.ambientActivity).toBe('peeking');
    expect(presentation.ambientPeekUntil).toBeGreaterThan(NOW);
  });

  it('agrees with a full recompute on what a just-expired peek visit means', async () => {
    // Regression: getCurrentPresentation's fast-path read and resolveCompanionPresence's
    // full recompute (used by tab switches, via presentOnActiveTab) used to independently
    // decide what an expired peek visit means, and only one of them actually ducked her
    // away — the other dropped ambientActivity and reset to whatever the underlying vitals
    // mood was. Both now share enterPeekDuckGap(); this pins that they can't quietly grow
    // apart again.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    store[STORAGE_KEYS.introCompleted] = true;
    store[STORAGE_KEYS.settings] = { ...DEFAULT_SETTINGS, quietHoursStart: 0, quietHoursEnd: 24 };

    const expiredPeek: CatPresentation = {
      mood: 'peek',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/peek.gif',
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
      ambientPeekUntil: NOW - 1,
      peekEdge: 'right',
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil: null,
    };

    await persistPresentation(expiredPeek);
    const viaRead = await getCurrentPresentation();

    await persistPresentation(expiredPeek);
    const viaRecompute = await presentOnActiveTab(NOW, {
      title: 'Any Page',
      url: 'https://example.com/',
    });

    expect(viaRead.companionVisible).toBe(false);
    expect(viaRead.mood).toBe('peek');
    expect(viaRead.ambientActivity).toBe('peeking');

    expect(viaRecompute.lastPresentation?.companionVisible).toBe(viaRead.companionVisible);
    expect(viaRecompute.lastPresentation?.mood).toBe(viaRead.mood);
    expect(viaRecompute.lastPresentation?.ambientActivity).toBe(viaRead.ambientActivity);

    vi.useRealTimers();
  });

  it('carries the restore-to ambient activity into the duck gap', async () => {
    // Regression: the duck gap presentation is built without passing
    // peekRestoreAmbientActivity/Until through, so it silently reset to
    // null every time a visit expired — reveal during the gap then had
    // nothing to restore to.
    await persistPresentation({
      mood: 'peek',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/peek.gif',
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
      ambientPeekUntil: NOW - 1,
      peekEdge: 'right',
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: 'grooming',
      peekRestoreAmbientUntil: NOW + 120_000,
      stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil: null,
    });
    store[STORAGE_KEYS.introCompleted] = true;

    const presentation = await getCurrentPresentation();

    expect(presentation.companionVisible).toBe(false);
    expect(presentation.peekRestoreAmbientActivity).toBe('grooming');
    expect(presentation.peekRestoreAmbientUntil).toBe(NOW + 120_000);
  });

  it('peeks again from a new corner after the duck gap', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    await persistPresentation({
      mood: 'peek',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/peek.gif',
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      canPet: false,
      canTreat: false,
      canPlay: false,
      interactions: [],
      secondaryInteractions: [],
      lastCareAction: null,
      companionVisible: false,
      ambientActivity: 'peeking',
      ambientPeekUntil: NOW - 1,
      peekEdge: 'left',
      peekInset: 16,
      peekCorner: 'left',
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil: null,
    });
    store[STORAGE_KEYS.introCompleted] = true;

    const presentation = await getCurrentPresentation();

    expect(presentation.companionVisible).toBe(true);
    expect(presentation.mood).toBe('peek');
    expect(presentation.ambientActivity).toBe('peeking');
    expect(presentation.ambientPeekUntil).toBeGreaterThan(NOW);

    vi.useRealTimers();
  });

  it('dev peek overrides stay-visible stickiness in cached presentation', async () => {
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      devForceMood: 'peek',
    };
    store[STORAGE_KEYS.introCompleted] = true;
    await persistPresentation({
      mood: 'happy',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/happy.gif',
      speech: null,
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: NOW + 120_000,
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await getCurrentPresentation();

    expect(presentation.mood).toBe('peek');
    expect(presentation.stayVisibleUntil).toBeNull();
    expect(presentation.peekEdge).toBeTruthy();
  });

  it('minute tick keeps dev peek while stay-visible would still be active', async () => {
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      devForceMood: 'peek',
    };
    store[STORAGE_KEYS.introCompleted] = true;
    await persistPresentation({
      mood: 'happy',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/happy.gif',
      speech: null,
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: NOW + 120_000,
      eatingUntil: null,
      playingUntil: null,
    });

    const state = await runMinuteTick(NOW);

    expect(state.lastPresentation?.mood).toBe('peek');
    expect(state.lastPresentation?.stayVisibleUntil).toBeNull();
  });
});

describe('syncDevTemperControls', () => {
  it('forces peek over stay-visible stickiness from dev controls', async () => {
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      devForceMood: 'auto',
    };
    store[STORAGE_KEYS.introCompleted] = true;
    await persistPresentation({
      mood: 'happy',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/happy.gif',
      speech: null,
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: NOW + 120_000,
      eatingUntil: null,
      playingUntil: null,
    });

    const result = await syncDevTemperControls({ devForceMood: 'peek' });

    expect(result.presentation.mood).toBe('peek');
    expect(result.presentation.stayVisibleUntil).toBeNull();
    expect(result.settings.devForceMood).toBe('peek');
  });

  it('persists the new forced mood instead of the previous one', async () => {
    // Regression: syncDevTemperControls used to persist the presentation
    // BEFORE saving settings. persistPresentation() re-reads settings from
    // storage to re-apply any forced dev mood, so it read the OLD
    // devForceMood ("happy") and stomped the freshly built "peek"
    // presentation back to "happy" in storage, even though the returned
    // value and the settings both correctly said "peek".
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      devForceMood: 'happy',
    };
    store[STORAGE_KEYS.introCompleted] = true;

    await syncDevTemperControls({ devForceMood: 'peek' });

    const stored = store[STORAGE_KEYS.presentation] as { mood: string } | undefined;
    expect(stored?.mood).toBe('peek');
  });
});

describe('presentOnActiveTab', () => {
  it('recomputes presentation for the active page', async () => {
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/idle.gif',
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
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

  it('is not clobbered by a concurrent shoo care action racing the same tab switch', async () => {
    // Regression: clicking "shoo" in tab A and then immediately switching to
    // tab B both read-compute-persist the shared presentation. Without
    // serializing them, the tab-switch recompute could read stale
    // (pre-shoo) data and its write — landing after shoo's — would silently
    // overwrite the peek she just entered.
    store[STORAGE_KEYS.introCompleted] = true;
    // Force non-daytime so the ambient system's own "start a fresh peek visit"
    // default can't independently land on ambientActivity:'peeking' and mask
    // a real clobber (which would otherwise show as a full reset, not a peek).
    store[STORAGE_KEYS.settings] = { ...DEFAULT_SETTINGS, quietHoursStart: 0, quietHoursEnd: 24 };
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
      canPlay: false,
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

    await Promise.all([
      handleCareAction('shoo', NOW, {}),
      presentOnActiveTab(NOW, { title: 'New Tab', url: 'https://new-tab.example/' }),
    ]);

    const stored = (await browser.storage.local.get([STORAGE_KEYS.presentation]))[
      STORAGE_KEYS.presentation
    ] as { mood?: string; ambientActivity?: string | null };

    expect(stored.mood).toBe('peek');
    expect(stored.ambientActivity).toBe('peeking');
  });

  it('preserves peek across a tab switch a few seconds after shoo, end to end', async () => {
    // Same scenario, but sequential (no race) and running the full real chain:
    // handleCareAction('shoo') -> the tab-switch-triggered presentOnActiveTab
    // recompute -> getCurrentPresentation(), the exact call the content script
    // makes to render tab B. Confirms the data itself stays correct once the
    // race above is ruled out.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    store[STORAGE_KEYS.introCompleted] = true;
    store[STORAGE_KEYS.settings] = { ...DEFAULT_SETTINGS, quietHoursStart: 0, quietHoursEnd: 24 };
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
      canPlay: false,
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

    await handleCareAction('shoo', NOW, {});

    vi.setSystemTime(NOW + 2_500);
    await presentOnActiveTab(NOW + 2_500, {
      title: 'New Tab',
      url: 'https://new-tab.example/',
    });

    const rendered = await getCurrentPresentation();
    expect(rendered.mood).toBe('peek');
    expect(rendered.ambientActivity).toBe('peeking');
    expect(rendered.companionVisible).toBe(true);

    vi.useRealTimers();
  });

  it('preserves peek across a forced tab-switch recompute (devModeEnabled reactivating an already-open tab)', async () => {
    // Regression: background.ts's refreshPresentationForActiveTab passes
    // forceDevSpeech: true on every focus change whenever the user's own
    // devModeEnabled setting is on (independent of forcing a specific mood).
    // resolveCompanionPresence's forceVisible branch used to short-circuit
    // straight to a plain "show her, no ambient state" result, silently
    // cancelling an in-progress peek the instant an already-open tab (or a
    // refresh) regained focus — while a brand-new tab, which never runs this
    // recompute at all, kept showing the peek untouched.
    store[STORAGE_KEYS.introCompleted] = true;
    store[STORAGE_KEYS.settings] = {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      quietHoursStart: 0,
      quietHoursEnd: 24,
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
      canPlay: false,
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

    await handleCareAction('shoo', NOW, {});

    const result = await presentOnActiveTab(
      NOW + 2_500,
      { title: 'Already Open Tab', url: 'https://already-open.example/' },
      { forceDevSpeech: true },
    );

    expect(result.lastPresentation?.mood).toBe('peek');
    expect(result.lastPresentation?.ambientActivity).toBe('peeking');
    expect(result.lastPresentation?.companionVisible).toBe(true);
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
      sprite: 'gif/adult/idle.gif',
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
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
      sprite: 'gif/adult/idle.gif',
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
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
    expect(presentation.sprite).toContain('peek.gif');
    expect(presentation.ambientActivity).toBe('peeking');
    expect(presentation.peekEdge).toBeTruthy();
  });
});

describe('clearCompanionSpeech', () => {
  it('clears cached speech from presentation', async () => {
    await persistPresentation({
      mood: 'content',
      stage: 'adult',
      stageLabel: 'Adult',
      sprite: 'gif/adult/idle.gif',
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
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
      sprite: 'gif/adult/idle.gif',
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
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
      sprite: 'gif/adult/idle.gif',
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
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
      sprite: 'gif/adult/idle.gif',
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
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
      sprite: 'gif/adult/idle.gif',
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
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
      sprite: '/gif/adult/peek.gif',
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
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil: null,
      eatingUntil: null,
      playingUntil: null,
    });

    const presentation = await devForceCompanionHide(NOW);

    expect(presentation.companionVisible).toBe(false);
    expect(presentation.mood).toBe('peek');
  });
});
