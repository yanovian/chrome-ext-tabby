// --- Ambient phase state machine ------------------------------------------------------
//
// Tabby's ambient behavior (peek / rest / idle) is a small timed state machine layered on
// top of the flat CatPresentation fields (ambientActivity, ambientPeekUntil, stayVisibleUntil,
// companionVisible). Reading those fields as a growing cascade of independent "is this
// expired/active" checks — in whatever order they happened to get written — is exactly how
// this drifted into bugs before: a new case could slot into the wrong spot in the cascade, or
// two branches could overlap in ways that were hard to see at a glance. classifyAmbientPhase
// turns the flat fields into one clear tag; the switch below it is the single place that
// decides what happens next for each phase. New behavior only ever needs a new case, not a
// new boolean threaded through the whole cascade.
import {
  enterPeekDuckGap,
  isAmbientPeekActive,
  isAmbientPeekDuckGapActive,
  isAmbientPeekVisitExpired,
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
} from '../ambient-presence';
import { isDoNotDisturbActive, type DoNotDisturbState } from '../do-not-disturb';
import type { EmotionalTriggerResult } from '../emotional-triggers';
import { isSleepDeferred } from '../mood-grace';
import { isDevMoodForced } from '../settings';
import type { CatPresentation, CatState, ExtensionSettings } from '../types';

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

type AmbientPhase =
  | 'idle' // nothing ambient going on
  | 'peekVisible' // visibly peeking from a screen edge
  | 'peekHidden' // ducked away between peek visits ("duck gap")
  | 'resting' // sleeping/grooming, fully hidden
  | 'stayVisible'; // just revealed from peek — grace window before ambient can resume

function classifyAmbientPhase(last: CatPresentation | null): AmbientPhase {
  if (!last) {
    return 'idle';
  }
  // Mutually exclusive with the other phases by construction: buildPresentation always nulls
  // stayVisibleUntil while peeking, so this can only be set when nothing else claims the slot.
  if (last.stayVisibleUntil !== null) {
    return 'stayVisible';
  }
  if (last.ambientActivity === 'peeking') {
    return last.companionVisible ? 'peekVisible' : 'peekHidden';
  }
  if (last.ambientActivity === 'sleeping' || last.ambientActivity === 'grooming') {
    return 'resting';
  }
  return 'idle';
}

/** What happens next for each ambient phase, given the current cat/settings/time. This is
 * the one switch that used to be a dozen independent, order-sensitive boolean checks. */
function advanceAmbientPhase(input: {
  cat: CatState;
  settings: ExtensionSettings;
  now: number;
  last: CatPresentation | null;
}): ResolvedPresence {
  const { cat, settings, now, last } = input;
  const previousUntil = last?.ambientPeekUntil ?? null;
  const previousActivity = last?.ambientActivity ?? null;

  switch (classifyAmbientPhase(last)) {
    case 'stayVisible': {
      if (isStayVisibleAfterReveal(last!, now)) {
        // Still-active grace window: keep showing whatever reveal restored (or nothing, if
        // it restored back into another peek — that's not a real resting mood to hold onto).
        return presence({
          companionVisible: true,
          ambientActivity: previousActivity === 'peeking' ? null : previousActivity,
          ambientPeekUntil: previousActivity === 'peeking' ? null : previousUntil,
        });
      }
      if (isStayVisibleAfterRevealExpired(last!, now)) {
        // Grace window over: always resume the normal ambient cycle from a fresh peek,
        // regardless of what reveal had restored — that's the intended landing spot, not a
        // fallback (see "returns to peeking after stay-visible ends" in presence.test.ts).
        return startPeekVisit({ cat, settings, now, recordAmbient: false });
      }
      return presence({});
    }

    case 'peekVisible':
      if (isAmbientPeekVisitExpired(last!, now)) {
        // The visible visit's timer can run out between presentation reads (e.g. the user
        // switches tabs partway through it) without anything having ducked her away yet.
        return presence(enterPeekDuckGap(now, settings, cat.adoptedAt));
      }
      return presence({
        companionVisible: true,
        ambientActivity: 'peeking',
        ambientPeekUntil: previousUntil,
        peekEdge: last!.peekEdge ?? null,
        peekInset: last!.peekInset ?? null,
        peekCorner: last!.peekCorner ?? null,
      });

    case 'peekHidden':
      if (isAmbientPeekDuckGapActive(last!, now)) {
        return presence({ ambientActivity: 'peeking', ambientPeekUntil: previousUntil });
      }
      // Duck gap over: peek again from a fresh corner.
      return startPeekVisit({ cat, settings, now, recordAmbient: false });

    case 'resting':
      if (isAmbientPeekActive(previousUntil, now)) {
        return presence({
          companionVisible: last!.companionVisible,
          ambientActivity: previousActivity,
          ambientPeekUntil: previousUntil,
        });
      }
      // Rest timer over: a visible rest (from a restored grooming, say) picks back up with a
      // fresh peek immediately; a hidden one defers to the same "what should ambient do right
      // now" decision idle uses below — it must not keep showing the just-expired timer.
      if (last!.companionVisible) {
        return startPeekVisit({ cat, settings, now, recordAmbient: false });
      }
      return decideIdleAmbient({ cat, settings, now, restUntil: previousUntil });

    case 'idle':
      return decideIdleAmbient({ cat, settings, now, restUntil: previousUntil });
  }
}

/** What ambient state (if any) should start from a standing idle position: a fresh (visible)
 * rest if one's due, a fresh peek during daytime, or nothing. Shared by the 'idle' phase and
 * by 'resting' once its timer has run out with nothing else to show — both ask the same
 * question. */
function decideIdleAmbient(input: {
  cat: CatState;
  settings: ExtensionSettings;
  now: number;
  restUntil: number | null;
}): ResolvedPresence {
  const { cat, settings, now, restUntil } = input;
  if (
    shouldStartAmbientRest({ cat, settings, now, speechWouldAppear: false, restUntil })
  ) {
    // Napping/grooming is ambient flavor, not a reason to vanish — she stays on screen the
    // whole time. The only state that's ever allowed to hide her is the brief peek duck-gap
    // between corners (enterPeekDuckGap), which the phases below handle on their own.
    return presence({
      companionVisible: true,
      ambientActivity: pickAmbientRestActivity(now),
      ambientPeekUntil: now + pickAmbientPeekDurationMs(settings, now, cat.adoptedAt),
      recordAmbient: true,
    });
  }
  if (!isDaytime(new Date(now).getHours(), settings)) {
    // Nighttime idle stays hidden regardless of the care-grace period below — that period
    // only ever holds off starting something new during the day, it never overrides "it's
    // quiet hours, stay hidden."
    return presence({});
  }
  // shouldStartAmbientRest already defers a fresh rest until a bit after the last interaction
  // (isSleepDeferred); a fresh peek visit needs that same settle period, or she'd start
  // peeking the moment an interaction ends and the next tick happens to run (e.g. within a
  // minute, via the periodic alarm) — nothing should start on its own right after the user
  // just did something with her. She stays exactly as visible as she already was — deferring
  // ambient activity must not be confused with hiding her (presence({}) defaults to hidden).
  if (isSleepDeferred(cat, now)) {
    return presence({ companionVisible: true });
  }
  return startPeekVisit({ cat, settings, now, recordAmbient: true });
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
    const speechActive = isSpeechTriggerActive(input.speechTrigger);
    const peekCycleActive = input.lastPresentation?.ambientActivity === 'peeking';
    // A forced recompute (a dev "force tick", or a tab regaining focus while forceDevSpeech
    // is on) must not cancel a peek already in progress — every focus change would otherwise
    // silently bounce her back to her pre-peek mood the instant the user switched tabs. Defer
    // to the same ambient-phase machine an unforced recompute uses, same exception for urgent
    // speech as the check below.
    if (peekCycleActive && !(speechActive && isUrgentSpeechTrigger(input.speechTrigger))) {
      return advanceAmbientPhase({
        cat: input.cat,
        settings: input.settings,
        now: input.now,
        last: input.lastPresentation,
      });
    }
    return presence({
      companionVisible: true,
      recordSpeech: speechActive,
    });
  }

  // No isDevMoodForced check here: resolveCompanionPresence has exactly one caller
  // (the tick reducer), which already branches to buildDevPreviewPresentation and returns
  // before ever reaching this function when dev mode forces a mood.
  if (isDevMoodForced(input.settings)) {
    return presence({ companionVisible: true });
  }

  const speechActive = isSpeechTriggerActive(input.speechTrigger);
  const peekCycleActive = input.lastPresentation?.ambientActivity === 'peeking';

  // Non-urgent speech never interrupts an active peek cycle (ambient peeking runs on its own
  // timer and would otherwise duck her out mid-visit for no reason); an urgent one (hungry,
  // starving) always does — she shouldn't hide real distress behind a peek.
  if (speechActive && !(peekCycleActive && !isUrgentSpeechTrigger(input.speechTrigger))) {
    return presence({ companionVisible: true, recordSpeech: true });
  }

  return advanceAmbientPhase({
    cat: input.cat,
    settings: input.settings,
    now: input.now,
    last: input.lastPresentation,
  });
}
