import type { CatLifeStage } from './types';

export const LIFE_STAGE_LABELS: Record<CatLifeStage, string> = {
  newborn: 'Newborn kitten',
  playful: 'Playful kitten',
  adult: 'Grown-up Tabby',
};

export function lifeStageLabel(stage: CatLifeStage): string {
  return LIFE_STAGE_LABELS[stage];
}
