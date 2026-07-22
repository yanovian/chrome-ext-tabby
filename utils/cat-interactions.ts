import { brandName, explainLines, pickLine, t } from './i18n';
import type { CatLifeStage, CatMood, CatState, CatVitals } from './types';
import { isSatiated } from './mood-grace';

export type InteractionAction =
  | 'pet'
  | 'feed'
  | 'play'
  | 'ask'
  | 'shoo'
  | 'dismiss'
  | 'dnd_30'
  | 'dnd_60'
  | 'dnd_today';

export type PrimaryInteractionAction = Exclude<
  InteractionAction,
  'dismiss' | 'dnd_30' | 'dnd_60' | 'dnd_today'
>;

export interface InteractionOption {
  action: InteractionAction;
  label: string;
  enabled: boolean;
  primary?: boolean;
}

export interface PrimaryInteractionOption {
  action: PrimaryInteractionAction;
  label: string;
  enabled: boolean;
  primary?: boolean;
}

export interface SecondaryInteractionOption {
  action: 'dismiss' | 'dnd_30' | 'dnd_60' | 'dnd_today';
  label: string;
  enabled: boolean;
}

export function isBored(vitals: CatVitals, mood: CatMood): boolean {
  return (
    vitals.happiness < 45 &&
    mood !== 'sleepy' &&
    mood !== 'stressed' &&
    mood !== 'overwhelmed'
  );
}

/** Low happiness that a quick pet shouldn't fully mask when checking in. */
export function needsPlayAttention(vitals: CatVitals, mood: CatMood): boolean {
  return (
    vitals.happiness < 55 &&
    mood !== 'sleepy' &&
    mood !== 'stressed' &&
    mood !== 'overwhelmed'
  );
}

/** Hungry or starving mood that should stay until Tabby is fed. */
export function resolveHungryMood(
  vitals: CatVitals,
  derivedMood: CatMood,
  displayMood?: CatMood,
  cat?: CatState,
  now?: number,
): CatMood | null {
  if (cat && now !== undefined && isSatiated(cat, now)) {
    return null;
  }
  if (vitals.hunger >= 88) {
    return 'starving';
  }
  if (vitals.hunger >= 65) {
    return 'hungry';
  }
  if (displayMood === 'starving' || displayMood === 'hungry') {
    return displayMood;
  }
  if (derivedMood === 'starving' || derivedMood === 'hungry') {
    return derivedMood;
  }
  return null;
}

/** Mood Tabby should speak to when the user asks what's up. */
export function resolveAskMood(
  vitals: CatVitals,
  derivedMood: CatMood,
  displayMood?: CatMood,
  cat?: CatState,
  now?: number,
): CatMood {
  const hungryMood = resolveHungryMood(vitals, derivedMood, displayMood, cat, now);
  if (hungryMood) {
    return hungryMood;
  }
  if (displayMood === 'overwhelmed') {
    return 'overwhelmed';
  }
  if (displayMood === 'stressed' || derivedMood === 'stressed') {
    return 'stressed';
  }
  if (cat && now !== undefined && cat.happyUntil > now) {
    return 'happy';
  }
  if (derivedMood === 'sleepy') {
    return 'sleepy';
  }
  if (isBored(vitals, derivedMood) || needsPlayAttention(vitals, derivedMood)) {
    return derivedMood;
  }
  return derivedMood;
}

function feedLabel(stage: CatLifeStage): string {
  if (stage === 'newborn') {
    return t('care.feed');
  }
  return t('care.feedBrand', { brand: brandName() });
}

function playLabel(): string {
  return t('care.play');
}

function askLabel(mood: CatMood, stage: CatLifeStage, vitals: CatVitals): string {
  if (mood === 'overwhelmed') {
    return stage === 'newborn' ? t('care.askOverwhelmedNewborn') : t('care.askOverwhelmed');
  }
  if (mood === 'stressed') {
    return stage === 'newborn' ? t('care.askStressedNewborn') : t('care.askStressed');
  }
  if (mood === 'starving' || mood === 'hungry') {
    return stage === 'newborn' ? t('care.askHungryNewborn') : t('care.askHungry');
  }
  if (mood === 'sleepy') {
    return stage === 'newborn' ? t('care.askSleepyNewborn') : t('care.askSleepy');
  }
  if (isBored(vitals, mood)) {
    return t('care.askBored');
  }
  return t('care.askDefault');
}

function resolvePrimaryAction(
  mood: CatMood,
  vitals: CatVitals,
): InteractionAction | null {
  if (mood === 'stressed' || mood === 'overwhelmed' || mood === 'sleepy') {
    return 'ask';
  }
  if (mood === 'starving' || mood === 'hungry') {
    return 'feed';
  }
  if (isBored(vitals, mood) || needsPlayAttention(vitals, mood)) {
    return 'play';
  }
  return null;
}

/** Mood- and age-aware actions shown when the user taps Tabby. */
export function buildInteractionOptions(
  mood: CatMood,
  vitals: CatVitals,
  stage: CatLifeStage,
): PrimaryInteractionOption[] {
  const primary = resolvePrimaryAction(mood, vitals);
  const options: PrimaryInteractionOption[] = [];

  const push = (
    action: PrimaryInteractionAction,
    label: string,
    enabled = true,
  ): void => {
    options.push({
      action,
      label,
      enabled,
      primary: action === primary,
    });
  };

  if (mood === 'stressed' || mood === 'overwhelmed') {
    push('ask', askLabel(mood, stage, vitals));
  } else if (mood === 'starving' || mood === 'hungry') {
    push('feed', feedLabel(stage));
    push('ask', askLabel(mood, stage, vitals));
  } else if (mood === 'sleepy') {
    push('ask', askLabel(mood, stage, vitals));
  } else if (isBored(vitals, mood) || needsPlayAttention(vitals, mood)) {
    push('play', playLabel());
    push('ask', askLabel(mood, stage, vitals));
  } else {
    push('ask', askLabel(mood, stage, vitals));
    push('play', playLabel());
  }

  push('pet', t('care.pet'));
  push('shoo', t('care.shoo'));

  return options;
}

/** Extra actions tucked behind “More” so they are harder to hit by accident. */
export function buildSecondaryInteractionOptions(): SecondaryInteractionOption[] {
  return [
    { action: 'dnd_30', label: t('care.dnd30'), enabled: true },
    { action: 'dnd_60', label: t('care.dnd60'), enabled: true },
    { action: 'dnd_today', label: t('care.dndToday'), enabled: true },
    { action: 'dismiss', label: t('care.hidePage'), enabled: true },
  ];
}

/** Tabby explains her mood warmly, never guilt, never metrics. */
export function explainCurrentMood(
  mood: CatMood,
  vitals: CatVitals,
  stage: CatLifeStage = 'adult',
  seed: number = Date.now(),
): string {
  if (mood === 'content' && (isBored(vitals, mood) || needsPlayAttention(vitals, mood))) {
    const boredStage = stage === 'playful' ? 'playful' : 'adult';
    return pickLine(explainLines('content_bored', boredStage), seed);
  }

  const explainStage = stage === 'newborn' ? 'newborn' : stage === 'playful' ? 'playful' : 'adult';
  const lines = explainLines(mood, explainStage);
  if (lines.length > 0) {
    return pickLine(lines, seed);
  }
  return pickLine(explainLines('default', 'adult'), seed);
}

export function mapInteractionToCareAction(
  action: InteractionAction,
): 'pet' | 'treat' | 'play' | 'ask' | 'shoo' | 'dismiss' | 'dnd_30' | 'dnd_60' | 'dnd_today' {
  if (action === 'feed') {
    return 'treat';
  }
  return action;
}

export function mapCareActionToInteraction(
  action: 'pet' | 'treat' | 'play' | 'ask' | 'shoo' | 'dismiss' | 'dnd_30' | 'dnd_60' | 'dnd_today',
): InteractionAction {
  if (action === 'treat') {
    return 'feed';
  }
  return action;
}
