import {
  isAmbientPeekActive,
  pickAmbientPeekDurationMs,
  pickAmbientRestActivity,
  shouldStartAmbientRest,
  type AmbientActivity,
} from './ambient-presence';
import { isDoNotDisturbActive, type DoNotDisturbState } from './do-not-disturb';
import type { EmotionalTriggerResult } from './emotional-triggers';
import type { CatPresentation, CatState, ExtensionSettings } from './types';

export interface ResolvedPresence {
  companionVisible: boolean;
  ambientActivity: AmbientActivity | null;
  ambientPeekUntil: number | null;
  recordSpeech: boolean;
  recordAmbient: boolean;
}

function isSpeechTriggerActive(speechTrigger: EmotionalTriggerResult): boolean {
  return (
    speechTrigger.shouldAppear &&
    speechTrigger.speechContext !== null &&
    speechTrigger.triggerKind !== null
  );
}

export function resolveCompanionPresence(input: {
  cat: CatState;
  settings: ExtensionSettings;
  now: number;
  speechTrigger: EmotionalTriggerResult;
  doNotDisturb: DoNotDisturbState;
  introCompleted: boolean;
  lastPresentation: CatPresentation | null;
  forceVisible?: boolean;
}): ResolvedPresence {
  const hidden: ResolvedPresence = {
    companionVisible: false,
    ambientActivity: null,
    ambientPeekUntil: null,
    recordSpeech: false,
    recordAmbient: false,
  };

  if (isDoNotDisturbActive(input.doNotDisturb, input.now)) {
    return hidden;
  }

  if (!input.introCompleted) {
    return {
      ...hidden,
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
      recordSpeech:
        input.forceVisible === true && isSpeechTriggerActive(input.speechTrigger),
      recordAmbient: false,
    };
  }

  if (input.forceVisible) {
    const recordSpeech = isSpeechTriggerActive(input.speechTrigger);
    return {
      ...hidden,
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
      recordSpeech,
      recordAmbient: false,
    };
  }

  const speechActive = isSpeechTriggerActive(input.speechTrigger);

  if (speechActive) {
    return {
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
      recordSpeech: true,
      recordAmbient: false,
    };
  }

  const previousRestUntil = input.lastPresentation?.ambientPeekUntil ?? null;
  const previousActivity = input.lastPresentation?.ambientActivity ?? null;
  if (
    input.lastPresentation?.companionVisible === false &&
    previousActivity &&
    isAmbientPeekActive(previousRestUntil, input.now)
  ) {
    return {
      companionVisible: false,
      ambientActivity: previousActivity,
      ambientPeekUntil: previousRestUntil,
      recordSpeech: false,
      recordAmbient: false,
    };
  }

  if (
    shouldStartAmbientRest({
      cat: input.cat,
      settings: input.settings,
      now: input.now,
      speechWouldAppear: false,
      restUntil: previousRestUntil,
    })
  ) {
    return {
      companionVisible: false,
      ambientActivity: pickAmbientRestActivity(input.now),
      ambientPeekUntil:
        input.now +
        pickAmbientPeekDurationMs(input.settings, input.now, input.cat.adoptedAt),
      recordSpeech: false,
      recordAmbient: true,
    };
  }

  return {
    companionVisible: true,
    ambientActivity: 'grooming',
    ambientPeekUntil: null,
    recordSpeech: false,
    recordAmbient: false,
  };
}
