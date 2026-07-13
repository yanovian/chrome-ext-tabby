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
import { isDevMoodForced } from './settings';
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

const HIDDEN_PRESENCE: ResolvedPresence = {
  companionVisible: false,
  ambientActivity: null,
  ambientPeekUntil: null,
  peekEdge: null,
  peekInset: null,
  peekCorner: null,
  recordSpeech: false,
  recordAmbient: false,
};

/** Build a resolved presence, defaulting unset fields to fully hidden/not-peeking. */
function presence(overrides: Partial<ResolvedPresence>): ResolvedPresence {
  return { ...HIDDEN_PRESENCE, ...overrides };
}

function startPeekVisit(input: {
  cat: CatState;
  settings: ExtensionSettings;
  now: number;
  recordAmbient: boolean;
}): ResolvedPresence {
  const placement = pickPeekPlacement(input.now + input.cat.adoptedAt);
  return presence({
    companionVisible: true,
    ambientActivity: 'peeking',
    ambientPeekUntil:
      input.now +
      pickAmbientPeekVisitDurationMs(input.settings, input.now, input.cat.adoptedAt),
    peekEdge: placement.edge,
    peekInset: placement.inset,
    peekCorner: placement.corner,
    recordAmbient: input.recordAmbient,
  });
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
  if (isDoNotDisturbActive(input.doNotDisturb, input.now)) {
    return presence({});
  }

  if (!input.introCompleted) {
    return presence({
      companionVisible: true,
      recordSpeech:
        input.forceVisible === true && isSpeechTriggerActive(input.speechTrigger),
    });
  }

  if (input.forceVisible) {
    return presence({
      companionVisible: true,
      recordSpeech: isSpeechTriggerActive(input.speechTrigger),
    });
  }

  if (isDevMoodForced(input.settings)) {
    return presence({ companionVisible: true });
  }

  const speechActive = isSpeechTriggerActive(input.speechTrigger);
  const peekCycleActive = isPeekCyclePresentation(input.lastPresentation);

  if (speechActive && !(peekCycleActive && !isUrgentSpeechTrigger(input.speechTrigger))) {
    return presence({ companionVisible: true, recordSpeech: true });
  }

  const previousUntil = input.lastPresentation?.ambientPeekUntil ?? null;
  const previousActivity = input.lastPresentation?.ambientActivity ?? null;
  const last = input.lastPresentation;

  if (!isDevMoodForced(input.settings) && last && isStayVisibleAfterReveal(last, input.now)) {
    return presence({
      companionVisible: true,
      ambientActivity: previousActivity === 'peeking' ? null : previousActivity,
      ambientPeekUntil: previousActivity === 'peeking' ? null : previousUntil,
    });
  }

  if (
    last?.companionVisible === true &&
    previousActivity === 'peeking' &&
    isAmbientPeekActive(previousUntil, input.now)
  ) {
    return presence({
      companionVisible: true,
      ambientActivity: 'peeking',
      ambientPeekUntil: previousUntil,
      peekEdge: last.peekEdge ?? null,
      peekInset: last.peekInset ?? null,
      peekCorner: last.peekCorner ?? null,
    });
  }

  if (last && isAmbientPeekDuckGapActive(last, input.now)) {
    return presence({ ambientActivity: 'peeking', ambientPeekUntil: previousUntil });
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
    return presence({
      companionVisible: true,
      ambientActivity: 'grooming',
      ambientPeekUntil: previousUntil,
    });
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
    return presence({ ambientActivity: previousActivity, ambientPeekUntil: previousUntil });
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
    return presence({
      ambientActivity: pickAmbientRestActivity(input.now),
      ambientPeekUntil:
        input.now +
        pickAmbientPeekDurationMs(input.settings, input.now, input.cat.adoptedAt),
      recordAmbient: true,
    });
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

  return presence({});
}
