import { buildInteractionOptions, buildSecondaryInteractionOptions } from './cat-interactions';
import { deriveMoodFromVitals, resolveLifeStage } from './cat-sim';
import {
  EMPTY_DRAINING_SESSION,
  isDrainingSessionOverwhelmed,
  isDrainingSessionStressed,
  isInDrainingRecovery,
  pendingRecoveryNudge,
  type DrainingSessionState,
} from './draining-session';
import { resolveCompanionAnimation } from './companion-animation';
import { isFeedingActive } from './feeding-moment';
import { isPlayingActive } from './play-moment';
import { lifeStageLabel } from './sprites';
import { pickPeekPlacement, type AmbientActivity, type PeekPlacement } from './ambient-presence';
import type { CatPresentation, CatState, CatVitals, ExtensionSettings, CatMood } from './types';

export function moodForAmbient(activity: AmbientActivity): CatMood {
  if (activity === 'sleeping') {
    return 'sleepy';
  }
  if (activity === 'peeking') {
    return 'peek';
  }
  return 'content';
}

/** Pick the mood shown on screen — dev override, vitals, ambient activity, or long draining session. */
export function resolveDisplayMood(input: {
  settings: ExtensionSettings;
  derivedMood: CatMood;
  drainingSession?: DrainingSessionState;
  ambientActivity?: AmbientActivity | null;
  moodOverride?: CatMood;
}): CatMood {
  if (input.settings.devModeEnabled && input.settings.devForceMood !== 'auto') {
    return input.settings.devForceMood;
  }

  if (input.moodOverride) {
    return input.moodOverride;
  }

  const urgentMoods: CatMood[] = ['starving', 'hungry'];
  if (urgentMoods.includes(input.derivedMood)) {
    return input.derivedMood;
  }

  if (input.ambientActivity === 'peeking') {
    return 'peek';
  }

  const session = input.drainingSession ?? EMPTY_DRAINING_SESSION;
  if (isInDrainingRecovery(session)) {
    if (pendingRecoveryNudge(session) === 'thanks') {
      return 'happy';
    }
    return 'stressed';
  }
  if (isDrainingSessionOverwhelmed(session, input.settings)) {
    return 'overwhelmed';
  }
  if (isDrainingSessionStressed(session, input.settings)) {
    return 'stressed';
  }

  if (
    input.ambientActivity &&
    (input.derivedMood === 'content' || input.derivedMood === 'curious')
  ) {
    return moodForAmbient(input.ambientActivity);
  }

  const stickyMoods: CatMood[] = ['sleepy', 'happy', 'stressed'];
  if (stickyMoods.includes(input.derivedMood)) {
    return input.derivedMood;
  }

  return input.derivedMood;
}

/** Tabby is in a watch-only edge peek (ambient or dev preview). */
export function isPeekPresentation(input: {
  mood: CatMood;
  companionVisible: boolean;
}): boolean {
  return input.companionVisible && input.mood === 'peek';
}

/** Keep peek mood for one hide so the duck-out clip can play. */
export function moodOverrideWhileHiding(
  lastMood: CatMood | undefined,
  companionVisible: boolean,
): CatMood | undefined {
  if (companionVisible || lastMood !== 'peek') {
    return undefined;
  }
  return 'peek';
}

/** Shared peek placement for dev preview and production ambient peeks. */
export function resolvePeekPlacementForBuild(input: {
  isPeeking: boolean;
  peekEdge?: import('./ambient-presence').PeekEdge | null;
  peekInset?: number | null;
  peekCorner?: import('./ambient-presence').PeekCorner | null;
  seed: number;
}): PeekPlacement | null {
  if (!input.isPeeking) {
    return null;
  }
  if (input.peekEdge) {
    return {
      edge: input.peekEdge,
      inset: input.peekInset ?? 16,
      corner: input.peekCorner ?? 'left',
    };
  }
  return pickPeekPlacement(input.seed);
}

/** Peek placement for layout when mood is peek but edge fields were cleared. */
export function resolveEffectivePeekPlacement(
  presentation: CatPresentation,
  now = Date.now(),
): import('./ambient-presence').PeekPlacement {
  if (presentation.peekEdge) {
    return {
      edge: presentation.peekEdge,
      inset: presentation.peekInset ?? 16,
      corner: presentation.peekCorner ?? 'left',
    };
  }
  return pickPeekPlacement(now);
}

export function buildPresentation(input: {
  cat: CatState;
  vitals: CatVitals;
  settings: ExtensionSettings;
  now: number;
  isUserIdle: boolean;
  speech: string | null;
  triggerKind: CatPresentation['triggerKind'];
  overlayHidden: boolean;
  moodOverride?: CatMood;
  lastCareAction?: import('./cat-interactions').InteractionAction | null;
  companionVisible: boolean;
  ambientActivity?: AmbientActivity | null;
  ambientPeekUntil?: number | null;
  peekEdge?: import('./ambient-presence').PeekEdge | null;
  peekInset?: number | null;
  peekCorner?: import('./ambient-presence').PeekCorner | null;
  peekRestoreAmbientActivity?: AmbientActivity | null;
  peekRestoreAmbientUntil?: number | null;
  stayVisibleUntil?: number | null;
  eatingUntil?: number | null;
  playingUntil?: number | null;
  drainingSession?: DrainingSessionState;
}): CatPresentation {
  const derivedMood = deriveMoodFromVitals({
    vitals: input.vitals,
    cat: input.cat,
    now: input.now,
    settings: input.settings,
    isUserIdle: input.isUserIdle,
  });
  const devMoodForced =
    input.settings.devModeEnabled && input.settings.devForceMood !== 'auto';
  const mood = resolveDisplayMood({
    settings: input.settings,
    derivedMood,
    drainingSession: input.drainingSession,
    ambientActivity: input.ambientActivity,
    moodOverride: input.moodOverride,
  });

  const stage = resolveLifeStage(
    input.cat.adoptedAt,
    input.now,
    input.settings.devForceLifeStage,
  );
  const eatingUntil = input.eatingUntil ?? null;
  const playingUntil = input.playingUntil ?? null;
  const feedingActive = isFeedingActive(eatingUntil, input.now);
  const playingActive = isPlayingActive(playingUntil, input.now);
  const isPeeking = isPeekPresentation({ mood, companionVisible: input.companionVisible });
  const peekPlacement = resolvePeekPlacementForBuild({
    isPeeking,
    peekEdge: input.peekEdge,
    peekInset: input.peekInset,
    peekCorner: input.peekCorner,
    seed: input.now + input.cat.adoptedAt,
  });
  const ambientActivity = isPeeking ? ('peeking' as const) : (input.ambientActivity ?? null);

  return {
    mood,
    stage,
    stageLabel: lifeStageLabel(stage),
    sprite: resolveCompanionAnimation({
      stage,
      mood,
      ambientActivity,
      lastCareAction: input.lastCareAction,
      eatingUntil,
      playingUntil,
      now: input.now,
    }),
    speech: input.speech,
    triggerKind: input.triggerKind,
    overlayHidden: input.overlayHidden,
    canPet: !isPeeking,
    canTreat: !isPeeking && !feedingActive && (mood === 'hungry' || mood === 'starving'),
    canPlay: !isPeeking && !playingActive && mood !== 'sleepy' && input.vitals.happiness < 70,
    interactions: buildInteractionOptions(mood, input.vitals, stage),
    secondaryInteractions: buildSecondaryInteractionOptions(),
    lastCareAction: input.lastCareAction ?? null,
    companionVisible: input.companionVisible,
    ambientActivity,
    ambientPeekUntil: input.ambientPeekUntil ?? null,
    peekEdge: peekPlacement?.edge ?? null,
    peekInset: peekPlacement?.inset ?? null,
    peekCorner: peekPlacement?.corner ?? null,
    peekRestoreAmbientActivity: isPeeking
      ? (input.peekRestoreAmbientActivity ?? null)
      : null,
    peekRestoreAmbientUntil: isPeeking ? (input.peekRestoreAmbientUntil ?? null) : null,
    stayVisibleUntil:
      devMoodForced
        ? null
        : isPeeking
          ? null
          : (input.stayVisibleUntil ?? null),
    eatingUntil,
    playingUntil,
  };
}

/** Overlay-side dev mood patch (no cat vitals needed). */
export function patchPresentationForDevForce(
  presentation: CatPresentation,
  settings: ExtensionSettings,
  now = Date.now(),
): CatPresentation {
  if (!settings.devModeEnabled || settings.devForceMood === 'auto') {
    return presentation;
  }

  const mood = settings.devForceMood;
  const peeking = mood === 'peek';
  const keepPeekPlacement = peeking && presentation.mood === 'peek';
  const peekPlacement = peeking
    ? resolvePeekPlacementForBuild({
        isPeeking: true,
        peekEdge: keepPeekPlacement ? presentation.peekEdge : null,
        peekInset: keepPeekPlacement ? presentation.peekInset : null,
        peekCorner: keepPeekPlacement ? presentation.peekCorner : null,
        seed: now,
      })
    : null;

  return {
    ...presentation,
    mood,
    companionVisible: true,
    stayVisibleUntil: null,
    ambientActivity: peeking ? 'peeking' : null,
    ambientPeekUntil: null,
    peekEdge: peekPlacement?.edge ?? null,
    peekInset: peekPlacement?.inset ?? null,
    peekCorner: peekPlacement?.corner ?? null,
    peekRestoreAmbientActivity: null,
    peekRestoreAmbientUntil: null,
    sprite: resolveCompanionAnimation({
      stage: presentation.stage,
      mood,
      ambientActivity: peeking ? 'peeking' : null,
      lastCareAction: presentation.lastCareAction,
      eatingUntil: presentation.eatingUntil,
      playingUntil: presentation.playingUntil,
      now,
    }),
    canPet: !peeking,
    canTreat: !peeking && presentation.canTreat,
    canPlay: !peeking && presentation.canPlay,
  };
}
