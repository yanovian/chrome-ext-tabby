import {
  effectiveAmbientLimits,
  isAmbientPeekActive,
  pickAmbientActivity,
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

  if (input.forceVisible || !input.introCompleted) {
    return {
      ...hidden,
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
    };
  }

  const speechActive =
    input.speechTrigger.shouldAppear &&
    input.speechTrigger.speechContext !== null &&
    input.speechTrigger.triggerKind !== null;

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

  const limits = effectiveAmbientLimits(input.settings);
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
      ambientPeekUntil: input.now + limits.peekDurationMs,
      recordSpeech: false,
      recordAmbient: true,
    };
  }

  return hidden;
}
