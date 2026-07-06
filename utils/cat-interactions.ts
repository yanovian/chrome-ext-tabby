import type { CatLifeStage, CatMood, CatVitals } from './types';

export type InteractionAction =
  | 'pet'
  | 'feed'
  | 'play'
  | 'ask'
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
  return [
    { action: 'dnd_30', label: 'Do not disturb: 30 min', enabled: true },
    { action: 'dnd_60', label: 'Do not disturb: 1 hour', enabled: true },
    { action: 'dnd_today', label: 'Do not disturb: today', enabled: true },
    { action: 'dismiss', label: 'Hide Tabby on this page', enabled: true },
  ];
}

function pickMoodLine(lines: string[], seed: number): string {
  if (lines.length === 0) {
    return '';
  }
  const index = Math.abs(seed) % lines.length;
  return lines[index] ?? lines[0] ?? '';
}

/** Tabby explains her mood warmly — never guilt, never metrics. */
export function explainCurrentMood(
  mood: CatMood,
  vitals: CatVitals,
  stage: CatLifeStage = 'adult',
  seed: number = Date.now(),
): string {
  switch (mood) {
    case 'stressed':
      if (stage === 'newborn') {
        return pickMoodLine(
          [
            'Everything feels big and loud. I’m not scared of you — it’s just a lot.',
            'So much noise today. I’m okay — just a tiny bit overwhelmed.',
            'The internet feels huge right now. Stay close?',
          ],
          seed,
        );
      }
      if (stage === 'playful') {
        return pickMoodLine(
          [
            'Too much spicy stuff today. I need something calmer to chase.',
            'My whiskers are buzzing. Something gentler would help.',
            'Lots of loud tabs. I could use a softer page.',
          ],
          seed,
        );
      }
      return pickMoodLine(
        [
          'Lots of angry pages out there. Not mad at you — just noisy.',
          'Everything’s a bit much today. I’m not upset with you.',
          'The feed feels spicy. I’m fine — just need something calmer.',
        ],
        seed,
      );
    case 'starving':
      if (stage === 'newborn') {
        return pickMoodLine(
          [
            'Mew. Tiny tummy’s empty. Read something gentle to feed me?',
            'Baby hunger. Something cozy would fill me up.',
            'Empty and squeaky. Got something small and good?',
          ],
          seed,
        );
      }
      if (stage === 'playful') {
        return pickMoodLine(
          [
            'Mrrp — starving for fun. Read something good to feed me?',
            'Empty bowl, empty pounce. Feed me with something tasty.',
            'Hungry hunter. Something interesting would fill me up.',
          ],
          seed,
        );
      }
      return pickMoodLine(
        [
          'Mew… very hungry. Read something good to feed me?',
          'Starving whiskers. A nice read would hit the spot.',
          'Hollow tummy. Feed me with something interesting?',
        ],
        seed,
      );
    case 'hungry':
      if (stage === 'newborn') {
        return pickMoodLine(
          [
            'Mew — a little peckish. Something gentle would feed me.',
            'Tiny hunger. Read something cozy for my bowl?',
            'Peckish baby. Something small and good would help.',
          ],
          seed,
        );
      }
      return pickMoodLine(
        [
          'Peckish. Mrrp. Read something good to feed me?',
          'A little hungry. Something tasty would fill me up.',
          'Hungry whiskers. Got a good read for me?',
        ],
        seed,
      );
    case 'sleepy':
      if (stage === 'newborn') {
        return pickMoodLine(
          [
            'Baby kittens nap a lot. I’m cozy — keep going, I’m nearby.',
            'So sleepy. I’ll watch from a little nap pile.',
            'Yawn. I’m here — just half dreaming.',
          ],
          seed,
        );
      }
      return pickMoodLine(
        [
          'You went quiet, so I curled up. Wake me if you want company.',
          'I’m drowsy. Still here — just napping nearby.',
          'Low energy mode. I’ll keep you company from a cozy spot.',
        ],
        seed,
      );
    case 'happy':
      if (stage === 'playful') {
        return pickMoodLine(
          [
            'Feeling good. Today’s a fun one.',
            'I’m bouncing. Good browsing energy.',
            'Mood: pounce-ready. I like today.',
          ],
          seed,
        );
      }
      return pickMoodLine(
        [
          'Nice pace today. I like it.',
          'Good rhythm so far. I’m content.',
          'Today feels steady. I’m here for it.',
          'Pretty good day. I’m glad we’re browsing together.',
        ],
        seed,
      );
    case 'curious':
      if (stage === 'playful') {
        return pickMoodLine(
          [
            'That looks pounce-worthy. What is it?',
            'Ooh — something fun on this page.',
            'My ears are up. Tell me about this one.',
          ],
          seed,
        );
      }
      return pickMoodLine(
        [
          'Something here caught my eye.',
          'This page smells interesting.',
          'I’m sniffing around. What are we looking at?',
        ],
        seed,
      );
    case 'peek':
      return pickMoodLine(
        [
          'Just peeking. Don’t mind me.',
          'Mrrp. I’m down here.',
          'Caught you looking. Hi.',
        ],
        seed,
      );
    case 'content':
      if (isBored(vitals, mood) || needsPlayAttention(vitals, mood)) {
        return stage === 'playful'
          ? pickMoodLine(
              [
                'I’m bored. That’s dangerous for a kitten.',
                'Not much to chase today. Got something fun?',
                'Quiet hours. I need a toy — or a tab.',
              ],
              seed,
            )
          : pickMoodLine(
              [
                'It’s been quiet. Got anything fun?',
                'A little restless. Something new would help.',
                'I’m okay — just wish something interesting would show up.',
              ],
              seed,
            );
      }
      return pickMoodLine(
        [
          'Cozy. I’m right here if you need me.',
          'All good. Just hanging out with you.',
          'Comfortable. Ask me anything.',
          'I’m settled in. What’s on your mind?',
        ],
        seed,
      );
    default:
      return pickMoodLine(
        ['I’m okay. Just hanging out.', 'Doing fine. Here if you need me.', 'All good on my end.'],
        seed,
      );
  }
}

export function mapInteractionToCareAction(
  action: InteractionAction,
): 'pet' | 'treat' | 'play' | 'ask' | 'dismiss' | 'dnd_30' | 'dnd_60' | 'dnd_today' {
  if (action === 'feed') {
    return 'treat';
  }
  return action;
}

export function mapCareActionToInteraction(
  action: 'pet' | 'treat' | 'play' | 'ask' | 'dismiss' | 'dnd_30' | 'dnd_60' | 'dnd_today',
): InteractionAction {
  if (action === 'treat') {
    return 'feed';
  }
  return action;
}
