import { buildInteractionOptions, buildSecondaryInteractionOptions } from './cat-interactions';
import { deriveMoodFromVitals, resolveLifeStage } from './cat-sim';
import { resolveCompanionAnimation } from './companion-animation';
import { isFeedingActive } from './feeding-moment';
import { isPlayingActive } from './play-moment';
import { lifeStageLabel } from './sprites';
import type { AmbientActivity } from './ambient-presence';
import type { CatPresentation, CatState, CatVitals, ExtensionSettings, CatMood } from './types';

export function moodForAmbient(activity: AmbientActivity): CatMood {
  if (activity === 'sleeping') {
    return 'sleepy';
  }
  if (activity === 'peeking') {
    return 'peek';
  }
  return 'content';
}

/** Pick the mood shown on screen — dev override, ambient activity, or vitals. */
export function resolveDisplayMood(input: {
  settings: ExtensionSettings;
  derivedMood: CatMood;
  ambientActivity?: AmbientActivity | null;
  moodOverride?: CatMood;
}): CatMood {
  if (input.moodOverride) {
    return input.moodOverride;
  }
  if (input.ambientActivity) {
    return moodForAmbient(input.ambientActivity);
  }
  if (input.settings.devModeEnabled && input.settings.devForceMood !== 'auto') {
    return input.settings.devForceMood;
  }
  return input.derivedMood;
}

/** Keep peek mood for one hide so the duck-out clip can play. */
export function moodOverrideWhileHiding(
  lastMood: CatMood | undefined,
  companionVisible: boolean,
): CatMood | undefined {
  if (companionVisible || lastMood !== 'peek') {
    return undefined;
  }
  return 'peek';
}

export function buildPresentation(input: {
  cat: CatState;
  vitals: CatVitals;
  settings: ExtensionSettings;
  now: number;
  isUserIdle: boolean;
  speech: string | null;
  triggerKind: CatPresentation['triggerKind'];
  overlayHidden: boolean;
  moodOverride?: CatMood;
  lastCareAction?: import('./cat-interactions').InteractionAction | null;
  companionVisible: boolean;
  ambientActivity?: AmbientActivity | null;
  ambientPeekUntil?: number | null;
  eatingUntil?: number | null;
  playingUntil?: number | null;
}): CatPresentation {
  const derivedMood = deriveMoodFromVitals({
    vitals: input.vitals,
    now: input.now,
    settings: input.settings,
    isUserIdle: input.isUserIdle,
  });
  const mood = resolveDisplayMood({
    settings: input.settings,
    derivedMood,
    ambientActivity: input.ambientActivity,
    moodOverride: input.moodOverride,
  });

  const stage = resolveLifeStage(
    input.cat.adoptedAt,
    input.now,
    input.settings.devForceLifeStage,
  );
  const eatingUntil = input.eatingUntil ?? null;
  const playingUntil = input.playingUntil ?? null;
  const feedingActive = isFeedingActive(eatingUntil, input.now);
  const playingActive = isPlayingActive(playingUntil, input.now);

  return {
    mood,
    stage,
    stageLabel: lifeStageLabel(stage),
    sprite: resolveCompanionAnimation({
      stage,
      mood,
      ambientActivity: input.ambientActivity,
      lastCareAction: input.lastCareAction,
      eatingUntil,
      playingUntil,
      now: input.now,
    }),
    speech: input.speech,
    triggerKind: input.triggerKind,
    overlayHidden: input.overlayHidden,
    canPet: true,
    canTreat: !feedingActive && (mood === 'hungry' || mood === 'starving'),
    canPlay: !playingActive && mood !== 'sleepy' && input.vitals.happiness < 70,
    interactions: buildInteractionOptions(mood, input.vitals, stage),
    secondaryInteractions: buildSecondaryInteractionOptions(),
    lastCareAction: input.lastCareAction ?? null,
    companionVisible: input.companionVisible,
    ambientActivity: input.ambientActivity ?? null,
    ambientPeekUntil: input.ambientPeekUntil ?? null,
    eatingUntil,
    playingUntil,
  };
}
