import {
  isAmbientPeekActive,
  isAmbientPeekDuckGapActive,
  isAmbientPeekDuckGapExpired,
  isDaytime,
  isStayVisibleAfterReveal,
  isStayVisibleAfterRevealExpired,
  pickAmbientPeekDurationMs,
  pickAmbientPeekVisitDurationMs,
  pickAmbientRestActivity,
  pickPeekPlacement,
  shouldStartAmbientRest,
  type AmbientActivity,
  type PeekCorner,
  type PeekEdge,
} from './ambient-presence';
import { isDoNotDisturbActive, type DoNotDisturbState } from './do-not-disturb';
import type { EmotionalTriggerResult } from './emotional-triggers';
import type { CatPresentation, CatState, ExtensionSettings } from './types';

export interface ResolvedPresence {
  companionVisible: boolean;
  ambientActivity: AmbientActivity | null;
  ambientPeekUntil: number | null;
  peekEdge: PeekEdge | null;
  peekInset: number | null;
  peekCorner: PeekCorner | null;
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

function isUrgentSpeechTrigger(speechTrigger: EmotionalTriggerResult): boolean {
  return (
    speechTrigger.triggerKind === 'hungry' || speechTrigger.triggerKind === 'starving'
  );
}

function isPeekCyclePresentation(presentation: CatPresentation | null): boolean {
  return presentation?.ambientActivity === 'peeking';
}

function startPeekVisit(input: {
  cat: CatState;
  settings: ExtensionSettings;
  now: number;
  recordAmbient: boolean;
}): ResolvedPresence {
  const placement = pickPeekPlacement(input.now + input.cat.adoptedAt);
  return {
    companionVisible: true,
    ambientActivity: 'peeking',
    ambientPeekUntil:
      input.now +
      pickAmbientPeekVisitDurationMs(input.settings, input.now, input.cat.adoptedAt),
    peekEdge: placement.edge,
    peekInset: placement.inset,
    peekCorner: placement.corner,
    recordSpeech: false,
    recordAmbient: input.recordAmbient,
  };
}

export function resolveCompanionPresence(input: {
  cat: CatState;
  settings: ExtensionSettings;
  now: number;
  isUserIdle: boolean;
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
    peekEdge: null,
    peekInset: null,
    peekCorner: null,
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
      recordSpeech:
        input.forceVisible === true && isSpeechTriggerActive(input.speechTrigger),
    };
  }

  if (input.forceVisible) {
    const recordSpeech = isSpeechTriggerActive(input.speechTrigger);
    return {
      ...hidden,
      companionVisible: true,
      recordSpeech,
    };
  }

  if (input.settings.devModeEnabled && input.settings.devForceMood !== 'auto') {
    return {
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      recordSpeech: false,
      recordAmbient: false,
    };
  }

  const speechActive = isSpeechTriggerActive(input.speechTrigger);
  const peekCycleActive = isPeekCyclePresentation(input.lastPresentation);

  if (speechActive && !(peekCycleActive && !isUrgentSpeechTrigger(input.speechTrigger))) {
    return {
      companionVisible: true,
      ambientActivity: null,
      ambientPeekUntil: null,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      recordSpeech: true,
      recordAmbient: false,
    };
  }

  const previousUntil = input.lastPresentation?.ambientPeekUntil ?? null;
  const previousActivity = input.lastPresentation?.ambientActivity ?? null;
  const last = input.lastPresentation;
  const devForcesMood =
    input.settings.devModeEnabled && input.settings.devForceMood !== 'auto';

  if (!devForcesMood && last && isStayVisibleAfterReveal(last, input.now)) {
    return {
      companionVisible: true,
      ambientActivity:
        previousActivity === 'peeking' ? null : previousActivity,
      ambientPeekUntil:
        previousActivity === 'peeking' ? null : previousUntil,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      recordSpeech: false,
      recordAmbient: false,
    };
  }

  if (
    last?.companionVisible === true &&
    previousActivity === 'peeking' &&
    isAmbientPeekActive(previousUntil, input.now)
  ) {
    return {
      companionVisible: true,
      ambientActivity: 'peeking',
      ambientPeekUntil: previousUntil,
      peekEdge: last.peekEdge ?? null,
      peekInset: last.peekInset ?? null,
      peekCorner: last.peekCorner ?? null,
      recordSpeech: false,
      recordAmbient: false,
    };
  }

  if (last && isAmbientPeekDuckGapActive(last, input.now)) {
    return {
      companionVisible: false,
      ambientActivity: 'peeking',
      ambientPeekUntil: previousUntil,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      recordSpeech: false,
      recordAmbient: false,
    };
  }

  if (last && isAmbientPeekDuckGapExpired(last, input.now)) {
    return startPeekVisit({
      cat: input.cat,
      settings: input.settings,
      now: input.now,
      recordAmbient: false,
    });
  }

  if (last && isStayVisibleAfterRevealExpired(last, input.now)) {
    return startPeekVisit({
      cat: input.cat,
      settings: input.settings,
      now: input.now,
      recordAmbient: false,
    });
  }

  if (
    last?.companionVisible === true &&
    previousActivity === 'grooming' &&
    isAmbientPeekActive(previousUntil, input.now)
  ) {
    return {
      companionVisible: true,
      ambientActivity: 'grooming',
      ambientPeekUntil: previousUntil,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      recordSpeech: false,
      recordAmbient: false,
    };
  }

  if (
    last?.companionVisible === true &&
    previousActivity === 'grooming' &&
    previousUntil !== null &&
    !isAmbientPeekActive(previousUntil, input.now)
  ) {
    return startPeekVisit({
      cat: input.cat,
      settings: input.settings,
      now: input.now,
      recordAmbient: false,
    });
  }

  if (
    last?.companionVisible === false &&
    previousActivity &&
    previousActivity !== 'peeking' &&
    isAmbientPeekActive(previousUntil, input.now)
  ) {
    return {
      companionVisible: false,
      ambientActivity: previousActivity,
      ambientPeekUntil: previousUntil,
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
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
      restUntil: previousUntil,
    })
  ) {
    return {
      companionVisible: false,
      ambientActivity: pickAmbientRestActivity(input.now),
      ambientPeekUntil:
        input.now +
        pickAmbientPeekDurationMs(input.settings, input.now, input.cat.adoptedAt),
      peekEdge: null,
      peekInset: null,
      peekCorner: null,
      recordSpeech: false,
      recordAmbient: true,
    };
  }

  const hour = new Date(input.now).getHours();
  if (isDaytime(hour, input.settings)) {
    return startPeekVisit({
      cat: input.cat,
      settings: input.settings,
      now: input.now,
      recordAmbient: true,
    });
  }

  return hidden;
}
