import type { AmbientActivity } from './ambient-presence';
import type { InteractionAction } from './cat-interactions';
import { isFeedingActive } from './feeding-moment';
import { isPlayingActive } from './play-moment';
import { isPettingActive } from './pet-moment';
import { isTalkActive } from './talk-moment';
import type { CatLifeStage, CatMood } from './types';

export type CompanionAnimationState =
  | 'idle'
  | 'happy'
  | 'curious'
  | 'eat'
  | 'starving'
  | 'feeding'
  | 'stress'
  | 'sleep'
  | 'groom'
  | 'play'
  | 'playing'
  | 'peek'
  | 'overwhelmed'
  | 'pet'
  | 'talk';

/** Lottie composition size per life stage (`lottie-json/` only). */
export const COMPANION_CANVAS_SIZE: Record<CatLifeStage, number> = {
  newborn: 140,
  playful: 180,
  adult: 220,
};

/**
 * Shipped GIF pixel size. Manual exports from
 * [Lottiefiles Lottie to GIF](https://lottiefiles.com/tools/lottie-to-gif) use one
 * resolution (150×150) for every life stage.
 */
export const COMPANION_GIF_SOURCE_SIZE = 150;

/**
 * On-page display size in px. The overlay scales each 150×150 GIF by life stage.
 * Must match `entrypoints/content/style.css` (`.tabby-root--newborn` etc.).
 */
export const COMPANION_DISPLAY_SIZE: Record<CatLifeStage, number> = {
  newborn: 132,
  playful: 162,
  adult: 192,
};

/** Display box size for a life stage (scales the shared 150px GIF source). */
export function companionDisplaySizeForStage(stage: CatLifeStage): number {
  return COMPANION_DISPLAY_SIZE[stage];
}

/** Scale factor from shipped GIF source (150px) to on-page display size. */
export function companionDisplayScaleForStage(stage: CatLifeStage): number {
  return COMPANION_DISPLAY_SIZE[stage] / COMPANION_GIF_SOURCE_SIZE;
}

/** Popup header preview size for adult; newborn and playful scale down proportionally. */
export const COMPANION_PREVIEW_MAX = 84;

export function companionPreviewSizeForStage(stage: CatLifeStage): number {
  return Math.round(
    (COMPANION_DISPLAY_SIZE[stage] / COMPANION_DISPLAY_SIZE.adult) * COMPANION_PREVIEW_MAX,
  );
}

export function lifeStageFromCompanionAssetPath(assetPath: string): CatLifeStage | null {
  const match = assetPath.match(/^(?:gif|lottie-json)\/(newborn|playful|adult)\//);
  return match ? (match[1] as CatLifeStage) : null;
}

/** Share of the cat box visible during peek (must match peek CSS clip windows). */
export const PEEK_VISIBLE_HEIGHT_RATIO = 0.5;

/** Pixel size of a companion asset file (GIF source or Lottie composition). */
export function companionCanvasSizeFromPath(assetPath: string): number {
  if (assetPath.includes('/gif/') || assetPath.startsWith('gif/')) {
    return COMPANION_GIF_SOURCE_SIZE;
  }
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
      return 'eat';
    case 'starving':
      return 'starving';
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
  pettingUntil?: number | null;
  talkUntil?: number | null;
  /** Her current speech bubble text, if any — talk needs both this AND an active talkUntil:
   * the timer caps how long she talks even if the bubble is never dismissed, and dismissing
   * the bubble (nulling this) ends it early even if the timer hasn't run out yet. */
  speech?: string | null;
  now?: number;
}): CompanionAnimationState {
  if (input.eatingUntil != null && input.now != null && isFeedingActive(input.eatingUntil, input.now)) {
    return 'feeding';
  }
  if (input.playingUntil != null && input.now != null && isPlayingActive(input.playingUntil, input.now)) {
    return 'playing';
  }
  // No mood guard needed here, unlike lastCareAction === 'pet' further down: care-general.ts
  // only ever opens a pettingUntil window for a calm/positive mood in the first place, so an
  // urgent one (hungry, stressed, sleepy...) never reaches this check at all.
  if (input.pettingUntil != null && input.now != null && isPettingActive(input.pettingUntil, input.now)) {
    return 'pet';
  }
  if (
    input.lastCareAction === 'ask' &&
    input.speech != null &&
    input.talkUntil != null &&
    input.now != null &&
    isTalkActive(input.talkUntil, input.now)
  ) {
    return 'talk';
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
  return `gif/${stage}/${state}.gif`;
}

/** Peek hide animation used when Tabby ducks below the edge. */
export function peekDuckAnimationPath(stage: CatLifeStage): string {
  return `gif/${stage}/peek_duck.gif`;
}

/** Pick the animated companion asset for Tabby's age, mood, and activity. */
export function resolveCompanionAnimation(input: {
  stage: CatLifeStage;
  mood: CatMood;
  ambientActivity?: AmbientActivity | null;
  lastCareAction?: InteractionAction | null;
  eatingUntil?: number | null;
  playingUntil?: number | null;
  pettingUntil?: number | null;
  talkUntil?: number | null;
  speech?: string | null;
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
    'starving',
    'feeding',
    'stress',
    'sleep',
    'groom',
    'play',
    'playing',
    'peek',
    'overwhelmed',
    'pet',
    'talk',
  ];
  return stages.flatMap((stage) =>
    states.map((state) => companionAnimationPath(stage, state)),
  );
}
