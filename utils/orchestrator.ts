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
import { recordAmbientAppearance } from './ambient-presence';
import {
  careActionToDoNotDisturb,
  clearDoNotDisturb,
  clearExpiredDoNotDisturb,
  doNotDisturbDurationToCareAction,
  isDoNotDisturbActive,
  setDoNotDisturb,
} from './do-not-disturb';
import { explainCurrentMood, mapCareActionToInteraction, resolveAskMood } from './cat-interactions';
import { isIntroCompleted, resetIntro } from './intro';
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
import { buildPresentation, moodOverrideWhileHiding } from './presentation';
import { resolveCompanionPresence } from './presence';
import type { SpeechContext } from './speech-types';
import { effectiveAppearanceLimits, getSettings } from './settings';
import { registerVisit } from './visit-dedup';
import type {
  CareAction,
  CatMood,
  CatPresentation,
  CatState,
  DoNotDisturbDuration,
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
  const lastPresentation = await readCachedPresentation();
  return {
    cat,
    settings,
    isUserIdle: false,
    lastPresentation,
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
  const dndDuration = careActionToDoNotDisturb(action);
  if (dndDuration) {
    await setDoNotDisturb(dndDuration, now);
    const state = await loadOrchestratorState();
    const mood = deriveMoodFromVitals({
      vitals: state.cat.vitals,
      now,
      settings: state.settings,
      isUserIdle: state.isUserIdle,
    });
    const presentation = buildPresentation({
      cat: state.cat,
      vitals: state.cat.vitals,
      settings: state.settings,
      now,
      isUserIdle: state.isUserIdle,
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      companionVisible: false,
      ambientActivity: null,
      ambientPeekUntil: null,
      moodOverride: mood,
    });
    await persistPresentation(presentation);
    return presentation;
  }

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
  const endsAmbientVisit =
    action === 'pet' || action === 'treat' || action === 'play' || action === 'ask';

  if (action === 'dismiss') {
    await hidePageOverlay(page.url);
    triggerKind = null;
  } else if (action === 'ask') {
    moodOverride = resolveAskMood(cat.vitals, derivedMood);
    triggerKind = null;
  } else if (action === 'pet' || action === 'treat' || action === 'play') {
    cat = applyCareAction(cat, action, now);
    triggerKind = null;
    await saveCatState(cat);
    moodOverride = deriveMoodFromVitals({
      vitals: cat.vitals,
      now,
      settings: state.settings,
      isUserIdle: state.isUserIdle,
    });
  }

  const mood = moodOverride ?? deriveMoodFromVitals({
    vitals: cat.vitals,
    now,
    settings: state.settings,
    isUserIdle: state.isUserIdle,
  });
  let speech: string | null = null;

  if (speechKind) {
    if (action === 'ask') {
      speech = explainCurrentMood(mood, cat.vitals, stage, now);
    } else {
      const context: SpeechContext = {
        kind: speechKind,
        mood,
        stage,
        seed: now,
        pageTopic: page.topic,
      };
      speech = fallbackSpeech(context);
    }
  }

  const keepVisible =
    state.lastPresentation?.companionVisible === true &&
    action !== 'dismiss';

  const presentation = buildPresentation({
    cat,
    vitals: cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech,
    triggerKind,
    overlayHidden: false,
    moodOverride,
    lastCareAction: mapCareActionToInteraction(action),
    companionVisible: keepVisible,
    ambientActivity:
      keepVisible && !endsAmbientVisit
        ? state.lastPresentation?.ambientActivity ?? null
        : null,
    ambientPeekUntil:
      keepVisible && !endsAmbientVisit
        ? state.lastPresentation?.ambientPeekUntil ?? null
        : null,
  });

  await persistPresentation(presentation);
  return presentation;
}

export async function evaluateAndPresent(
  state: OrchestratorState,
  now: number,
  options: { forceDevSpeech?: boolean; forceTick?: boolean; page?: PageContext } = {},
): Promise<OrchestratorState> {
  const [memories, doNotDisturb, introCompleted] = await Promise.all([
    getMemories(),
    clearExpiredDoNotDisturb(now),
    isIntroCompleted(),
  ]);
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

  const presence = resolveCompanionPresence({
    cat: state.cat,
    settings: state.settings,
    now,
    speechTrigger: trigger,
    doNotDisturb,
    introCompleted,
    lastPresentation: state.lastPresentation,
    forceVisible: options.forceTick === true || options.forceDevSpeech === true,
  });

  let cat = state.cat;

  if (presence.recordSpeech && trigger.triggerKind) {
    cat = recordAppearance(cat, now);
    await saveCatState(cat);
    if (trigger.triggerKind === 'memory' && recentMemory) {
      await recallMemory(now);
    }
  } else if (presence.recordAmbient) {
    cat = recordAmbientAppearance(cat, now);
    await saveCatState(cat);
  }

  let speech: string | null = null;
  let triggerKind: CatPresentation['triggerKind'] = presence.recordSpeech
    ? trigger.triggerKind
    : null;

  if (presence.recordSpeech && trigger.speechContext) {
    speech = fallbackSpeech(trigger.speechContext);
  } else if (presence.recordAmbient && presence.ambientActivity === 'peeking') {
    const mood = deriveMoodFromVitals({
      vitals: cat.vitals,
      now,
      settings: state.settings,
      isUserIdle: state.isUserIdle,
    });
    const stage = resolveLifeStage(cat.adoptedAt, now, state.settings.devForceLifeStage);
    speech = fallbackSpeech({ kind: 'peeking', mood, stage, seed: now });
    triggerKind = 'curious';
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
    lastCareAction: state.lastPresentation?.lastCareAction ?? null,
    companionVisible: presence.companionVisible,
    ambientActivity: presence.ambientActivity,
    ambientPeekUntil: presence.ambientPeekUntil,
    moodOverride: moodOverrideWhileHiding(
      state.lastPresentation?.mood,
      presence.companionVisible,
    ),
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
  await clearDoNotDisturb();
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
    companionVisible: true,
    ambientActivity: null,
    ambientPeekUntil: null,
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
  const presentation = await readCachedPresentation();
  const now = Date.now();
  const doNotDisturb = await clearExpiredDoNotDisturb(now);
  let companionVisible = presentation?.companionVisible ?? false;
  if (isDoNotDisturbActive(doNotDisturb, now)) {
    companionVisible = false;
  }
  return { applicable: true, visible: !hidden && companionVisible };
}

function presentationDuringDoNotDisturb(
  presentation: CatPresentation,
): CatPresentation {
  return {
    ...presentation,
    companionVisible: false,
    ambientActivity: null,
    ambientPeekUntil: null,
    speech: null,
    triggerKind: null,
  };
}

export async function getCurrentPresentation(): Promise<CatPresentation> {
  const cached = await readCachedPresentation();
  const now = Date.now();
  const doNotDisturb = await clearExpiredDoNotDisturb(now);
  const introCompleted = await isIntroCompleted();

  if (cached) {
    if (isDoNotDisturbActive(doNotDisturb, now)) {
      return presentationDuringDoNotDisturb(cached);
    }
    if (!introCompleted && !cached.companionVisible) {
      const state = await loadOrchestratorState();
      const result = await evaluateAndPresent(state, now);
      return result.lastPresentation!;
    }
    return cached;
  }

  const state = await loadOrchestratorState();
  const result = await evaluateAndPresent(state, now);
  return result.lastPresentation!;
}

/** Dev/testing: clear intro progress and show the tour again. */
export async function restartIntroSession(now: number): Promise<CatPresentation> {
  await resetIntro();
  const state = await loadOrchestratorState();
  const result = await evaluateAndPresent(state, now);
  return result.lastPresentation!;
}

export async function cancelDoNotDisturb(now: number): Promise<CatPresentation> {
  await clearDoNotDisturb();
  const cached = await readCachedPresentation();
  if (cached) {
    return cached;
  }

  const state = await loadOrchestratorState();
  const result = await evaluateAndPresent(state, now);
  return result.lastPresentation!;
}

export async function enableDoNotDisturb(
  duration: DoNotDisturbDuration,
  now: number,
): Promise<CatPresentation> {
  return handleCareAction(doNotDisturbDurationToCareAction(duration), now);
}

function assertDevCompanionAccess(settings: ExtensionSettings): void {
  if (!IS_DEV_BUILD || !settings.devModeEnabled) {
    throw new Error('Dev companion controls require dev mode in a dev build.');
  }
}

/** Dev-only: force Tabby to appear using the current dev mood override. */
export async function devForceCompanionShow(now: number): Promise<CatPresentation> {
  const state = await loadOrchestratorState();
  assertDevCompanionAccess(state.settings);

  const presentation = buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech: null,
    triggerKind: null,
    overlayHidden: false,
    lastCareAction: state.lastPresentation?.lastCareAction ?? null,
    companionVisible: true,
    ambientActivity: null,
    ambientPeekUntil: null,
  });

  await persistPresentation(presentation);
  return presentation;
}

/** Dev-only: force Tabby to hide on the active tab right away. */
export async function devForceCompanionHide(now: number): Promise<CatPresentation> {
  const state = await loadOrchestratorState();
  assertDevCompanionAccess(state.settings);

  const base = state.lastPresentation;
  const presentation = buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech: null,
    triggerKind: null,
    overlayHidden: base?.overlayHidden ?? false,
    lastCareAction: base?.lastCareAction ?? null,
    companionVisible: false,
    ambientActivity: null,
    ambientPeekUntil: null,
    moodOverride: moodOverrideWhileHiding(base?.mood, false),
  });

  await persistPresentation(presentation);
  return presentation;
}

/** Clear unprompted speech from the cached presentation. */
export async function clearCompanionSpeech(now: number): Promise<CatPresentation> {
  const cached = await readCachedPresentation();
  if (cached) {
    const cleared = { ...cached, speech: null, triggerKind: null };
    await persistPresentation(cleared);
    return cleared;
  }

  const state = await loadOrchestratorState();
  const presentation = buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech: null,
    triggerKind: null,
    overlayHidden: state.lastPresentation?.overlayHidden ?? false,
    lastCareAction: state.lastPresentation?.lastCareAction ?? null,
    companionVisible: state.lastPresentation?.companionVisible ?? true,
    ambientActivity: state.lastPresentation?.ambientActivity ?? null,
    ambientPeekUntil: state.lastPresentation?.ambientPeekUntil ?? null,
  });
  const cleared = { ...presentation, speech: null, triggerKind: null };
  await persistPresentation(cleared);
  return cleared;
}

/** After intro ends, keep Tabby visible and never carry speech over. */
export async function settleAfterIntro(now: number): Promise<CatPresentation> {
  const cached = await readCachedPresentation();
  const state = await loadOrchestratorState();
  const base =
    cached ??
    buildPresentation({
      cat: state.cat,
      vitals: state.cat.vitals,
      settings: state.settings,
      now,
      isUserIdle: state.isUserIdle,
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      lastCareAction: state.lastPresentation?.lastCareAction ?? null,
      companionVisible: true,
    });

  const settled = {
    ...base,
    speech: null,
    triggerKind: null,
    companionVisible: true,
    ambientActivity: null,
    ambientPeekUntil: null,
  };
  await persistPresentation(settled);
  return settled;
}
