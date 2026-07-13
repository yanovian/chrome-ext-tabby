import {
  buildInteractionOptions,
  buildSecondaryInteractionOptions,
  type InteractionAction,
} from './cat-interactions';
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
import {
  pickPeekPlacement,
  type AmbientActivity,
  type PeekCorner,
  type PeekEdge,
  type PeekPlacement,
} from './ambient-presence';
import { isDevMoodForced } from './settings';
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
  if (isDevMoodForced(input.settings)) {
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

/** Keep an existing peek edge/inset/corner, or roll a new one if unset. */
function keepOrPickPeekPlacement(
  peekEdge: PeekEdge | null | undefined,
  peekInset: number | null | undefined,
  peekCorner: PeekCorner | null | undefined,
  seed: number,
): PeekPlacement {
  if (peekEdge) {
    return { edge: peekEdge, inset: peekInset ?? 16, corner: peekCorner ?? 'left' };
  }
  return pickPeekPlacement(seed);
}

/** Shared peek placement for dev preview and production ambient peeks. */
export function resolvePeekPlacementForBuild(input: {
  isPeeking: boolean;
  peekEdge?: PeekEdge | null;
  peekInset?: number | null;
  peekCorner?: PeekCorner | null;
  seed: number;
}): PeekPlacement | null {
  if (!input.isPeeking) {
    return null;
  }
  return keepOrPickPeekPlacement(input.peekEdge, input.peekInset, input.peekCorner, input.seed);
}

/** Peek placement for layout when mood is peek but edge fields were cleared. */
export function resolveEffectivePeekPlacement(
  presentation: CatPresentation,
  now = Date.now(),
): PeekPlacement {
  return keepOrPickPeekPlacement(
    presentation.peekEdge,
    presentation.peekInset,
    presentation.peekCorner,
    now,
  );
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
  lastCareAction?: InteractionAction | null;
  companionVisible: boolean;
  ambientActivity?: AmbientActivity | null;
  ambientPeekUntil?: number | null;
  peekEdge?: PeekEdge | null;
  peekInset?: number | null;
  peekCorner?: PeekCorner | null;
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
  const devMoodForced = isDevMoodForced(input.settings);
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

/**
 * Overlay-side dev mood patch (no cat vitals needed).
 *
 * `storedPresentation`, when given, is the freshest value already in
 * storage. It — not `presentation` — decides whether to keep the existing
 * peek edge. `presentation` can be stale: a slow, concurrently-running
 * computation that started before dev mode was forced can still finish and
 * reach this function afterwards, carrying a freshly (and wrongly) rolled
 * peek edge of its own. Preferring the value already on disk means that
 * stale write can no longer clobber a placement a newer call already
 * settled on.
 */
export function patchPresentationForDevForce(
  presentation: CatPresentation,
  settings: ExtensionSettings,
  now = Date.now(),
  storedPresentation?: CatPresentation | null,
): CatPresentation {
  if (!isDevMoodForced(settings)) {
    return presentation;
  }

  const reference = storedPresentation ?? presentation;
  const mood = settings.devForceMood;
  const peeking = mood === 'peek';
  const keepPeekPlacement = peeking && reference.mood === 'peek';
  const peekPlacement = peeking
    ? resolvePeekPlacementForBuild({
        isPeeking: true,
        peekEdge: keepPeekPlacement ? reference.peekEdge : null,
        peekInset: keepPeekPlacement ? reference.peekInset : null,
        peekCorner: keepPeekPlacement ? reference.peekCorner : null,
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
