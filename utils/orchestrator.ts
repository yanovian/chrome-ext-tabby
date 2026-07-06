import {
  applyVisitToVitals,
  applyCareAction,
  applyMinuteTick,
  createInitialCat,
  deriveMoodFromVitals,
  recordAppearance,
  resetDailyNudgeCounter,
  resolveLifeStage,
} from './cat-sim';
import { explainCurrentMood, mapCareActionToInteraction, resolveAskMood } from './cat-interactions';
import { fallbackSpeech } from './speech-fallback';
import {
  appendObservation,
  getCatState,
  getMemories,
  recallMemory,
  saveCatState,
} from './db';
import { evaluateEmotionalTrigger } from './emotional-triggers';
import { hidePageOverlay, isPageOverlayHidden, pageOverlayKey, showPageOverlay } from './page-overlay';
import { buildPresentation } from './presentation';
import { generateTabbySpeech } from './speech-service';
import type { SpeechContext } from './speech-types';
import { effectiveAppearanceLimits, getSettings } from './settings';
import { registerVisit } from './visit-dedup';
import type {
  CareAction,
  CatMood,
  CatPresentation,
  CatState,
  ExtensionSettings,
  MemorySeed,
  PageOverlayState,
} from './types';
import { STORAGE_KEYS } from './types';

const IS_DEV_BUILD = import.meta.env.DEV;

export interface OrchestratorState {
  cat: CatState;
  settings: ExtensionSettings;
  isUserIdle: boolean;
  lastPresentation: CatPresentation | null;
}

export interface PageContext {
  title?: string;
  topic?: string;
  url?: string;
}

export async function loadOrchestratorState(): Promise<OrchestratorState> {
  const [cat, settings] = await Promise.all([
    getCatState(),
    getSettings(IS_DEV_BUILD),
  ]);
  return {
    cat,
    settings,
    isUserIdle: false,
    lastPresentation: null,
  };
}

export async function persistPresentation(
  presentation: CatPresentation,
): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEYS.presentation]: presentation,
  });
}

export async function readCachedPresentation(): Promise<CatPresentation | null> {
  const result = await browser.storage.local.get([STORAGE_KEYS.presentation]);
  return (result[STORAGE_KEYS.presentation] as CatPresentation | undefined) ?? null;
}

async function loadRecentVisitKeys(): Promise<string[]> {
  const result = await browser.storage.local.get([STORAGE_KEYS.recentVisitKeys]);
  const raw = result[STORAGE_KEYS.recentVisitKeys];
  return Array.isArray(raw) ? (raw as string[]) : [];
}

async function saveRecentVisitKeys(keys: string[]): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.recentVisitKeys]: keys });
}

/** Score the active page after 1+ minute dwell, once per focus, if not in recent-10 dedup. */
export async function recordPageVisit(input: {
  title: string;
  url: string;
  hostname: string;
  activeDurationMs: number;
  now: number;
}): Promise<{ state: OrchestratorState; counted: boolean }> {
  const state = await loadOrchestratorState();
  const recentKeys = await loadRecentVisitKeys();
  const visit = registerVisit(input.url, recentKeys);

  if (!visit.counted) {
    return { state, counted: false };
  }

  await saveRecentVisitKeys(visit.recentKeys);

  const { statMultiplier } = effectiveAppearanceLimits(state.settings);

  const observation = await appendObservation({
    observedAt: input.now,
    title: input.title,
    url: input.url,
    hostname: input.hostname,
    activeDurationMs: input.activeDurationMs,
  });

  let cat = resetDailyNudgeCounter(state.cat, input.now);
  if (observation.category) {
    cat = {
      ...cat,
      vitals: applyVisitToVitals(cat.vitals, {
        category: observation.category,
        statMultiplier,
      }),
    };
  }

  await saveCatState(cat);
  return { state: { ...state, cat }, counted: true };
}

/** @deprecated Use recordPageVisit — kept as an alias for tests. */
export const recordBrowsingSession = recordPageVisit;

export async function runMinuteTick(
  now: number,
  options: {
    forceDevSpeech?: boolean;
    forceTick?: boolean;
    page?: PageContext;
    /** When false, only update vitals — presentation waits for the active tab. */
    present?: boolean;
  } = {},
): Promise<OrchestratorState> {
  const state = await loadOrchestratorState();
  const cat = resetDailyNudgeCounter(state.cat, now);
  const vitals = applyMinuteTick(cat.vitals, {
    cat,
    now,
    settings: state.settings,
    isUserIdle: state.isUserIdle,
  });

  const nextCat = { ...cat, vitals };
  await saveCatState(nextCat);
  const nextState = { ...state, cat: nextCat };
  if (options.present === false) {
    return nextState;
  }
  return evaluateAndPresent(nextState, now, options);
}

/** Recompute mood and speech for the tab the user is viewing right now. */
export async function presentOnActiveTab(
  now: number,
  page: PageContext,
  options: { forceDevSpeech?: boolean; forceTick?: boolean } = {},
): Promise<OrchestratorState> {
  const state = await loadOrchestratorState();
  return evaluateAndPresent(state, now, { ...options, page });
}

export async function setUserIdle(isUserIdle: boolean): Promise<void> {
  const state = await loadOrchestratorState();
  await evaluateAndPresent({ ...state, isUserIdle }, Date.now());
}

function careSpeechKind(action: CareAction): SpeechContext['kind'] | null {
  switch (action) {
    case 'pet':
      return 'care_pet';
    case 'treat':
      return 'care_treat';
    case 'play':
      return 'care_play';
    case 'ask':
      return 'ask';
    case 'dismiss':
      return 'dismiss';
    default:
      return null;
  }
}

export async function handleCareAction(
  action: CareAction,
  now: number,
  page: PageContext = {},
): Promise<CatPresentation> {
  const state = await loadOrchestratorState();
  let cat = state.cat;
  let triggerKind = state.lastPresentation?.triggerKind ?? null;
  let moodOverride: CatMood | undefined;

  const derivedMood = deriveMoodFromVitals({
    vitals: cat.vitals,
    now,
    settings: state.settings,
    isUserIdle: state.isUserIdle,
  });
  const stage = resolveLifeStage(cat.adoptedAt, now, state.settings.devForceLifeStage);
  const speechKind = careSpeechKind(action);

  if (action === 'dismiss') {
    await hidePageOverlay(page.url);
    triggerKind = null;
  } else if (action === 'ask') {
    moodOverride = resolveAskMood(cat.vitals, derivedMood);
    triggerKind = null;
  } else {
    cat = applyCareAction(cat, action, now);
    triggerKind = null;
    await saveCatState(cat);
  }

  const mood = moodOverride ?? derivedMood;
  let speech: string | null = null;

  if (speechKind) {
    if (action === 'ask') {
      // Direct check-ins need mood-accurate lines, not open-ended generation.
      speech = explainCurrentMood(mood, cat.vitals, stage, now);
    } else {
      const context: SpeechContext = {
        kind: speechKind,
        mood,
        stage,
        seed: now,
        pageTopic: page.topic,
      };
      // Care taps need reliable, action-specific lines — not open-ended generation.
      speech = fallbackSpeech(context);
    }
  }

  const presentation = buildPresentation({
    cat,
    vitals: cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech,
    triggerKind,
    overlayHidden: false,
    moodOverride: action === 'ask' ? moodOverride : undefined,
    lastCareAction: mapCareActionToInteraction(action),
  });

  await persistPresentation(presentation);
  return presentation;
}

export async function evaluateAndPresent(
  state: OrchestratorState,
  now: number,
  options: { forceDevSpeech?: boolean; forceTick?: boolean; page?: PageContext } = {},
): Promise<OrchestratorState> {
  const memories = await getMemories();
  const recentMemory = await pickRecallCandidate(memories, now, state.settings);
  const trigger = evaluateEmotionalTrigger({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    recentMemory,
    forceDevSpeech: options.forceDevSpeech,
    forceTick: options.forceTick,
    pageTitle: options.page?.title,
    pageTopic: options.page?.topic,
  });

  let cat = state.cat;

  if (trigger.shouldAppear && trigger.triggerKind) {
    cat = recordAppearance(cat, now);
    await saveCatState(cat);
    if (trigger.triggerKind === 'memory' && recentMemory) {
      await recallMemory(now);
    }
  }

  let speech: string | null = null;
  if (trigger.speechContext) {
    if (state.settings.localSpeechEnabled) {
      speech = await generateTabbySpeech(trigger.speechContext, {
        enabled: true,
        fallback: () => fallbackSpeech(trigger.speechContext!),
      });
    } else {
      speech = fallbackSpeech(trigger.speechContext);
    }
  }

  const presentation = buildPresentation({
    cat,
    vitals: cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech,
    triggerKind: trigger.triggerKind,
    overlayHidden: false,
    lastCareAction: state.lastPresentation?.lastCareAction ?? null,
  });

  await persistPresentation(presentation);

  return {
    ...state,
    cat,
    lastPresentation: presentation,
  };
}

async function pickRecallCandidate(
  memories: MemorySeed[],
  now: number,
  settings: ExtensionSettings,
): Promise<MemorySeed | null> {
  if (memories.length === 0) {
    return null;
  }
  const eligible = memories.find((memory) => {
    if (!memory.lastRecalledAt) {
      return true;
    }
    const cooldownMs = settings.devModeEnabled
      ? 1000 * 60 * 5
      : 1000 * 60 * 60 * 24 * 3;
    return now - memory.lastRecalledAt > cooldownMs;
  });
  return eligible ?? null;
}

export async function ensureCatExists(now: number): Promise<CatState> {
  const cat = await getCatState(now);
  if (cat) {
    return cat;
  }
  const initial = createInitialCat(now);
  await saveCatState(initial);
  return initial;
}

export async function showOverlayOnPage(
  now: number,
  page: PageContext = {},
): Promise<CatPresentation> {
  await showPageOverlay(page.url);
  const state = await loadOrchestratorState();
  const stage = resolveLifeStage(
    state.cat.adoptedAt,
    now,
    state.settings.devForceLifeStage,
  );
  const mood = deriveMoodFromVitals({
    vitals: state.cat.vitals,
    now,
    settings: state.settings,
    isUserIdle: state.isUserIdle,
  });
  const speech = fallbackSpeech({
    kind: 'happy',
    mood,
    stage,
    seed: now,
    pageTitle: page.title,
    pageTopic: page.topic,
  });
  const presentation = buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech,
    triggerKind: null,
    overlayHidden: false,
    lastCareAction: null,
  });
  await persistPresentation(presentation);
  return presentation;
}

export async function hideOverlayOnPage(page: PageContext = {}): Promise<CatPresentation> {
  await hidePageOverlay(page.url);
  return getCurrentPresentation();
}

export async function getPageOverlayState(
  url: string | undefined,
  settings?: ExtensionSettings,
): Promise<PageOverlayState> {
  const resolved = settings ?? (await getSettings(IS_DEV_BUILD));
  if (!resolved.showOverlay || !pageOverlayKey(url)) {
    return { applicable: false, visible: false };
  }
  const hidden = await isPageOverlayHidden(url);
  return { applicable: true, visible: !hidden };
}

export async function getCurrentPresentation(): Promise<CatPresentation> {
  const cached = await readCachedPresentation();
  if (cached) {
    return cached;
  }

  const state = await loadOrchestratorState();
  const now = Date.now();
  const result = await evaluateAndPresent(state, now);
  return result.lastPresentation!;
}
