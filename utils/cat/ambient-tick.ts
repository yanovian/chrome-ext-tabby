import { recordAppearance } from '../cat-sim';
import { recordAmbientAppearance } from '../ambient-presence';
import { clearExpiredDoNotDisturb } from '../do-not-disturb';
import { isIntroCompleted } from '../intro';
import { fallbackSpeech } from '../speech-fallback';
import { getMemories, recallMemory, saveCatState } from '../db';
import { evaluateEmotionalTrigger } from '../emotional-triggers';
import {
  acknowledgeDrainingNudge,
  acknowledgeRecoveryEasing,
  completeDrainingRecovery,
  readDrainingSessionState,
  writeDrainingSessionState,
} from '../draining-session';
import { feedingMomentDue, isFeedingActive } from '../feeding-moment';
import { isPlayingActive, playingMomentDue } from '../play-moment';
import { buildPresentation, moodOverrideWhileHiding } from '../presentation';
import { isEnteringPeekCycle, resolvePeekRestoreAmbient } from '../peek-restore';
import { isDevMoodForced } from '../settings';
import type { CatPresentation, ExtensionSettings, MemorySeed } from '../types';
import type { OrchestratorState, PageContext } from './types';
import { loadOrchestratorState, persistPresentation, reduceCat } from './state-io';
import {
  buildFeedingContinuationPresentation,
  buildPlayingContinuationPresentation,
  completeFeedingPresentation,
  completePlayingPresentation,
} from './care-moments';
import { buildDevPreviewPresentation } from './dev-tools';
import { resolveCompanionPresence } from './presence';

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

interface TickOptions {
  forceDevSpeech?: boolean;
  forceTick?: boolean;
  page?: PageContext;
  isUserIdle?: boolean;
}

/** The tick reducer's first job: is a feeding or playing moment due to finish, or still
 * running? Both are short-lived, self-contained interruptions of ambient behavior, checked
 * before touching the ambient/presence machine at all. Returns null to fall through to the
 * ambient recompute in computeAmbientTickState. */
async function computeMomentContinuationState(
  activeState: OrchestratorState,
  now: number,
  options: TickOptions,
): Promise<OrchestratorState | null> {
  const eatingUntil = activeState.lastPresentation?.eatingUntil;
  if (feedingMomentDue(eatingUntil, now)) {
    return completeFeedingPresentation(activeState, now);
  }
  if (isFeedingActive(eatingUntil, now)) {
    const companionVisible =
      activeState.lastPresentation?.companionVisible === true ||
      options.forceTick === true ||
      options.forceDevSpeech === true;
    const presentation = buildFeedingContinuationPresentation(activeState, now, companionVisible);
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
    const presentation = buildPlayingContinuationPresentation(activeState, now, companionVisible);
    await persistPresentation(presentation);
    return { ...activeState, lastPresentation: presentation };
  }

  return null;
}

export async function computeTickState(
  now: number,
  options: TickOptions,
): Promise<OrchestratorState> {
  const loaded = await loadOrchestratorState();
  const activeState: OrchestratorState =
    options.isUserIdle === undefined ? loaded : { ...loaded, isUserIdle: options.isUserIdle };

  const momentState = await computeMomentContinuationState(activeState, now, options);
  if (momentState) {
    return momentState;
  }

  return computeAmbientTickState(activeState, now, options);
}

/** The rest of the tick: no feeding/playing moment in progress, so decide what the ambient
 * system (peek/rest/idle) and any pending speech trigger should show right now. */
async function computeAmbientTickState(
  activeState: OrchestratorState,
  now: number,
  options: TickOptions,
): Promise<OrchestratorState> {
  const [memories, doNotDisturb, introCompleted] = await Promise.all([
    getMemories(),
    clearExpiredDoNotDisturb(now),
    isIntroCompleted(),
  ]);
  const recentMemory = await pickRecallCandidate(memories, now, activeState.settings);
  const drainingSession = await readDrainingSessionState();
  if (isDevMoodForced(activeState.settings)) {
    const presentation = buildDevPreviewPresentation(activeState, activeState.settings, drainingSession, now);
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

export async function pickRecallCandidate(
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
