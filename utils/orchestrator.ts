import {
  applyAskInteraction,
  applyCareAction,
  applyMinuteTick,
  applyVisitToVitals,
  createInitialCat,
  deriveMoodFromVitals,
  recordAppearance,
  resetDailyNudgeCounter,
  resolveLifeStage,
} from './cat-sim';
import {
  isAmbientPeekDuckGapExpired,
  isAmbientPeekVisitExpired,
  isAmbientRestExpired,
  isStayVisibleAfterRevealExpired,
  pickAmbientPeekDuckGapMs,
  pickStayVisibleAfterRevealMs,
  recordAmbientAppearance,
} from './ambient-presence';
import {
  careActionToDoNotDisturb,
  clearDoNotDisturb,
  clearExpiredDoNotDisturb,
  doNotDisturbDurationToCareAction,
  isDoNotDisturbActive,
  setDoNotDisturb,
} from './do-not-disturb';
import { explainCurrentMood, mapCareActionToInteraction, resolveAskMood, resolveHungryMood } from './cat-interactions';
import { isIntroCompleted, resetIntro } from './intro';
import { fallbackSpeech, previewRecoverySpeech } from './speech-fallback';
import {
  appendObservation,
  getCatState,
  getMemories,
  recallMemory,
  saveCatState,
} from './db';
import { evaluateEmotionalTrigger } from './emotional-triggers';
import {
  applyDevMoodToTemper,
  applyTemperSimulation,
  temperSimulationFromSession,
  type DevTemperSnapshot,
} from './dev-temper';
import {
  inferTemperMood,
  readTemperSimulation,
  resolveMoodTimers,
  type TemperSimulation,
} from './mood-timers';
import {
  acknowledgeDrainingNudge,
  acknowledgeRecoveryEasing,
  completeDrainingRecovery,
  isDrainingSessionOverwhelmed,
  isInDrainingRecovery,
  pendingRecoveryNudge,
  readDrainingSessionState,
  writeDrainingSessionState,
} from './draining-session';
import {
  clearFeedingCompleteAlarm,
  feedingMomentDue,
  feedingMunchSpeech,
  feedingThanksSpeech,
  isFeedingActive,
  pickFeedingDurationMs,
  scheduleFeedingCompleteAlarm,
  shouldStartFeedingMoment,
} from './feeding-moment';
import {
  clearPlayingCompleteAlarm,
  isPlayingActive,
  pickPlayingDurationMs,
  playingMomentDue,
  playingThanksSpeech,
  playingWildSpeech,
  schedulePlayingCompleteAlarm,
} from './play-moment';
import { hidePageOverlay, isPageOverlayHidden, pageOverlayKey, showPageOverlay } from './page-overlay';
import { buildPresentation, isPeekPresentation, moodOverrideWhileHiding, patchPresentationForDevForce } from './presentation';
import { isEnteringPeekCycle, resolvePeekRestoreAmbient } from './peek-restore';
import { resolveCompanionPresence } from './presence';
import type { SpeechContext } from './speech-types';
import { effectiveAppearanceLimits, getSettings, saveSettings } from './settings';
import { registerVisit } from './visit-dedup';
import type {
  CareAction,
  CatMood,
  CatPresentation,
  CatState,
  DevMoodOverride,
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
  now = Date.now(),
): Promise<void> {
  const settings = await getSettings(IS_DEV_BUILD);
  const finalized = patchPresentationForDevForce(presentation, settings, now);
  await browser.storage.local.set({
    [STORAGE_KEYS.presentation]: finalized,
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

function buildFeedingContinuationPresentation(
  state: OrchestratorState,
  now: number,
  companionVisible: boolean,
): CatPresentation {
  const eatingUntil = state.lastPresentation!.eatingUntil!;
  const stage = resolveLifeStage(
    state.cat.adoptedAt,
    now,
    state.settings.devForceLifeStage,
  );
  const derivedMood = deriveMoodFromVitals({
    vitals: state.cat.vitals,
    cat: state.cat,
    now,
    settings: state.settings,
    isUserIdle: state.isUserIdle,
  });

  return buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech: feedingMunchSpeech(derivedMood, stage, eatingUntil),
    triggerKind: 'happy',
    overlayHidden: state.lastPresentation?.overlayHidden ?? false,
    lastCareAction: 'feed',
    companionVisible,
    ambientActivity: null,
    ambientPeekUntil: null,
    eatingUntil,
    playingUntil: null,
  });
}

async function completeFeedingPresentation(
  state: OrchestratorState,
  now: number,
): Promise<OrchestratorState> {
  await clearFeedingCompleteAlarm();
  const stage = resolveLifeStage(
    state.cat.adoptedAt,
    now,
    state.settings.devForceLifeStage,
  );
  const presentation = buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech: feedingThanksSpeech(stage, now),
    triggerKind: 'happy',
    overlayHidden: state.lastPresentation?.overlayHidden ?? false,
    moodOverride: 'happy',
    lastCareAction: null,
    companionVisible: state.lastPresentation?.companionVisible ?? false,
    ambientActivity: null,
    ambientPeekUntil: null,
    eatingUntil: null,
    playingUntil: null,
  });
  await persistPresentation(presentation);
  return { ...state, lastPresentation: presentation };
}

function buildPlayingContinuationPresentation(
  state: OrchestratorState,
  now: number,
  companionVisible: boolean,
): CatPresentation {
  const playingUntil = state.lastPresentation!.playingUntil!;
  const stage = resolveLifeStage(
    state.cat.adoptedAt,
    now,
    state.settings.devForceLifeStage,
  );
  const derivedMood = deriveMoodFromVitals({
    vitals: state.cat.vitals,
    cat: state.cat,
    now,
    settings: state.settings,
    isUserIdle: state.isUserIdle,
  });

  return buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech: playingWildSpeech(derivedMood, stage, playingUntil),
    triggerKind: 'happy',
    overlayHidden: state.lastPresentation?.overlayHidden ?? false,
    lastCareAction: 'play',
    companionVisible,
    ambientActivity: null,
    ambientPeekUntil: null,
    eatingUntil: null,
    playingUntil,
  });
}

async function completePlayingPresentation(
  state: OrchestratorState,
  now: number,
): Promise<OrchestratorState> {
  await clearPlayingCompleteAlarm();
  const stage = resolveLifeStage(
    state.cat.adoptedAt,
    now,
    state.settings.devForceLifeStage,
  );
  const derivedMood = deriveMoodFromVitals({
    vitals: state.cat.vitals,
    cat: state.cat,
    now,
    settings: state.settings,
    isUserIdle: state.isUserIdle,
  });
  const thankYouMood =
    derivedMood === 'starving' || derivedMood === 'hungry' ? derivedMood : 'happy';
  const presentation = buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech: playingThanksSpeech(stage, now),
    triggerKind: 'happy',
    overlayHidden: state.lastPresentation?.overlayHidden ?? false,
    moodOverride: thankYouMood,
    lastCareAction: null,
    companionVisible: state.lastPresentation?.companionVisible ?? false,
    ambientActivity: null,
    ambientPeekUntil: null,
    eatingUntil: null,
    playingUntil: null,
  });
  await persistPresentation(presentation);
  return { ...state, lastPresentation: presentation };
}

/** Finish munching and show a thank-you line when the feeding timer ends. */
export async function completeFeedingIfDue(now: number): Promise<CatPresentation | null> {
  const state = await loadOrchestratorState();
  if (!feedingMomentDue(state.lastPresentation?.eatingUntil, now)) {
    return null;
  }
  const next = await completeFeedingPresentation(state, now);
  return next.lastPresentation;
}

/** Finish wild play and show a happy thank-you line when the play timer ends. */
export async function completePlayingIfDue(now: number): Promise<CatPresentation | null> {
  const state = await loadOrchestratorState();
  if (!playingMomentDue(state.lastPresentation?.playingUntil, now)) {
    return null;
  }
  const next = await completePlayingPresentation(state, now);
  return next.lastPresentation;
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
      cat: state.cat,
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
  const drainingSession = await readDrainingSessionState();

  if (action === 'reveal') {
    const last = state.lastPresentation;
    if (!last || !isPeekPresentation(last)) {
      if (last) {
        return last;
      }
      const next = await evaluateAndPresent(state, now);
      return next.lastPresentation!;
    }
    let settings = state.settings;
    if (settings.devForceMood === 'peek') {
      settings = { ...settings, devForceMood: 'auto' };
      // saveSettings() without isDevBuild forces devModeEnabled back to
      // false (mergeSettings' default), silently locking the whole dev menu
      // out after revealing a dev-forced peek. Must pass IS_DEV_BUILD here.
      await saveSettings(settings, IS_DEV_BUILD);
    }
    const restoredActivity = last.peekRestoreAmbientActivity;
    const restoredUntil = last.peekRestoreAmbientUntil;
    const restoreAmbient =
      restoredActivity !== null &&
      restoredActivity !== 'peeking' &&
      restoredUntil !== null &&
      restoredUntil > now;
    const presentation = buildPresentation({
      cat: state.cat,
      vitals: state.cat.vitals,
      settings,
      now,
      isUserIdle: state.isUserIdle,
      speech: null,
      triggerKind: null,
      overlayHidden: last.overlayHidden,
      lastCareAction: last.lastCareAction,
      companionVisible: true,
      ambientActivity: restoreAmbient ? restoredActivity : null,
      ambientPeekUntil: restoreAmbient ? restoredUntil : null,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      peekRestoreAmbientActivity: null,
      peekRestoreAmbientUntil: null,
      stayVisibleUntil:
        now + pickStayVisibleAfterRevealMs(settings, now, state.cat.adoptedAt),
      eatingUntil: last.eatingUntil,
      playingUntil: last.playingUntil,
      drainingSession,
    });
    await persistPresentation(presentation);
    return presentation;
  }

  let cat = state.cat;
  let triggerKind = state.lastPresentation?.triggerKind ?? null;
  let moodOverride: CatMood | undefined;

  const derivedMood = deriveMoodFromVitals({
    vitals: cat.vitals,
    cat,
    now,
    settings: state.settings,
    isUserIdle: state.isUserIdle,
  });
  const displayMoodBeforeCare = state.lastPresentation?.mood;
  const stage = resolveLifeStage(cat.adoptedAt, now, state.settings.devForceLifeStage);
  const speechKind = careSpeechKind(action);
  const endsAmbientVisit =
    action === 'pet' || action === 'treat' || action === 'play' || action === 'ask';
  const startFeedingMoment =
    action === 'treat' &&
    shouldStartFeedingMoment(derivedMood, displayMoodBeforeCare);
  const startPlayingMoment = action === 'play';
  const hungryBeforeCare = resolveHungryMood(
    cat.vitals,
    derivedMood,
    displayMoodBeforeCare,
    cat,
    now,
  );

  if (action === 'dismiss') {
    await hidePageOverlay(page.url);
    triggerKind = null;
  } else if (action === 'ask') {
    cat = applyAskInteraction(cat, now);
    await saveCatState(cat);
    moodOverride = resolveAskMood(
      cat.vitals,
      derivedMood,
      displayMoodBeforeCare,
      cat,
      now,
    );
    triggerKind = null;
  } else if (action === 'pet' || action === 'treat' || action === 'play') {
    cat = applyCareAction(cat, action, now);
    triggerKind = null;
    await saveCatState(cat);
    if ((action === 'pet' || action === 'play') && hungryBeforeCare) {
      cat = { ...cat, happyUntil: state.cat.happyUntil };
      await saveCatState(cat);
      moodOverride = hungryBeforeCare;
    } else {
      const derivedAfterCare = deriveMoodFromVitals({
        vitals: cat.vitals,
        cat,
        now,
        settings: state.settings,
        isUserIdle: state.isUserIdle,
      });
      const urgentMoods: CatMood[] = ['starving', 'hungry', 'sleepy'];
      if (isInDrainingRecovery(drainingSession)) {
        moodOverride =
          pendingRecoveryNudge(drainingSession) === 'thanks' ? 'happy' : 'stressed';
      } else if (
        !urgentMoods.includes(derivedAfterCare) &&
        isDrainingSessionOverwhelmed(drainingSession, state.settings)
      ) {
        moodOverride = 'overwhelmed';
      } else {
        moodOverride = derivedAfterCare;
      }
    }
  }

  const mood = moodOverride ?? deriveMoodFromVitals({
    vitals: cat.vitals,
    cat,
    now,
    settings: state.settings,
    isUserIdle: state.isUserIdle,
  });
  let speech: string | null = null;
  let eatingUntil: number | null = null;
  let playingUntil: number | null = null;

  if (startFeedingMoment) {
    eatingUntil = now + pickFeedingDurationMs(state.settings, now);
    triggerKind = 'happy';
    speech = feedingMunchSpeech(derivedMood, stage, eatingUntil);
  } else if (startPlayingMoment) {
    playingUntil = now + pickPlayingDurationMs(state.settings, now);
    triggerKind = 'happy';
    speech = playingWildSpeech(mood, stage, playingUntil);
  } else if (speechKind) {
    if (action === 'ask') {
      speech = explainCurrentMood(mood, cat.vitals, stage, now);
    } else if (action === 'pet' && hungryBeforeCare) {
      speech = fallbackSpeech({
        kind: 'care_pet_hungry',
        mood: hungryBeforeCare,
        stage,
        seed: now,
        pageTopic: page.topic,
      });
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
    action !== 'dismiss' &&
    (state.lastPresentation?.companionVisible === true || endsAmbientVisit);

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
    lastCareAction: startFeedingMoment
      ? 'feed'
      : startPlayingMoment
        ? 'play'
        : mapCareActionToInteraction(action),
    companionVisible: keepVisible,
    ambientActivity:
      keepVisible && !endsAmbientVisit
        ? state.lastPresentation?.ambientActivity ?? null
        : null,
    ambientPeekUntil:
      keepVisible && !endsAmbientVisit
        ? state.lastPresentation?.ambientPeekUntil ?? null
        : null,
    eatingUntil,
    playingUntil,
    drainingSession,
  });

  if (eatingUntil) {
    await scheduleFeedingCompleteAlarm(eatingUntil);
  }
  if (playingUntil) {
    await schedulePlayingCompleteAlarm(playingUntil);
  }

  await persistPresentation(presentation);
  return presentation;
}

export async function evaluateAndPresent(
  state: OrchestratorState,
  now: number,
  options: { forceDevSpeech?: boolean; forceTick?: boolean; page?: PageContext } = {},
): Promise<OrchestratorState> {
  const settings = await getSettings(IS_DEV_BUILD);
  const cachedPresentation = await readCachedPresentation();
  const lastPresentation = cachedPresentation ?? state.lastPresentation;
  const activeState: OrchestratorState = { ...state, settings, lastPresentation };

  const eatingUntil = activeState.lastPresentation?.eatingUntil;
  if (feedingMomentDue(eatingUntil, now)) {
    return completeFeedingPresentation(activeState, now);
  }
  if (isFeedingActive(eatingUntil, now)) {
    const companionVisible =
      activeState.lastPresentation?.companionVisible === true ||
      options.forceTick === true ||
      options.forceDevSpeech === true;
    const presentation = buildFeedingContinuationPresentation(
      activeState,
      now,
      companionVisible,
    );
    await persistPresentation(presentation);
    return { ...activeState, lastPresentation: presentation };
  }

  const playingUntil = activeState.lastPresentation?.playingUntil;
  if (playingMomentDue(playingUntil, now)) {
    return completePlayingPresentation(activeState, now);
  }
  if (isPlayingActive(playingUntil, now)) {
    const companionVisible =
      activeState.lastPresentation?.companionVisible === true ||
      options.forceTick === true ||
      options.forceDevSpeech === true;
    const presentation = buildPlayingContinuationPresentation(
      activeState,
      now,
      companionVisible,
    );
    await persistPresentation(presentation);
    return { ...activeState, lastPresentation: presentation };
  }

  const [memories, doNotDisturb, introCompleted] = await Promise.all([
    getMemories(),
    clearExpiredDoNotDisturb(now),
    isIntroCompleted(),
  ]);
  const recentMemory = await pickRecallCandidate(memories, now, activeState.settings);
  const drainingSession = await readDrainingSessionState();
  if (isDevMoodForced(activeState.settings)) {
    const presentation = buildDevPreviewPresentation(
      activeState,
      activeState.settings,
      drainingSession,
      now,
    );
    await persistPresentation(presentation);
    return { ...activeState, lastPresentation: presentation };
  }
  const trigger = evaluateEmotionalTrigger({
    cat: activeState.cat,
    vitals: activeState.cat.vitals,
    settings: activeState.settings,
    now,
    isUserIdle: activeState.isUserIdle,
    recentMemory,
    forceDevSpeech: options.forceDevSpeech,
    forceTick: options.forceTick,
    pageTitle: options.page?.title,
    pageTopic: options.page?.topic,
    drainingSession,
  });

  const presence = resolveCompanionPresence({
    cat: activeState.cat,
    settings: activeState.settings,
    now,
    isUserIdle: activeState.isUserIdle,
    speechTrigger: trigger,
    doNotDisturb,
    introCompleted,
    lastPresentation: activeState.lastPresentation,
    forceVisible: options.forceTick === true || options.forceDevSpeech === true,
  });

  let cat = activeState.cat;

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
  const triggerKind: CatPresentation['triggerKind'] = presence.recordSpeech
    ? trigger.triggerKind
    : null;

  if (presence.recordSpeech && trigger.speechContext) {
    speech = fallbackSpeech(trigger.speechContext);
    if (trigger.triggerKind === 'overwhelmed') {
      await writeDrainingSessionState(acknowledgeDrainingNudge(drainingSession, now));
    }
    if (trigger.triggerKind === 'recovery_easing') {
      await writeDrainingSessionState(acknowledgeRecoveryEasing(drainingSession, now));
    }
    if (trigger.triggerKind === 'recovery_thanks') {
      await writeDrainingSessionState(completeDrainingRecovery(drainingSession));
    }
  }

  const enteringPeek = isEnteringPeekCycle(
    activeState.lastPresentation,
    presence.ambientActivity,
    presence.companionVisible,
  );
  const peekRestore = resolvePeekRestoreAmbient(activeState.lastPresentation, enteringPeek);

  const presentation = buildPresentation({
    cat,
    vitals: cat.vitals,
    settings: activeState.settings,
    now,
    isUserIdle: activeState.isUserIdle,
    speech,
    triggerKind,
    overlayHidden: false,
    lastCareAction: activeState.lastPresentation?.lastCareAction ?? null,
    companionVisible: presence.companionVisible,
    ambientActivity: presence.ambientActivity,
    ambientPeekUntil: presence.ambientPeekUntil,
    peekEdge: presence.peekEdge,
    peekInset: presence.peekInset,
    peekCorner: presence.peekCorner,
    peekRestoreAmbientActivity: peekRestore.peekRestoreAmbientActivity,
    peekRestoreAmbientUntil: peekRestore.peekRestoreAmbientUntil,
    stayVisibleUntil: activeState.lastPresentation?.stayVisibleUntil ?? null,
    eatingUntil: null,
    playingUntil: null,
    moodOverride: moodOverrideWhileHiding(
      activeState.lastPresentation?.mood,
      presence.companionVisible,
    ),
    drainingSession,
  });

  await persistPresentation(presentation);

  return {
    ...activeState,
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
    cat: state.cat,
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

function finalizePresentation(
  presentation: CatPresentation,
  settings: ExtensionSettings,
  now = Date.now(),
): CatPresentation {
  return patchPresentationForDevForce(presentation, settings, now);
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
    const state = await loadOrchestratorState();
    if (isDevMoodForced(state.settings)) {
      const drainingSession = await readDrainingSessionState();
      const presentation = buildDevPreviewPresentation(
        state,
        state.settings,
        drainingSession,
        now,
      );
      await persistPresentation(presentation);
      return presentation;
    }
    if (feedingMomentDue(cached.eatingUntil, now)) {
      const completed = await completeFeedingIfDue(now);
      if (completed) {
        return finalizePresentation(completed, state.settings, now);
      }
    }
    if (playingMomentDue(cached.playingUntil, now)) {
      const completed = await completePlayingIfDue(now);
      if (completed) {
        return finalizePresentation(completed, state.settings, now);
      }
    }
    if (isAmbientPeekVisitExpired(cached, now)) {
      const state = await loadOrchestratorState();
      const hiding = buildPresentation({
        cat: state.cat,
        vitals: state.cat.vitals,
        settings: state.settings,
        now,
        isUserIdle: state.isUserIdle,
        speech: null,
        triggerKind: null,
        overlayHidden: cached.overlayHidden,
        lastCareAction: cached.lastCareAction,
        companionVisible: false,
        ambientActivity: 'peeking',
        ambientPeekUntil:
          now +
          pickAmbientPeekDuckGapMs(state.settings, now, state.cat.adoptedAt),
        peekEdge: cached.peekEdge,
        peekInset: cached.peekInset,
        peekCorner: cached.peekCorner,
        eatingUntil: cached.eatingUntil,
        playingUntil: cached.playingUntil,
        moodOverride: 'peek',
        drainingSession: await readDrainingSessionState(),
      });
      await persistPresentation(hiding);
      return hiding;
    }
    if (isAmbientPeekDuckGapExpired(cached, now)) {
      const state = await loadOrchestratorState();
      const result = await evaluateAndPresent(state, now);
      return result.lastPresentation!;
    }
    if (isStayVisibleAfterRevealExpired(cached, now)) {
      const state = await loadOrchestratorState();
      const result = await evaluateAndPresent(state, now);
      return result.lastPresentation!;
    }
    if (isAmbientRestExpired(cached, now)) {
      const resumed = {
        ...cached,
        companionVisible: false,
        ambientActivity: null,
        ambientPeekUntil: null,
        peekEdge: null,
      peekInset: null,
      peekCorner: null,
        speech: null,
        triggerKind: null,
      };
      await persistPresentation(resumed);
      return resumed;
    }
    if (!introCompleted && !cached.companionVisible) {
      const state = await loadOrchestratorState();
      const result = await evaluateAndPresent(state, now);
      return result.lastPresentation!;
    }
    return finalizePresentation(cached, state.settings, now);
  }

  const state = await loadOrchestratorState();
  const result = await evaluateAndPresent(state, now);
  return finalizePresentation(result.lastPresentation!, state.settings, now);
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

function isDevMoodForced(settings: ExtensionSettings): boolean {
  return settings.devModeEnabled && settings.devForceMood !== 'auto';
}

export interface DevTemperPayload {
  settings: ExtensionSettings;
  simulation: TemperSimulation;
  previewMood: CatMood;
  inferredMood: CatMood;
  drainingSession: import('./draining-session').DrainingSessionState;
  presentation: CatPresentation;
}

function devPreviewSpeech(
  drainingSession: import('./draining-session').DrainingSessionState,
): string | null {
  if (!isInDrainingRecovery(drainingSession)) {
    return null;
  }
  const nudge = pendingRecoveryNudge(drainingSession);
  if (nudge === 'easing') {
    return previewRecoverySpeech('recovery_easing');
  }
  if (nudge === 'thanks') {
    return previewRecoverySpeech('recovery_thanks');
  }
  return null;
}

function buildDevPreviewPresentation(
  state: Awaited<ReturnType<typeof loadOrchestratorState>>,
  settings: ExtensionSettings,
  drainingSession: import('./draining-session').DrainingSessionState,
  now = Date.now(),
): CatPresentation {
  const moodOverride =
    settings.devModeEnabled && settings.devForceMood !== 'auto'
      ? settings.devForceMood
      : undefined;
  const last = state.lastPresentation;
  const forcingPeek = moodOverride === 'peek';
  const keepPeekPlacement = forcingPeek && last?.mood === 'peek';
  return buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings,
    now,
    isUserIdle: state.isUserIdle,
    speech: devPreviewSpeech(drainingSession),
    triggerKind: null,
    overlayHidden: last?.overlayHidden ?? false,
    lastCareAction: null,
    companionVisible:
      settings.devModeEnabled && settings.devForceMood !== 'auto'
        ? true
        : (last?.companionVisible ?? true),
    ambientActivity: forcingPeek ? ('peeking' as const) : null,
    ambientPeekUntil: null,
    peekEdge: keepPeekPlacement ? last.peekEdge : null,
    peekInset: keepPeekPlacement ? last.peekInset : null,
    peekCorner: keepPeekPlacement ? last.peekCorner : null,
    eatingUntil: null,
    playingUntil: null,
    stayVisibleUntil: moodOverride ? null : (last?.stayVisibleUntil ?? null),
    drainingSession,
    moodOverride,
  });
}

function buildDevTemperPayload(
  settings: ExtensionSettings,
  session: import('./draining-session').DrainingSessionState,
  cat: CatState,
  isUserIdle: boolean,
  presentation: CatPresentation,
): DevTemperPayload {
  const simulation =
    settings.devForceMood === 'auto'
      ? temperSimulationFromSession(settings, session)
      : readTemperSimulation(settings);
  const derivedMood = deriveMoodFromVitals({
    vitals: cat.vitals,
    cat,
    now: Date.now(),
    settings,
    isUserIdle,
  });
  const timers = resolveMoodTimers(settings);
  const inferredMood = inferTemperMood(timers, simulation, derivedMood);
  const previewMood = presentation.mood;
  return {
    settings,
    simulation,
    previewMood,
    inferredMood,
    drainingSession: session,
    presentation,
  };
}

/** Dev-only: read temper sliders, inferred mood, and draining session. */
export async function getDevTemperState(): Promise<DevTemperPayload> {
  const state = await loadOrchestratorState();
  assertDevCompanionAccess(state.settings);
  const session = await readDrainingSessionState();
  const presentation = buildDevPreviewPresentation(state, state.settings, session);
  return buildDevTemperPayload(
    state.settings,
    session,
    state.cat,
    state.isUserIdle,
    presentation,
  );
}

/** Dev-only: sync simulated dwell time and/or mood override, then refresh preview. */
export async function syncDevTemperControls(input: {
  simulation?: Partial<TemperSimulation>;
  devForceMood?: DevMoodOverride;
}): Promise<DevTemperPayload & { presentation: CatPresentation }> {
  const state = await loadOrchestratorState();
  assertDevCompanionAccess(state.settings);

  let snapshot: DevTemperSnapshot;
  if (input.simulation) {
    const current = readTemperSimulation(state.settings);
    snapshot = applyTemperSimulation(
      state.settings,
      { ...current, ...input.simulation },
      { devForceMood: input.devForceMood ?? 'auto' },
    );
  } else if (input.devForceMood !== undefined) {
    snapshot =
      input.devForceMood === 'auto'
        ? applyTemperSimulation(state.settings, readTemperSimulation(state.settings), {
            devForceMood: 'auto',
          })
        : applyDevMoodToTemper(state.settings, input.devForceMood);
  } else {
    throw new Error('syncDevTemper requires simulation or devForceMood.');
  }

  await writeDrainingSessionState(snapshot.drainingSession);
  const presentation = buildDevPreviewPresentation(
    state,
    snapshot.settings,
    snapshot.drainingSession,
  );
  // Save settings first: persistPresentation() re-reads settings from
  // storage to re-apply any forced dev mood. Persisting before saving would
  // read the OLD devForceMood and immediately stomp the override we just
  // computed (e.g. switching to "Peek" would silently revert to whatever
  // mood was forced before).
  await saveSettings(snapshot.settings, IS_DEV_BUILD);
  await persistPresentation(presentation);
  return {
    ...buildDevTemperPayload(
      snapshot.settings,
      snapshot.drainingSession,
      state.cat,
      state.isUserIdle,
      presentation,
    ),
    presentation,
  };
}

/** Dev-only: force Tabby to appear using the current dev mood override. */
export async function devForceCompanionShow(now: number): Promise<CatPresentation> {
  const state = await loadOrchestratorState();
  assertDevCompanionAccess(state.settings);
  const drainingSession = await readDrainingSessionState();
  const presentation = buildDevPreviewPresentation(state, state.settings, drainingSession, now);
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
