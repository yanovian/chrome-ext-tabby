import { applyAskInteraction, applyCareAction, deriveMoodFromVitals, resolveLifeStage } from '../cat-sim';
import { explainCurrentMood, mapCareActionToInteraction, resolveAskMood, resolveHungryMood } from '../cat-interactions';
import { fallbackSpeech } from '../speech-fallback';
import { saveCatState } from '../db';
import {
  applyCareRecoveryCredit,
  isDrainingSessionOverwhelmed,
  isInDrainingRecovery,
  pendingRecoveryNudge,
  writeDrainingSessionState,
  type CareRecoveryAction,
  type DrainingSessionState,
} from '../draining-session';
import { feedingMunchSpeech, pickFeedingDurationMs, scheduleFeedingCompleteAlarm, shouldStartFeedingMoment } from '../feeding-moment';
import { pickPlayingDurationMs, playingWildSpeech, schedulePlayingCompleteAlarm } from '../play-moment';
import { hidePageOverlay } from '../page-overlay';
import { buildPresentation } from '../presentation';
import type { SpeechContext } from '../speech-types';
import type { CatLifeStage, CatMood, CatPresentation, CatState } from '../types';
import type { OrchestratorState, PageContext } from './types';
import { persistPresentation } from './state-io';

/** computeCareActionState (care-actions.ts) has already handled do-not-disturb, reveal, and
 * shoo by the time it calls into here — this is the only action set that actually reaches
 * this file, spelled out so the functions below don't have to accept the full CareAction
 * union and pretend to handle cases that can't reach them. */
type GeneralCareAction = 'pet' | 'treat' | 'play' | 'ask' | 'dismiss';

function recoveryCreditAction(action: GeneralCareAction): CareRecoveryAction | null {
  return action === 'pet' || action === 'play' ? action : null;
}

/** The pet/treat/play/ask/dismiss branch of a care action — everything that isn't a
 * do-not-disturb, reveal, or shoo short-circuit (see care-actions.ts). Split into resolving
 * "what happened" (resolveCareOutcome) and "what she looks like now" (applyCareOutcome). */
export async function computeGeneralCareState(
  state: OrchestratorState,
  action: GeneralCareAction,
  now: number,
  page: PageContext,
  drainingSession: DrainingSessionState,
): Promise<OrchestratorState> {
  const recoveryAction = recoveryCreditAction(action);
  const creditedSession = recoveryAction
    ? applyCareRecoveryCredit(drainingSession, recoveryAction, state.settings)
    : drainingSession;
  if (creditedSession !== drainingSession) {
    await writeDrainingSessionState(creditedSession);
  }
  const outcome = await resolveCareOutcome(state, action, now, page, creditedSession);
  return applyCareOutcome(state, action, now, outcome, creditedSession);
}

function careSpeechKind(action: GeneralCareAction): SpeechContext['kind'] | null {
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

interface CareOutcome {
  cat: CatState;
  mood: CatMood;
  moodOverride: CatMood | undefined;
  triggerKind: CatPresentation['triggerKind'];
  speech: string | null;
  eatingUntil: number | null;
  playingUntil: number | null;
  stage: CatLifeStage;
  startFeedingMoment: boolean;
  startPlayingMoment: boolean;
  endsAmbientVisit: boolean;
}

/** Work out what pet/treat/play/ask/dismiss does to the cat, her mood, and what she says —
 * everything except building the final presentation and scheduling timers (see
 * applyCareOutcome). Still has real side effects (saveCatState) since the vitals change is
 * part of "what happened," just not the presentation-shaped part of it. */
async function resolveCareOutcome(
  state: OrchestratorState,
  action: GeneralCareAction,
  now: number,
  page: PageContext,
  drainingSession: DrainingSessionState,
): Promise<CareOutcome> {
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
    moodOverride = resolveAskMood(cat.vitals, derivedMood, displayMoodBeforeCare, cat, now);
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
      moodOverride = resolveMoodOverrideAfterCare(cat, now, state, drainingSession);
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
    speech = resolveCareSpeech(action, mood, hungryBeforeCare, stage, now, page, speechKind, cat);
  }

  return {
    cat,
    mood,
    moodOverride,
    triggerKind,
    speech,
    eatingUntil,
    playingUntil,
    stage,
    startFeedingMoment,
    startPlayingMoment,
    endsAmbientVisit,
  };
}

function resolveMoodOverrideAfterCare(
  cat: CatState,
  now: number,
  state: OrchestratorState,
  drainingSession: DrainingSessionState,
): CatMood {
  const derivedAfterCare = deriveMoodFromVitals({
    vitals: cat.vitals,
    cat,
    now,
    settings: state.settings,
    isUserIdle: state.isUserIdle,
  });
  const urgentMoods: CatMood[] = ['starving', 'hungry', 'sleepy'];
  if (isInDrainingRecovery(drainingSession)) {
    return pendingRecoveryNudge(drainingSession) === 'thanks' ? 'happy' : 'stressed';
  }
  if (
    !urgentMoods.includes(derivedAfterCare) &&
    isDrainingSessionOverwhelmed(drainingSession, state.settings)
  ) {
    return 'overwhelmed';
  }
  return derivedAfterCare;
}

function resolveCareSpeech(
  action: GeneralCareAction,
  mood: CatMood,
  hungryBeforeCare: CatMood | null,
  stage: CatLifeStage,
  now: number,
  page: PageContext,
  speechKind: SpeechContext['kind'],
  cat: CatState,
): string {
  if (action === 'ask') {
    return explainCurrentMood(mood, cat.vitals, stage, now);
  }
  if (action === 'pet' && hungryBeforeCare) {
    return fallbackSpeech({
      kind: 'care_pet_hungry',
      mood: hungryBeforeCare,
      stage,
      seed: now,
      pageTopic: page.topic,
    });
  }
  const context: SpeechContext = {
    kind: speechKind,
    mood,
    stage,
    seed: now,
    pageTopic: page.topic,
  };
  return fallbackSpeech(context);
}

/** Turn a resolved care outcome into the final presentation, timers, and persisted write. */
async function applyCareOutcome(
  state: OrchestratorState,
  action: GeneralCareAction,
  now: number,
  outcome: CareOutcome,
  drainingSession: DrainingSessionState,
): Promise<OrchestratorState> {
  const {
    cat,
    triggerKind,
    speech,
    moodOverride,
    eatingUntil,
    playingUntil,
    startFeedingMoment,
    startPlayingMoment,
    endsAmbientVisit,
  } = outcome;

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
