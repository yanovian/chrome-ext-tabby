import { createInitialCat, deriveMoodFromVitals, resolveLifeStage } from '../cat-sim';
import {
  enterPeekDuckGap,
  isAmbientPeekDuckGapExpired,
  isAmbientPeekVisitExpired,
  isAmbientRestExpired,
  isStayVisibleAfterRevealExpired,
} from '../ambient-presence';
import { clearDoNotDisturb, clearExpiredDoNotDisturb, isDoNotDisturbActive } from '../do-not-disturb';
import { isIntroCompleted, resetIntro } from '../intro';
import { fallbackSpeech } from '../speech-fallback';
import { getCatState, saveCatState } from '../db';
import { feedingMomentDue } from '../feeding-moment';
import { playingMomentDue } from '../play-moment';
import { showPageOverlay } from '../page-overlay';
import { buildPresentation, patchPresentationForDevForce } from '../presentation';
import { readDrainingSessionState } from '../draining-session';
import { getSettings, isDevMoodForced } from '../settings';
import type { CatPresentation, CatState, ExtensionSettings } from '../types';
import { IS_DEV_BUILD, type OrchestratorState, type PageContext } from './types';
import {
  loadOrchestratorState,
  persistPresentation,
  readCachedPresentation,
  reduceCat,
  serializePresentationWrite,
} from './state-io';
import { completeFeedingIfDue, completePlayingIfDue } from './care-moments';
import { evaluateAndPresent, computeTickState } from './ambient-tick';
import { buildDevPreviewPresentation } from './dev-tools';

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

export async function computeShowOnPageState(
  now: number,
  page: PageContext = {},
): Promise<OrchestratorState> {
  await clearDoNotDisturb();
  await showPageOverlay(page.url);
  const state = await loadOrchestratorState();
  const stage = resolveLifeStage(state.cat.adoptedAt, now, state.settings.devForceLifeStage);
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

function presentationDuringDoNotDisturb(presentation: CatPresentation): CatPresentation {
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

/** Step: dev mode is forcing a mood — that preview always wins over any expiry check below. */
async function presentationForDevMoodForced(
  state: OrchestratorState,
  now: number,
): Promise<CatPresentation | null> {
  if (!isDevMoodForced(state.settings)) {
    return null;
  }
  const drainingSession = await readDrainingSessionState();
  const presentation = buildDevPreviewPresentation(state, state.settings, drainingSession, now);
  await persistPresentation(presentation);
  return presentation;
}

/** Step: a feeding or playing moment that was still running the last time we checked has
 * since finished — settle it into its thank-you presentation. */
async function presentationAfterMomentCompletion(
  cached: CatPresentation,
  state: OrchestratorState,
  now: number,
): Promise<CatPresentation | null> {
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
  return null;
}

/** Step: a visible peek visit's timer ran out since the last read (e.g. mid tab-switch) —
 * duck her into the gap before the next corner, same as a live tick would. */
async function presentationForPeekVisitExpiry(
  cached: CatPresentation,
  state: OrchestratorState,
  now: number,
): Promise<CatPresentation | null> {
  if (!isAmbientPeekVisitExpired(cached, now)) {
    return null;
  }
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

/** Whether enough has changed (duck gap over, stay-visible grace expired, rest expired, or
 * the intro still isn't done and she's hidden) that a full ambient recompute is owed. */
function presentationNeedsAmbientRecompute(
  cached: CatPresentation,
  introCompleted: boolean,
  now: number,
): boolean {
  return (
    isAmbientPeekDuckGapExpired(cached, now) ||
    isStayVisibleAfterRevealExpired(cached, now) ||
    isAmbientRestExpired(cached, now) ||
    (!introCompleted && !cached.companionVisible)
  );
}

export async function getCurrentPresentation(): Promise<CatPresentation> {
  const cached = await readCachedPresentation();
  const now = Date.now();
  const doNotDisturb = await clearExpiredDoNotDisturb(now);
  const introCompleted = await isIntroCompleted();

  if (!cached) {
    const settings = await getSettings(IS_DEV_BUILD);
    const result = await evaluateAndPresent(now);
    return finalizePresentation(result.lastPresentation!, settings, now);
  }

  if (isDoNotDisturbActive(doNotDisturb, now)) {
    return presentationDuringDoNotDisturb(cached);
  }

  const state = await loadOrchestratorState();

  const devForced = await presentationForDevMoodForced(state, now);
  if (devForced) {
    return devForced;
  }

  const afterMoment = await presentationAfterMomentCompletion(cached, state, now);
  if (afterMoment) {
    return afterMoment;
  }

  const peekExpiry = await presentationForPeekVisitExpiry(cached, state, now);
  if (peekExpiry) {
    return peekExpiry;
  }

  if (presentationNeedsAmbientRecompute(cached, introCompleted, now)) {
    const result = await evaluateAndPresent(now);
    return result.lastPresentation!;
  }

  return finalizePresentation(cached, state.settings, now);
}

/** Dev/testing: clear intro progress and show the tour again. */
export function restartIntroSession(now: number): Promise<CatPresentation> {
  return reduceCat({ type: 'restartIntro', now }).then((state) => state.lastPresentation!);
}

export async function computeRestartIntroState(now: number): Promise<OrchestratorState> {
  await resetIntro();
  return computeTickState(now, {});
}

/** Clear unprompted speech from the cached presentation. */
export function clearCompanionSpeech(now: number): Promise<CatPresentation> {
  return reduceCat({ type: 'clearSpeech', now }).then((state) => state.lastPresentation!);
}

export async function computeClearSpeechState(now: number): Promise<OrchestratorState> {
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

export async function computeSettleAfterIntroState(now: number): Promise<OrchestratorState> {
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
