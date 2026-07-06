import { buildInteractionOptions, buildSecondaryInteractionOptions } from './cat-interactions';
import { deriveMoodFromVitals, resolveLifeStage } from './cat-sim';
import { lifeStageLabel, resolveSprite } from './sprites';
import type { AmbientActivity } from './ambient-presence';
import type { CatPresentation, CatState, CatVitals, ExtensionSettings, CatMood } from './types';

export function moodForAmbient(activity: AmbientActivity): CatMood {
  return activity === 'sleeping' ? 'sleepy' : 'content';
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
}): CatPresentation {
  const derivedMood = deriveMoodFromVitals({
    vitals: input.vitals,
    now: input.now,
    settings: input.settings,
    isUserIdle: input.isUserIdle,
  });
  const mood =
    input.moodOverride ??
    (input.ambientActivity ? moodForAmbient(input.ambientActivity) : derivedMood);

  const stage = resolveLifeStage(
    input.cat.adoptedAt,
    input.now,
    input.settings.devForceLifeStage,
  );

  return {
    mood,
    stage,
    stageLabel: lifeStageLabel(stage),
    sprite: resolveSprite(stage, mood),
    speech: input.speech,
    triggerKind: input.triggerKind,
    overlayHidden: input.overlayHidden,
    canPet: true,
    canTreat: mood === 'hungry' || mood === 'starving',
    canPlay: mood !== 'sleepy' && input.vitals.happiness < 70,
    interactions: buildInteractionOptions(mood, input.vitals, stage),
    secondaryInteractions: buildSecondaryInteractionOptions(),
    lastCareAction: input.lastCareAction ?? null,
    companionVisible: input.companionVisible,
    ambientActivity: input.ambientActivity ?? null,
    ambientPeekUntil: input.ambientPeekUntil ?? null,
  };
}
