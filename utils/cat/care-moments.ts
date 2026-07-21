import { deriveMoodFromVitals, resolveLifeStage } from '../cat-sim';
import {
  clearFeedingCompleteAlarm,
  feedingMomentDue,
  feedingMunchSpeech,
  feedingThanksSpeech,
} from '../feeding-moment';
import { clearPlayingCompleteAlarm, playingMomentDue, playingThanksSpeech, playingWildSpeech } from '../play-moment';
import { buildPresentation } from '../presentation';
import type { CatPresentation } from '../types';
import type { OrchestratorState } from './types';
import { loadOrchestratorState, persistPresentation, serializePresentationWrite } from './state-io';

/**
 * The feeding ("treat" -> munching -> thank-you) and playing ("play" -> wild paws ->
 * thank-you) moments care actions can kick off — a short, timed detour from her normal
 * mood/ambient state, tracked via CatPresentation's eatingUntil/playingUntil fields and a
 * background alarm. Used both by the care-action reducer (starting a moment) and the
 * ambient tick (continuing or completing one in progress).
 */

export function buildFeedingContinuationPresentation(
  state: OrchestratorState,
  now: number,
  companionVisible: boolean,
): CatPresentation {
  const eatingUntil = state.lastPresentation!.eatingUntil!;
  const stage = resolveLifeStage(state.cat.adoptedAt, now, state.settings.devForceLifeStage);
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

export async function completeFeedingPresentation(
  state: OrchestratorState,
  now: number,
): Promise<OrchestratorState> {
  await clearFeedingCompleteAlarm();
  const stage = resolveLifeStage(state.cat.adoptedAt, now, state.settings.devForceLifeStage);
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

export function buildPlayingContinuationPresentation(
  state: OrchestratorState,
  now: number,
  companionVisible: boolean,
): CatPresentation {
  const playingUntil = state.lastPresentation!.playingUntil!;
  const stage = resolveLifeStage(state.cat.adoptedAt, now, state.settings.devForceLifeStage);
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

export async function completePlayingPresentation(
  state: OrchestratorState,
  now: number,
): Promise<OrchestratorState> {
  await clearPlayingCompleteAlarm();
  const stage = resolveLifeStage(state.cat.adoptedAt, now, state.settings.devForceLifeStage);
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
