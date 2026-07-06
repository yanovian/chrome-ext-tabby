import {
  isAmbientPeekActive,
  pickAmbientActivity,
  pickAmbientPeekDurationMs,
  shouldStartAmbientPeek,
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

  const previousPeekUntil = input.lastPresentation?.ambientPeekUntil ?? null;
  if (
    isAmbientPeekActive(previousPeekUntil, input.now) &&
    input.lastPresentation?.companionVisible &&
    input.lastPresentation.ambientActivity
  ) {
    return {
      companionVisible: true,
      ambientActivity: input.lastPresentation.ambientActivity,
      ambientPeekUntil: previousPeekUntil,
      recordSpeech: false,
      recordAmbient: false,
    };
  }

  if (
    shouldStartAmbientPeek({
      cat: input.cat,
      settings: input.settings,
      now: input.now,
      speechWouldAppear: false,
      peekUntil: previousPeekUntil,
    })
  ) {
    return {
      companionVisible: true,
      ambientActivity: pickAmbientActivity(input.now),
      ambientPeekUntil:
        input.now +
        pickAmbientPeekDurationMs(input.settings, input.now, input.cat.adoptedAt),
      recordSpeech: false,
      recordAmbient: true,
    };
  }

  return hidden;
}
