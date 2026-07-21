/**
 * Tabby's single source of truth: what she looks like, where she is, what she's doing, and
 * what she's saying right now — plus the one reducer that's allowed to change any of it.
 *
 * The state shape (OrchestratorState/CatPresentation) and the state I/O (loadOrchestratorState,
 * persistPresentation, readCachedPresentation) live here because they're not generic browser
 * plumbing — they're what "the Cat" is made of. Every entrypoint (background alarms, care-action
 * messages, tab activation, dev tools) funnels through reduceCat below, so every tab reads the
 * same computed presentation instead of maintaining its own partial view of her.
 *
 * utils/orchestrator.ts keeps only genuine browser-extension glue (page-visit vitals scoring,
 * the minute-tick alarm handler, per-page overlay-hidden tracking, DND wrappers) built on top
 * of what's exported here.
 */
import {
  applyAskInteraction,
  applyCareAction,
  createInitialCat,
  deriveMoodFromVitals,
  recordAppearance,
  resolveLifeStage,
} from './cat-sim';
import {
  enterPeekDuckGap,
  isAmbientPeekActive,
  isAmbientPeekDuckGapActive,
  isAmbientPeekDuckGapExpired,
  isAmbientPeekVisitExpired,
  isAmbientRestExpired,
  isDaytime,
  isStayVisibleAfterReveal,
  isStayVisibleAfterRevealExpired,
  pickAmbientPeekDurationMs,
  pickAmbientPeekVisitDurationMs,
  pickAmbientRestActivity,
  pickPeekPlacement,
  pickStayVisibleAfterRevealMs,
  recordAmbientAppearance,
  shouldStartAmbientRest,
  type AmbientActivity,
  type PeekCorner,
  type PeekEdge,
} from './ambient-presence';
import {
  careActionToDoNotDisturb,
  clearDoNotDisturb,
  clearExpiredDoNotDisturb,
  isDoNotDisturbActive,
  setDoNotDisturb,
  type DoNotDisturbState,
} from './do-not-disturb';
import { explainCurrentMood, mapCareActionToInteraction, resolveAskMood, resolveHungryMood } from './cat-interactions';
import { isIntroCompleted, resetIntro } from './intro';
import { isSleepDeferred } from './mood-grace';
import { fallbackSpeech, previewRecoverySpeech } from './speech-fallback';
import { getCatState, getMemories, recallMemory, saveCatState } from './db';
import { evaluateEmotionalTrigger, type EmotionalTriggerResult } from './emotional-triggers';
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
  type DrainingSessionState,
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
import { hidePageOverlay, showPageOverlay } from './page-overlay';
import { buildPresentation, isPeekPresentation, moodOverrideWhileHiding, patchPresentationForDevForce } from './presentation';
import { isEnteringPeekCycle, resolvePeekRestoreAmbient } from './peek-restore';
import type { SpeechContext } from './speech-types';
import { getSettings, isDevMoodForced, saveSettings } from './settings';
import type {
  CareAction,
  CatMood,
  CatPresentation,
  CatState,
  DevMoodOverride,
  ExtensionSettings,
  MemorySeed,
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

/**
 * Every kind of thing that can change what Tabby looks like right now. See reduceCat below —
 * this is the only way into it. (Two dev-only tools, syncDevTemperControls and
 * getDevTemperState, stay outside this union: they return a richer testing/preview payload
 * that doesn't fit "the next OrchestratorState," not a different presentation-computing
 * pathway — they still go through the same serialization queue as everything here.)
 */
export type CatEvent =
  | { type: 'careAction'; action: CareAction; now: number; page: PageContext }
  | {
      type: 'tick';
      now: number;
      page?: PageContext;
      forceDevSpeech?: boolean;
      forceTick?: boolean;
      isUserIdle?: boolean;
    }
  | { type: 'showOnPage'; now: number; page: PageContext }
  | { type: 'clearSpeech'; now: number }
  | { type: 'settleAfterIntro'; now: number }
  | { type: 'restartIntro'; now: number }
  | { type: 'devPreview'; now: number }
  | { type: 'devHide'; now: number };

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
  const [settings, stored] = await Promise.all([
    getSettings(IS_DEV_BUILD),
    readCachedPresentation(),
  ]);
  const finalized = patchPresentationForDevForce(presentation, settings, now, stored);
  await browser.storage.local.set({
    [STORAGE_KEYS.presentation]: finalized,
  });
}

export async function readCachedPresentation(): Promise<CatPresentation | null> {
  const result = await browser.storage.local.get([STORAGE_KEYS.presentation]);
  return (result[STORAGE_KEYS.presentation] as CatPresentation | undefined) ?? null;
}

/**
 * Serializes overlapping presentation reads+writes (e.g. a care action racing the
 * background's tab-switch recompute, or a popup-triggered dev preview racing an
 * ambient tick): each call reads the cached presentation, computes a new one, then
 * persists it, and without serialization a slow call's read-then-write can straddle
 * a faster call's write and silently clobber it with stale data on completion.
 * Queuing calls one after another means every read always sees the previous call's
 * finished write. reduceCat is the only thing that uses this directly — every other
 * presentation-computing function (dev preview, clear speech, settle-after-intro, etc.)
 * still calls it individually since those are narrower, one-off operations, not part of
 * the care-action/ambient-recompute duo reduceCat exists to keep from racing each other.
 */
let presentationQueue: Promise<unknown> = Promise.resolve();

function serializePresentationWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = presentationQueue.then(task);
  presentationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * THE single place that decides what Tabby's presentation becomes for a care action or an
 * ambient recompute — the two categories every normal-user-facing trigger falls into. Every
 * caller builds a CatEvent and calls this rather than reading-computing-persisting on its
 * own; it owns that whole cycle, including serialization, so two different kinds of event
 * (e.g. a care action and a tab-switch recompute landing around the same time) can never
 * race each other and silently clobber one's result with the other's stale read.
 */
export function reduceCat(event: CatEvent): Promise<OrchestratorState> {
  return serializePresentationWrite(() => runReduceCat(event));
}

async function runReduceCat(event: CatEvent): Promise<OrchestratorState> {
  switch (event.type) {
    case 'careAction':
      return computeCareActionState(event.action, event.now, event.page);
    case 'tick':
      return computeTickState(event.now, {
        page: event.page,
        forceDevSpeech: event.forceDevSpeech,
        forceTick: event.forceTick,
        isUserIdle: event.isUserIdle,
      });
    case 'showOnPage':
      return computeShowOnPageState(event.now, event.page);
    case 'clearSpeech':
      return computeClearSpeechState(event.now);
    case 'settleAfterIntro':
      return computeSettleAfterIntroState(event.now);
    case 'restartIntro':
      return computeRestartIntroState(event.now);
    case 'devPreview':
      return computeDevPreviewState(event.now);
    case 'devHide':
      return computeDevHideState(event.now);
  }
}

/** Recompute mood and speech for the tab the user is viewing right now. */
export function presentOnActiveTab(
  now: number,
  page: PageContext,
  options: { forceDevSpeech?: boolean; forceTick?: boolean } = {},
): Promise<OrchestratorState> {
  return reduceCat({ type: 'tick', now, page, ...options });
}

export async function setUserIdle(isUserIdle: boolean): Promise<void> {
  await reduceCat({ type: 'tick', now: Date.now(), isUserIdle });
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
export function completeFeedingIfDue(now: number): Promise<CatPresentation | null> {
  return serializePresentationWrite(async () => {
    const state = await loadOrchestratorState();
    if (!feedingMomentDue(state.lastPresentation?.eatingUntil, now)) {
      return null;
    }
    const next = await completeFeedingPresentation(state, now);
    return next.lastPresentation;
  });
}

/** Finish wild play and show a happy thank-you line when the play timer ends. */
export function completePlayingIfDue(now: number): Promise<CatPresentation | null> {
  return serializePresentationWrite(async () => {
    const state = await loadOrchestratorState();
    if (!playingMomentDue(state.lastPresentation?.playingUntil, now)) {
      return null;
    }
    const next = await completePlayingPresentation(state, now);
    return next.lastPresentation;
  });
}

export function handleCareAction(
  action: CareAction,
  now: number,
  page: PageContext = {},
): Promise<CatPresentation> {
  return reduceCat({ type: 'careAction', action, now, page }).then((state) => state.lastPresentation!);
}

async function computeCareActionState(
  action: CareAction,
  now: number,
  page: PageContext = {},
): Promise<OrchestratorState> {
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
    return { ...state, lastPresentation: presentation };
  }

  const state = await loadOrchestratorState();
  const drainingSession = await readDrainingSessionState();

  if (action === 'reveal') {
    const last = state.lastPresentation;
    // Check the whole peek cycle (ambientActivity), not just the visible
    // moment (isPeekPresentation): between visits she's hidden in a "duck
    // gap" with companionVisible false, but mood still reads 'peek'. That
    // gap isn't a real resting mood — tapping her mid-gap must still
    // restore the real one, not fall through and leave her hidden.
    if (!last || last.ambientActivity !== 'peeking') {
      if (last) {
        return { ...state, lastPresentation: last };
      }
      // Call the tick computation directly (not the public, re-serializing
      // reduceCat/evaluateAndPresent wrapper) — we're already running inside
      // reduceCat's own queued task, and queuing another task behind ourselves
      // here would deadlock waiting for a slot that can't open until we return.
      return computeTickState(now, {});
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
    return { ...state, lastPresentation: presentation };
  }

  if (action === 'shoo') {
    const last = state.lastPresentation;
    if (last && isPeekPresentation(last)) {
      return { ...state, lastPresentation: last };
    }
    const restore = resolvePeekRestoreAmbient(last, true);
    const presentation = buildPresentation({
      cat: state.cat,
      vitals: state.cat.vitals,
      settings: state.settings,
      now,
      isUserIdle: state.isUserIdle,
      speech: null,
      triggerKind: null,
      overlayHidden: last?.overlayHidden ?? false,
      lastCareAction: 'shoo',
      companionVisible: true,
      ambientPeekUntil:
        now + pickAmbientPeekVisitDurationMs(state.settings, now, state.cat.adoptedAt),
      peekRestoreAmbientActivity: restore.peekRestoreAmbientActivity,
      peekRestoreAmbientUntil: restore.peekRestoreAmbientUntil,
      moodOverride: 'peek',
      drainingSession,
    });
    await persistPresentation(presentation);
    return { ...state, lastPresentation: presentation };
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
  return { ...state, cat, lastPresentation: presentation };
}

/** Recompute mood/speech/position from current vitals, time, and any pending speech trigger
 * — the ambient half of "what does Tabby look like now" (see reduceCat for the other half,
 * explicit care actions). Always reads fresh state itself rather than trusting a
 * previously-loaded snapshot, since by the time this runs (after the serialization queue)
 * anything the caller read earlier may be stale. */
export function evaluateAndPresent(
  now: number,
  options: {
    forceDevSpeech?: boolean;
    forceTick?: boolean;
    page?: PageContext;
    isUserIdle?: boolean;
  } = {},
): Promise<OrchestratorState> {
  return reduceCat({ type: 'tick', now, ...options });
}

async function computeTickState(
  now: number,
  options: {
    forceDevSpeech?: boolean;
    forceTick?: boolean;
    page?: PageContext;
    isUserIdle?: boolean;
  },
): Promise<OrchestratorState> {
  const loaded = await loadOrchestratorState();
  const activeState: OrchestratorState =
    options.isUserIdle === undefined ? loaded : { ...loaded, isUserIdle: options.isUserIdle };

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

  const resolvedPresence = resolveCompanionPresence({
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

  if (resolvedPresence.recordSpeech && trigger.triggerKind) {
    cat = recordAppearance(cat, now);
    await saveCatState(cat);
    if (trigger.triggerKind === 'memory' && recentMemory) {
      await recallMemory(now);
    }
  } else if (resolvedPresence.recordAmbient) {
    cat = recordAmbientAppearance(cat, now);
    await saveCatState(cat);
  }

  let speech: string | null = null;
  const triggerKind: CatPresentation['triggerKind'] = resolvedPresence.recordSpeech
    ? trigger.triggerKind
    : null;

  if (resolvedPresence.recordSpeech && trigger.speechContext) {
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
    resolvedPresence.ambientActivity,
    resolvedPresence.companionVisible,
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
    companionVisible: resolvedPresence.companionVisible,
    ambientActivity: resolvedPresence.ambientActivity,
    ambientPeekUntil: resolvedPresence.ambientPeekUntil,
    peekEdge: resolvedPresence.peekEdge,
    peekInset: resolvedPresence.peekInset,
    peekCorner: resolvedPresence.peekCorner,
    peekRestoreAmbientActivity: peekRestore.peekRestoreAmbientActivity,
    peekRestoreAmbientUntil: peekRestore.peekRestoreAmbientUntil,
    stayVisibleUntil: activeState.lastPresentation?.stayVisibleUntil ?? null,
    eatingUntil: null,
    playingUntil: null,
    moodOverride: moodOverrideWhileHiding(
      activeState.lastPresentation?.mood,
      resolvedPresence.companionVisible,
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

/**
 * Marks "the user just did something with her" without changing what she looks like or her
 * vitals — opening or closing the care menu counts as an interaction for the purpose of
 * deferring automatic ambient behavior (see isSleepDeferred's use in decideIdleAmbient), even
 * when it doesn't end in an actual care action. Queued alongside presentation writes so it
 * can't race a concurrent care action's own read-modify-write of the same cat record.
 */
export function recordInteractionPing(now: number): Promise<void> {
  return serializePresentationWrite(async () => {
    const cat = await getCatState(now);
    if (!cat) {
      return;
    }
    await saveCatState({ ...cat, lastCareAt: now });
  });
}

export function showOverlayOnPage(
  now: number,
  page: PageContext = {},
): Promise<CatPresentation> {
  return reduceCat({ type: 'showOnPage', now, page }).then((state) => state.lastPresentation!);
}

async function computeShowOnPageState(
  now: number,
  page: PageContext = {},
): Promise<OrchestratorState> {
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
  return { ...state, lastPresentation: presentation };
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
      const gap = enterPeekDuckGap(now, state.settings, state.cat.adoptedAt);
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
        ambientActivity: gap.ambientActivity,
        ambientPeekUntil: gap.ambientPeekUntil,
        peekEdge: cached.peekEdge,
        peekInset: cached.peekInset,
        peekCorner: cached.peekCorner,
        peekRestoreAmbientActivity: cached.peekRestoreAmbientActivity,
        peekRestoreAmbientUntil: cached.peekRestoreAmbientUntil,
        eatingUntil: cached.eatingUntil,
        playingUntil: cached.playingUntil,
        moodOverride: 'peek',
        drainingSession: await readDrainingSessionState(),
      });
      await persistPresentation(hiding);
      return hiding;
    }
    if (
      isAmbientPeekDuckGapExpired(cached, now) ||
      isStayVisibleAfterRevealExpired(cached, now) ||
      isAmbientRestExpired(cached, now) ||
      (!introCompleted && !cached.companionVisible)
    ) {
      const result = await evaluateAndPresent(now);
      return result.lastPresentation!;
    }
    return finalizePresentation(cached, state.settings, now);
  }

  const settings = await getSettings(IS_DEV_BUILD);
  const result = await evaluateAndPresent(now);
  return finalizePresentation(result.lastPresentation!, settings, now);
}

/** Dev/testing: clear intro progress and show the tour again. */
export function restartIntroSession(now: number): Promise<CatPresentation> {
  return reduceCat({ type: 'restartIntro', now }).then((state) => state.lastPresentation!);
}

async function computeRestartIntroState(now: number): Promise<OrchestratorState> {
  await resetIntro();
  return computeTickState(now, {});
}

function assertDevCompanionAccess(settings: ExtensionSettings): void {
  if (!IS_DEV_BUILD || !settings.devModeEnabled) {
    throw new Error('Dev companion controls require dev mode in a dev build.');
  }
}

export interface DevTemperPayload {
  settings: ExtensionSettings;
  simulation: TemperSimulation;
  previewMood: CatMood;
  inferredMood: CatMood;
  drainingSession: DrainingSessionState;
  presentation: CatPresentation;
}

function devPreviewSpeech(drainingSession: DrainingSessionState): string | null {
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
  state: OrchestratorState,
  settings: ExtensionSettings,
  drainingSession: DrainingSessionState,
  now = Date.now(),
): CatPresentation {
  const moodOverride = isDevMoodForced(settings) ? settings.devForceMood : undefined;
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
    companionVisible: moodOverride ? true : (last?.companionVisible ?? true),
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
  session: DrainingSessionState,
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
export function syncDevTemperControls(input: {
  simulation?: Partial<TemperSimulation>;
  devForceMood?: DevMoodOverride;
}): Promise<DevTemperPayload & { presentation: CatPresentation }> {
  return serializePresentationWrite(() => runSyncDevTemperControls(input));
}

async function runSyncDevTemperControls(input: {
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
export function devForceCompanionShow(now: number): Promise<CatPresentation> {
  return reduceCat({ type: 'devPreview', now }).then((state) => state.lastPresentation!);
}

async function computeDevPreviewState(now: number): Promise<OrchestratorState> {
  const state = await loadOrchestratorState();
  assertDevCompanionAccess(state.settings);
  const drainingSession = await readDrainingSessionState();
  const presentation = buildDevPreviewPresentation(state, state.settings, drainingSession, now);
  await persistPresentation(presentation);
  return { ...state, lastPresentation: presentation };
}

/** Dev-only: force Tabby to hide on the active tab right away. */
export function devForceCompanionHide(now: number): Promise<CatPresentation> {
  return reduceCat({ type: 'devHide', now }).then((state) => state.lastPresentation!);
}

async function computeDevHideState(now: number): Promise<OrchestratorState> {
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
  return { ...state, lastPresentation: presentation };
}

/** Clear unprompted speech from the cached presentation. */
export function clearCompanionSpeech(now: number): Promise<CatPresentation> {
  return reduceCat({ type: 'clearSpeech', now }).then((state) => state.lastPresentation!);
}

async function computeClearSpeechState(now: number): Promise<OrchestratorState> {
  const state = await loadOrchestratorState();
  const last = state.lastPresentation;
  if (last) {
    const cleared = { ...last, speech: null, triggerKind: null };
    await persistPresentation(cleared);
    return { ...state, lastPresentation: cleared };
  }

  // No presentation yet at all: there's nothing to fall back to, so this is the same as a
  // brand-new one with nothing ambient going on.
  const presentation = buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech: null,
    triggerKind: null,
    overlayHidden: false,
    lastCareAction: null,
    companionVisible: true,
    ambientActivity: null,
    ambientPeekUntil: null,
  });
  await persistPresentation(presentation);
  return { ...state, lastPresentation: presentation };
}

/** After intro ends, keep Tabby visible and never carry speech over. */
export function settleAfterIntro(now: number): Promise<CatPresentation> {
  return reduceCat({ type: 'settleAfterIntro', now }).then((state) => state.lastPresentation!);
}

async function computeSettleAfterIntroState(now: number): Promise<OrchestratorState> {
  const state = await loadOrchestratorState();
  const base =
    state.lastPresentation ??
    buildPresentation({
      cat: state.cat,
      vitals: state.cat.vitals,
      settings: state.settings,
      now,
      isUserIdle: state.isUserIdle,
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      lastCareAction: null,
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
  return { ...state, lastPresentation: settled };
}

// --- Ambient phase state machine ------------------------------------------------------
//
// Tabby's ambient behavior (peek / rest / idle) is a small timed state machine layered on
// top of the flat CatPresentation fields (ambientActivity, ambientPeekUntil, stayVisibleUntil,
// companionVisible). Reading those fields as a growing cascade of independent "is this
// expired/active" checks — in whatever order they happened to get written — is exactly how
// this drifted into bugs before: a new case could slot into the wrong spot in the cascade, or
// two branches could overlap in ways that were hard to see at a glance. classifyAmbientPhase
// turns the flat fields into one clear tag; the switch below it is the single place that
// decides what happens next for each phase. New behavior only ever needs a new case, not a
// new boolean threaded through the whole cascade.

export interface ResolvedPresence {
  companionVisible: boolean;
  ambientActivity: AmbientActivity | null;
  ambientPeekUntil: number | null;
  peekEdge: PeekEdge | null;
  peekInset: number | null;
  peekCorner: PeekCorner | null;
  recordSpeech: boolean;
  recordAmbient: boolean;
}

function isSpeechTriggerActive(speechTrigger: EmotionalTriggerResult): boolean {
  return (
    speechTrigger.shouldAppear &&
    speechTrigger.speechContext !== null &&
    speechTrigger.triggerKind !== null
  );
}

function isUrgentSpeechTrigger(speechTrigger: EmotionalTriggerResult): boolean {
  return (
    speechTrigger.triggerKind === 'hungry' || speechTrigger.triggerKind === 'starving'
  );
}

const HIDDEN_PRESENCE: ResolvedPresence = {
  companionVisible: false,
  ambientActivity: null,
  ambientPeekUntil: null,
  peekEdge: null,
  peekInset: null,
  peekCorner: null,
  recordSpeech: false,
  recordAmbient: false,
};

/** Build a resolved presence, defaulting unset fields to fully hidden/not-peeking. */
function presence(overrides: Partial<ResolvedPresence>): ResolvedPresence {
  return { ...HIDDEN_PRESENCE, ...overrides };
}

function startPeekVisit(input: {
  cat: CatState;
  settings: ExtensionSettings;
  now: number;
  recordAmbient: boolean;
}): ResolvedPresence {
  const placement = pickPeekPlacement(input.now + input.cat.adoptedAt);
  return presence({
    companionVisible: true,
    ambientActivity: 'peeking',
    ambientPeekUntil:
      input.now +
      pickAmbientPeekVisitDurationMs(input.settings, input.now, input.cat.adoptedAt),
    peekEdge: placement.edge,
    peekInset: placement.inset,
    peekCorner: placement.corner,
    recordAmbient: input.recordAmbient,
  });
}

type AmbientPhase =
  | 'idle' // nothing ambient going on
  | 'peekVisible' // visibly peeking from a screen edge
  | 'peekHidden' // ducked away between peek visits ("duck gap")
  | 'resting' // sleeping/grooming, fully hidden
  | 'stayVisible'; // just revealed from peek — grace window before ambient can resume

function classifyAmbientPhase(last: CatPresentation | null): AmbientPhase {
  if (!last) {
    return 'idle';
  }
  // Mutually exclusive with the other phases by construction: buildPresentation always nulls
  // stayVisibleUntil while peeking, so this can only be set when nothing else claims the slot.
  if (last.stayVisibleUntil !== null) {
    return 'stayVisible';
  }
  if (last.ambientActivity === 'peeking') {
    return last.companionVisible ? 'peekVisible' : 'peekHidden';
  }
  if (last.ambientActivity === 'sleeping' || last.ambientActivity === 'grooming') {
    return 'resting';
  }
  return 'idle';
}

/** What happens next for each ambient phase, given the current cat/settings/time. This is
 * the one switch that used to be a dozen independent, order-sensitive boolean checks. */
function advanceAmbientPhase(input: {
  cat: CatState;
  settings: ExtensionSettings;
  now: number;
  last: CatPresentation | null;
}): ResolvedPresence {
  const { cat, settings, now, last } = input;
  const previousUntil = last?.ambientPeekUntil ?? null;
  const previousActivity = last?.ambientActivity ?? null;

  switch (classifyAmbientPhase(last)) {
    case 'stayVisible': {
      if (isStayVisibleAfterReveal(last!, now)) {
        // Still-active grace window: keep showing whatever reveal restored (or nothing, if
        // it restored back into another peek — that's not a real resting mood to hold onto).
        return presence({
          companionVisible: true,
          ambientActivity: previousActivity === 'peeking' ? null : previousActivity,
          ambientPeekUntil: previousActivity === 'peeking' ? null : previousUntil,
        });
      }
      if (isStayVisibleAfterRevealExpired(last!, now)) {
        // Grace window over: always resume the normal ambient cycle from a fresh peek,
        // regardless of what reveal had restored — that's the intended landing spot, not a
        // fallback (see "returns to peeking after stay-visible ends" in presence.test.ts).
        return startPeekVisit({ cat, settings, now, recordAmbient: false });
      }
      return presence({});
    }

    case 'peekVisible':
      if (isAmbientPeekVisitExpired(last!, now)) {
        // The visible visit's timer can run out between presentation reads (e.g. the user
        // switches tabs partway through it) without anything having ducked her away yet.
        return presence(enterPeekDuckGap(now, settings, cat.adoptedAt));
      }
      return presence({
        companionVisible: true,
        ambientActivity: 'peeking',
        ambientPeekUntil: previousUntil,
        peekEdge: last!.peekEdge ?? null,
        peekInset: last!.peekInset ?? null,
        peekCorner: last!.peekCorner ?? null,
      });

    case 'peekHidden':
      if (isAmbientPeekDuckGapActive(last!, now)) {
        return presence({ ambientActivity: 'peeking', ambientPeekUntil: previousUntil });
      }
      // Duck gap over: peek again from a fresh corner.
      return startPeekVisit({ cat, settings, now, recordAmbient: false });

    case 'resting':
      if (isAmbientPeekActive(previousUntil, now)) {
        return presence({
          companionVisible: last!.companionVisible,
          ambientActivity: previousActivity,
          ambientPeekUntil: previousUntil,
        });
      }
      // Rest timer over: a visible rest (from a restored grooming, say) picks back up with a
      // fresh peek immediately; a hidden one defers to the same "what should ambient do right
      // now" decision idle uses below — it must not keep showing the just-expired timer.
      if (last!.companionVisible) {
        return startPeekVisit({ cat, settings, now, recordAmbient: false });
      }
      return decideIdleAmbient({ cat, settings, now, restUntil: previousUntil });

    case 'idle':
      return decideIdleAmbient({ cat, settings, now, restUntil: previousUntil });
  }
}

/** What ambient state (if any) should start from a standing idle position: a fresh (visible)
 * rest if one's due, a fresh peek during daytime, or nothing. Shared by the 'idle' phase and
 * by 'resting' once its timer has run out with nothing else to show — both ask the same
 * question. */
function decideIdleAmbient(input: {
  cat: CatState;
  settings: ExtensionSettings;
  now: number;
  restUntil: number | null;
}): ResolvedPresence {
  const { cat, settings, now, restUntil } = input;
  if (
    shouldStartAmbientRest({ cat, settings, now, speechWouldAppear: false, restUntil })
  ) {
    // Napping/grooming is ambient flavor, not a reason to vanish — she stays on screen the
    // whole time. The only state that's ever allowed to hide her is the brief peek duck-gap
    // between corners (enterPeekDuckGap), which the phases below handle on their own.
    return presence({
      companionVisible: true,
      ambientActivity: pickAmbientRestActivity(now),
      ambientPeekUntil: now + pickAmbientPeekDurationMs(settings, now, cat.adoptedAt),
      recordAmbient: true,
    });
  }
  if (!isDaytime(new Date(now).getHours(), settings)) {
    // Nighttime idle stays hidden regardless of the care-grace period below — that period
    // only ever holds off starting something new during the day, it never overrides "it's
    // quiet hours, stay hidden."
    return presence({});
  }
  // shouldStartAmbientRest already defers a fresh rest until a bit after the last interaction
  // (isSleepDeferred); a fresh peek visit needs that same settle period, or she'd start
  // peeking the moment an interaction ends and the next tick happens to run (e.g. within a
  // minute, via the periodic alarm) — nothing should start on its own right after the user
  // just did something with her. She stays exactly as visible as she already was — deferring
  // ambient activity must not be confused with hiding her (presence({}) defaults to hidden).
  if (isSleepDeferred(cat, now)) {
    return presence({ companionVisible: true });
  }
  return startPeekVisit({ cat, settings, now, recordAmbient: true });
}

export function resolveCompanionPresence(input: {
  cat: CatState;
  settings: ExtensionSettings;
  now: number;
  isUserIdle: boolean;
  speechTrigger: EmotionalTriggerResult;
  doNotDisturb: DoNotDisturbState;
  introCompleted: boolean;
  lastPresentation: CatPresentation | null;
  forceVisible?: boolean;
}): ResolvedPresence {
  if (isDoNotDisturbActive(input.doNotDisturb, input.now)) {
    return presence({});
  }

  if (!input.introCompleted) {
    return presence({
      companionVisible: true,
      recordSpeech:
        input.forceVisible === true && isSpeechTriggerActive(input.speechTrigger),
    });
  }

  if (input.forceVisible) {
    const speechActive = isSpeechTriggerActive(input.speechTrigger);
    const peekCycleActive = input.lastPresentation?.ambientActivity === 'peeking';
    // A forced recompute (a dev "force tick", or a tab regaining focus while forceDevSpeech
    // is on) must not cancel a peek already in progress — every focus change would otherwise
    // silently bounce her back to her pre-peek mood the instant the user switched tabs. Defer
    // to the same ambient-phase machine an unforced recompute uses, same exception for urgent
    // speech as the check below.
    if (peekCycleActive && !(speechActive && isUrgentSpeechTrigger(input.speechTrigger))) {
      return advanceAmbientPhase({
        cat: input.cat,
        settings: input.settings,
        now: input.now,
        last: input.lastPresentation,
      });
    }
    return presence({
      companionVisible: true,
      recordSpeech: speechActive,
    });
  }

  // No isDevMoodForced check here: resolveCompanionPresence has exactly one caller
  // (the tick reducer), which already branches to buildDevPreviewPresentation and returns
  // before ever reaching this function when dev mode forces a mood.
  if (isDevMoodForced(input.settings)) {
    return presence({ companionVisible: true });
  }

  const speechActive = isSpeechTriggerActive(input.speechTrigger);
  const peekCycleActive = input.lastPresentation?.ambientActivity === 'peeking';

  // Non-urgent speech never interrupts an active peek cycle (ambient peeking runs on its own
  // timer and would otherwise duck her out mid-visit for no reason); an urgent one (hungry,
  // starving) always does — she shouldn't hide real distress behind a peek.
  if (speechActive && !(peekCycleActive && !isUrgentSpeechTrigger(input.speechTrigger))) {
    return presence({ companionVisible: true, recordSpeech: true });
  }

  return advanceAmbientPhase({
    cat: input.cat,
    settings: input.settings,
    now: input.now,
    last: input.lastPresentation,
  });
}
