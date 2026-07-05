import type { CatLifeStage, CatMood } from './types';

export const LIFE_STAGE_LABELS: Record<CatLifeStage, string> = {
  newborn: 'Newborn kitten',
  playful: 'Playful kitten',
  adult: 'Grown-up Tabby',
};

const MOODS: CatMood[] = [
  'content',
  'happy',
  'curious',
  'hungry',
  'starving',
  'stressed',
  'sleepy',
];

const STAGES: CatLifeStage[] = ['newborn', 'playful', 'adult'];

export function spritePath(stage: CatLifeStage, mood: CatMood): string {
  return `sprites/${stage}/${mood}.png`;
}

/** Pick the best available sprite for Tabby's age and mood. */
export function resolveSprite(stage: CatLifeStage, mood: CatMood): string {
  return spritePath(stage, mood);
}

export function allSpritePaths(): string[] {
  return STAGES.flatMap((stage) => MOODS.map((mood) => spritePath(stage, mood)));
}

export function lifeStageLabel(stage: CatLifeStage): string {
  return LIFE_STAGE_LABELS[stage];
}
