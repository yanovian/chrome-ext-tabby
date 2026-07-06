import type { CatLifeStage, CatMood } from './types';
import {
  allCompanionAnimationPaths,
  resolveCompanionAnimation,
} from './companion-animation';

export const LIFE_STAGE_LABELS: Record<CatLifeStage, string> = {
  newborn: 'Newborn kitten',
  playful: 'Playful kitten',
  adult: 'Grown-up Tabby',
};

/** @deprecated Use companionAnimationPath. Kept for tests and icon tooling. */
export function spritePath(stage: CatLifeStage, mood: CatMood): string {
  return `sprites/${stage}/${mood}.png`;
}

/** Asset path for the animated companion (dotLottie JSON). */
export function resolveSprite(
  stage: CatLifeStage,
  mood: CatMood,
  extras: {
    ambientActivity?: import('./ambient-presence').AmbientActivity | null;
    lastCareAction?: import('./cat-interactions').InteractionAction | null;
  } = {},
): string {
  return resolveCompanionAnimation({
    stage,
    mood,
    ambientActivity: extras.ambientActivity,
    lastCareAction: extras.lastCareAction,
  });
}

export function allSpritePaths(): string[] {
  return allCompanionAnimationPaths();
}

export function lifeStageLabel(stage: CatLifeStage): string {
  return LIFE_STAGE_LABELS[stage];
}
