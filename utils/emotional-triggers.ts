import {
  EMPTY_DRAINING_SESSION,
  isInDrainingRecovery,
  pendingOverwhelmedNudge,
  pendingRecoveryNudge,
  type DrainingSessionState,
} from './draining-session';
import { daysTogether, deriveMoodFromVitals } from './cat-sim';
import { resolveDisplayMood } from './presentation';
import { isQuietHour, effectiveAppearanceLimits } from './settings';
import { fallbackSpeech, triggerKindToSpeechKind } from './speech-fallback';
import type { SpeechContext } from './speech-types';
import type {
  CatMood,
  CatState,
  CatVitals,
  ExtensionSettings,
  MemorySeed,
  SpeechTriggerKind,
} from './types';

export interface EmotionalTriggerInput {
  cat: CatState;
  vitals: CatVitals;
  settings: ExtensionSettings;
  now: number;
  isUserIdle: boolean;
  recentMemory: MemorySeed | null;
  forceDevSpeech?: boolean;
  /** Dev-only manual tick — bypass cooldown/quiet hours and always speak. */
  forceTick?: boolean;
  pageTitle?: string;
  pageTopic?: string;
  drainingSession?: DrainingSessionState;
}

export interface EmotionalTriggerResult {
  shouldAppear: boolean;
  mood: CatMood;
  speechContext: SpeechContext | null;
  triggerKind: SpeechTriggerKind | null;
}

function minutesSince(timestamp: number, now: number): number {
  if (timestamp <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return (now - timestamp) / 60_000;
}

function resolvePrimaryNeed(
  vitals: CatVitals,
  mood: CatMood,
): SpeechTriggerKind | null {
  if (mood === 'starving') {
    return 'starving';
  }
  if (mood === 'hungry') {
    return 'hungry';
  }
  if (mood === 'stressed') {
    return 'stressed';
  }
  if (mood === 'overwhelmed') {
    return null;
  }
  if (mood === 'sleepy') {
    return 'sleepy';
  }
  if (mood === 'happy') {
    return 'happy';
  }
  if (mood === 'curious') {
    return 'curious';
  }
  if (vitals.happiness < 40) {
    return 'lonely';
  }
  return null;
}

function buildSpeechContext(input: {
  kind: SpeechContext['kind'];
  mood: CatMood;
  stage: CatState['stage'];
  seed: number;
  pageTitle?: string;
  pageTopic?: string;
  memoryTopic?: string;
  milestoneDays?: number;
}): SpeechContext {
  return {
    kind: input.kind,
    mood: input.mood,
    stage: input.stage,
    seed: input.seed,
    pageTitle: input.pageTitle,
    pageTopic: input.pageTopic,
    memoryTopic: input.memoryTopic,
    milestoneDays: input.milestoneDays,
  };
}

function buildMilestoneDays(cat: CatState, now: number): number | null {
  const days = daysTogether(cat.adoptedAt, now);
  const milestones = [1, 7, 30, 100, 365];
  return milestones.includes(days) ? days : null;
}

/** Decide whether Tabby should appear and what she should talk about. */
export function evaluateEmotionalTrigger(
  input: EmotionalTriggerInput,
): EmotionalTriggerResult {
  const {
    cat,
    vitals,
    settings,
    now,
    isUserIdle,
    recentMemory,
    forceDevSpeech,
    forceTick,
    pageTitle,
    pageTopic,
    drainingSession,
  } = input;
  const derivedMood = deriveMoodFromVitals({ vitals, now, settings, isUserIdle });
  const mood = resolveDisplayMood({
    settings,
    derivedMood,
    drainingSession: drainingSession ?? EMPTY_DRAINING_SESSION,
  });
  const limits = effectiveAppearanceLimits(settings);
  const overwhelmedKind = pendingOverwhelmedNudge(
    drainingSession ?? EMPTY_DRAINING_SESSION,
  );
  const recoveryNudge = pendingRecoveryNudge(
    drainingSession ?? EMPTY_DRAINING_SESSION,
  );

  if (forceTick || (forceDevSpeech && settings.devModeEnabled)) {
    const primaryNeed = resolvePrimaryNeed(vitals, mood);
    const triggerKind = primaryNeed ?? 'happy';
    return {
      shouldAppear: true,
      mood,
      speechContext: buildSpeechContext({
        kind: triggerKindToSpeechKind(triggerKind),
        mood,
        stage: cat.stage,
        seed: now,
        pageTitle,
        pageTopic,
      }),
      triggerKind,
    };
  }

  if (isQuietHour(new Date(now).getHours(), settings) && !settings.devModeEnabled) {
    return {
      shouldAppear: false,
      mood,
      speechContext: null,
      triggerKind: null,
    };
  }

  if (cat.nudgesToday >= limits.maxPerDay) {
    return {
      shouldAppear: false,
      mood,
      speechContext: null,
      triggerKind: null,
    };
  }

  const cooldownElapsed = minutesSince(cat.lastSpeechAt, now);
  if (cooldownElapsed < limits.cooldownMinutes) {
    return {
      shouldAppear: false,
      mood,
      speechContext: null,
      triggerKind: null,
    };
  }

  const milestoneDays = buildMilestoneDays(cat, now);
  if (milestoneDays) {
    return {
      shouldAppear: true,
      mood: mood === 'content' ? 'happy' : mood,
      speechContext: buildSpeechContext({
        kind: 'milestone',
        mood: mood === 'content' ? 'happy' : mood,
        stage: cat.stage,
        seed: now,
        pageTitle,
        pageTopic,
        milestoneDays,
      }),
      triggerKind: 'milestone',
    };
  }

  const primaryNeed = resolvePrimaryNeed(vitals, mood);
  if (primaryNeed && ['starving', 'hungry'].includes(primaryNeed)) {
    return {
      shouldAppear: true,
      mood,
      speechContext: buildSpeechContext({
        kind: triggerKindToSpeechKind(primaryNeed),
        mood,
        stage: cat.stage,
        seed: now,
        pageTitle,
        pageTopic,
      }),
      triggerKind: primaryNeed,
    };
  }

  if (overwhelmedKind && mood === 'overwhelmed') {
    return {
      shouldAppear: true,
      mood: 'overwhelmed',
      speechContext: buildSpeechContext({
        kind: overwhelmedKind === 'social' ? 'overwhelmed_social' : 'overwhelmed_news',
        mood: 'overwhelmed',
        stage: cat.stage,
        seed: now,
        pageTitle,
        pageTopic,
      }),
      triggerKind: 'overwhelmed',
    };
  }

  if (recoveryNudge === 'easing') {
    return {
      shouldAppear: true,
      mood: 'stressed',
      speechContext: buildSpeechContext({
        kind: 'recovery_easing',
        mood: 'stressed',
        stage: cat.stage,
        seed: now,
        pageTitle,
        pageTopic,
      }),
      triggerKind: 'recovery_easing',
    };
  }

  if (recoveryNudge === 'thanks') {
    return {
      shouldAppear: true,
      mood: 'happy',
      speechContext: buildSpeechContext({
        kind: 'recovery_thanks',
        mood: 'happy',
        stage: cat.stage,
        seed: now,
        pageTitle,
        pageTopic,
      }),
      triggerKind: 'recovery_thanks',
    };
  }

  if (primaryNeed && ['stressed', 'lonely'].includes(primaryNeed)) {
    if (!isInDrainingRecovery(drainingSession ?? EMPTY_DRAINING_SESSION)) {
      return {
        shouldAppear: true,
        mood,
        speechContext: buildSpeechContext({
          kind: triggerKindToSpeechKind(primaryNeed),
          mood,
          stage: cat.stage,
          seed: now,
          pageTitle,
          pageTopic,
        }),
        triggerKind: primaryNeed,
      };
    }
  }

  if (recentMemory && vitals.happiness >= 50) {
    return {
      shouldAppear: true,
      mood,
      speechContext: buildSpeechContext({
        kind: 'memory',
        mood,
        stage: cat.stage,
        seed: now,
        pageTitle,
        pageTopic,
        memoryTopic: recentMemory.topic,
      }),
      triggerKind: 'memory',
    };
  }

  if (primaryNeed && ['happy', 'curious', 'sleepy'].includes(primaryNeed)) {
    const shouldSpeakSoftly = vitals.happiness > 70 || isUserIdle;
    if (shouldSpeakSoftly) {
      return {
        shouldAppear: true,
        mood,
        speechContext: buildSpeechContext({
          kind: triggerKindToSpeechKind(primaryNeed),
          mood,
          stage: cat.stage,
          seed: now + cat.nudgesToday,
          pageTitle,
          pageTopic,
        }),
        triggerKind: primaryNeed,
      };
    }
  }

  return {
    shouldAppear: false,
    mood,
    speechContext: null,
    triggerKind: null,
  };
}

/** Sync preview used in tests. */
export function previewTriggerSpeech(context: SpeechContext): string {
  return fallbackSpeech(context);
}
