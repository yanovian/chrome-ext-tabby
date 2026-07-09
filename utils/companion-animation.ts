import type { AmbientActivity } from './ambient-presence';
import type { InteractionAction } from './cat-interactions';
import { isFeedingActive } from './feeding-moment';
import { isPlayingActive } from './play-moment';
import type { CatLifeStage, CatMood } from './types';

export type CompanionAnimationState =
  | 'idle'
  | 'happy'
  | 'curious'
  | 'eat'
  | 'feeding'
  | 'stress'
  | 'sleep'
  | 'groom'
  | 'play'
  | 'playing'
  | 'peek'
  | 'overwhelmed';

export const COMPANION_ANIMATION_SPEED = 0.82;

/** Lottie composition size per life stage (must match generate-scaffold-animations.mjs). */
export const COMPANION_CANVAS_SIZE: Record<CatLifeStage, number> = {
  newborn: 140,
  playful: 180,
  adult: 220,
};

/** On-page display size in px. Must match entrypoints/content/style.css. */
export const COMPANION_DISPLAY_SIZE: Record<CatLifeStage, number> = {
  newborn: 132,
  playful: 162,
  adult: 192,
};

/** Share of the cat box that peek mood shows above the bottom edge. */
export const PEEK_VISIBLE_HEIGHT_RATIO = 0.38;

/** Composition pixel size for a companion animation asset path. */
export function companionCanvasSizeFromPath(assetPath: string): number {
  if (assetPath.includes('/newborn/')) {
    return COMPANION_CANVAS_SIZE.newborn;
  }
  if (assetPath.includes('/playful/')) {
    return COMPANION_CANVAS_SIZE.playful;
  }
  if (assetPath.includes('/adult/')) {
    return COMPANION_CANVAS_SIZE.adult;
  }
  return COMPANION_CANVAS_SIZE.playful;
}

export function moodToAnimationState(mood: CatMood): CompanionAnimationState {
  switch (mood) {
    case 'happy':
      return 'happy';
    case 'curious':
      return 'curious';
    case 'hungry':
    case 'starving':
      return 'eat';
    case 'stressed':
      return 'stress';
    case 'sleepy':
      return 'sleep';
    case 'peek':
      return 'peek';
    case 'overwhelmed':
      return 'overwhelmed';
    default:
      return 'idle';
  }
}

export function resolveCompanionAnimationState(input: {
  mood: CatMood;
  ambientActivity?: AmbientActivity | null;
  lastCareAction?: InteractionAction | null;
  eatingUntil?: number | null;
  playingUntil?: number | null;
  now?: number;
}): CompanionAnimationState {
  if (input.eatingUntil != null && input.now != null && isFeedingActive(input.eatingUntil, input.now)) {
    return 'feeding';
  }
  if (input.playingUntil != null && input.now != null && isPlayingActive(input.playingUntil, input.now)) {
    return 'playing';
  }
  if (input.ambientActivity === 'sleeping') {
    return 'sleep';
  }
  if (input.ambientActivity === 'grooming') {
    return 'groom';
  }
  if (input.lastCareAction === 'play') {
    return 'play';
  }
  if (input.lastCareAction === 'feed') {
    return 'feeding';
  }
  return moodToAnimationState(input.mood);
}

export function companionAnimationPath(
  stage: CatLifeStage,
  state: CompanionAnimationState,
): string {
  return `animations/${stage}/${state}.json`;
}

/** Peek hide animation used when Tabby ducks below the edge. */
export function peekDuckAnimationPath(stage: CatLifeStage): string {
  return `animations/${stage}/peek_duck.json`;
}

/** Pick the animated companion asset for Tabby's age, mood, and activity. */
export function resolveCompanionAnimation(input: {
  stage: CatLifeStage;
  mood: CatMood;
  ambientActivity?: AmbientActivity | null;
  lastCareAction?: InteractionAction | null;
  eatingUntil?: number | null;
  playingUntil?: number | null;
  now?: number;
}): string {
  const state = resolveCompanionAnimationState(input);
  return companionAnimationPath(input.stage, state);
}

export function allCompanionAnimationPaths(): string[] {
  const stages: CatLifeStage[] = ['newborn', 'playful', 'adult'];
  const states: CompanionAnimationState[] = [
    'idle',
    'happy',
    'curious',
    'eat',
    'feeding',
    'stress',
    'sleep',
    'groom',
    'play',
    'playing',
    'peek',
    'overwhelmed',
  ];
  return stages.flatMap((stage) =>
    states.map((state) => companionAnimationPath(stage, state)),
  );
}
