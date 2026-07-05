import type { CatLifeStage, CatMood, CatVitals } from './types';

export type InteractionAction = 'pet' | 'feed' | 'play' | 'ask' | 'dismiss';

export type PrimaryInteractionAction = Exclude<InteractionAction, 'dismiss'>;

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
  action: 'dismiss';
  label: string;
  enabled: boolean;
}

export function isBored(vitals: CatVitals, mood: CatMood): boolean {
  return vitals.happiness < 45 && mood !== 'sleepy' && mood !== 'stressed';
}

/** Low happiness that a quick pet shouldn't fully mask when checking in. */
export function needsPlayAttention(vitals: CatVitals, mood: CatMood): boolean {
  return vitals.happiness < 55 && mood !== 'sleepy' && mood !== 'stressed';
}

/** Mood Tabby should speak to when the user asks what's up. */
export function resolveAskMood(vitals: CatVitals, derivedMood: CatMood): CatMood {
  if (derivedMood === 'stressed') {
    return 'stressed';
  }
  if (derivedMood === 'starving' || derivedMood === 'hungry') {
    return derivedMood;
  }
  if (derivedMood === 'sleepy') {
    return 'sleepy';
  }
  if (isBored(vitals, derivedMood) || needsPlayAttention(vitals, derivedMood)) {
    return derivedMood;
  }
  return derivedMood;
}

function feedLabel(stage: CatLifeStage, mood: CatMood): string {
  if (mood === 'starving') {
    return stage === 'newborn' ? 'Feed' : 'Feed Tabby';
  }
  return stage === 'newborn' ? 'Feed' : 'Feed Tabby';
}

function playLabel(stage: CatLifeStage): string {
  if (stage === 'playful') {
    return 'Play';
  }
  return 'Play';
}

function askLabel(mood: CatMood, stage: CatLifeStage, vitals: CatVitals): string {
  if (mood === 'stressed') {
    return stage === 'newborn' ? 'Why so fussy?' : 'What’s wrong?';
  }
  if (mood === 'starving' || mood === 'hungry') {
    return stage === 'newborn' ? 'Why hungry?' : 'What do you need?';
  }
  if (mood === 'sleepy') {
    return stage === 'newborn' ? 'Sleepy?' : 'Were you napping?';
  }
  if (isBored(vitals, mood)) {
    return 'Bored?';
  }
  return 'What’s up?';
}

function resolvePrimaryAction(
  mood: CatMood,
  vitals: CatVitals,
): InteractionAction | null {
  if (mood === 'stressed' || mood === 'sleepy') {
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

  if (mood === 'stressed') {
    push('ask', askLabel(mood, stage, vitals));
  } else if (mood === 'starving' || mood === 'hungry') {
    push('feed', feedLabel(stage, mood));
    push('ask', askLabel(mood, stage, vitals));
  } else if (mood === 'sleepy') {
    push('ask', askLabel(mood, stage, vitals));
  } else if (isBored(vitals, mood) || needsPlayAttention(vitals, mood)) {
    push('play', playLabel(stage));
    push('ask', askLabel(mood, stage, vitals));
  } else {
    push('ask', askLabel(mood, stage, vitals));
    push('play', playLabel(stage));
  }

  push('pet', 'Pet');

  return options;
}

/** Extra actions tucked behind “More” so they are harder to hit by accident. */
export function buildSecondaryInteractionOptions(): SecondaryInteractionOption[] {
  return [{ action: 'dismiss', label: 'Hide Tabby', enabled: true }];
}

/** Tabby explains her mood warmly — never guilt, never metrics. */
export function explainCurrentMood(
  mood: CatMood,
  vitals: CatVitals,
  stage: CatLifeStage = 'adult',
): string {
  switch (mood) {
    case 'stressed':
      if (stage === 'newborn') {
        return 'Everything feels big and loud. I’m not scared of you — it’s just a lot.';
      }
      if (stage === 'playful') {
        return 'Too much spicy stuff today. I need something calmer to chase.';
      }
      return 'Lots of angry pages out there. Not mad at you — just noisy.';
    case 'starving':
      if (stage === 'newborn') {
        return 'Tiny tummy’s empty. I need something gentle and interesting.';
      }
      if (stage === 'playful') {
        return 'Nothing fun to pounce on. Feed me something worth learning.';
      }
      return 'Haven’t seen anything interesting in a while. Got something good?';
    case 'hungry':
      if (stage === 'newborn') {
        return 'A little peckish. Something small and interesting would help.';
      }
      return 'Running low on good stuff today. One nice read would hit the spot.';
    case 'sleepy':
      if (stage === 'newborn') {
        return 'Baby kittens nap a lot. I’m cozy — keep going, I’m nearby.';
      }
      return 'You went quiet, so I curled up. Wake me if you want company.';
    case 'happy':
      if (stage === 'playful') {
        return 'Feeling good. Today’s a fun one.';
      }
      return 'Nice pace today. I like it.';
    case 'curious':
      if (stage === 'playful') {
        return 'That looks pounce-worthy. What is it?';
      }
      return 'Something here caught my eye.';
    case 'content':
      if (isBored(vitals, mood) || needsPlayAttention(vitals, mood)) {
        return stage === 'playful'
          ? 'I’m bored. That’s dangerous for a kitten.'
          : 'It’s been quiet. Got anything fun?';
      }
      return 'Cozy. I’m right here if you need me.';
    default:
      return 'I’m okay. Just hanging out.';
  }
}

export function mapInteractionToCareAction(
  action: InteractionAction,
): 'pet' | 'treat' | 'play' | 'ask' | 'dismiss' {
  if (action === 'feed') {
    return 'treat';
  }
  return action;
}

export function mapCareActionToInteraction(
  action: 'pet' | 'treat' | 'play' | 'ask' | 'dismiss',
): InteractionAction {
  if (action === 'treat') {
    return 'feed';
  }
  return action;
}
