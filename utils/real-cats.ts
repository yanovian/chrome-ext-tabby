import { blockedCornersForHost, slotsForToken, type AvoidToken, type PeekSlot } from './site-registry/corner-avoidance';
import type { CatLifeStage, CatPresentation } from './types';

/** Where the packaged real cat photos live, relative to the extension root. */
export const REAL_CATS_BASE_PATH = 'real-cats/';

/** How long a cameo stays up (fully slid in, before it slides back out) when its own row
 * below doesn't say otherwise. */
export const DEFAULT_REAL_CAT_HOLD_MS = 30_000;

export interface RealCatPhoto {
  file: string;
  /** Which corner(s) — short slot code or `l`/`r`/`b` group, same vocabulary as
   * site-registry/corner-avoidance.ts — this photo's composition/crop actually works at. */
  token: AvoidToken;
  /** Life stages she can be at for this photo to show. Omitted means any stage — most
   * "funny cat" photos aren't kitten- or adult-specific. */
  stages?: readonly CatLifeStage[];
  /** How long this specific photo stays up. Omitted means DEFAULT_REAL_CAT_HOLD_MS — some
   * photos are worth lingering on longer, some are a quicker gag. */
  holdMs?: number;
  /** Multiplier on the cameo's base display size. Omitted means 1 (no change) — the source
   * photos aren't all cropped/composed the same way, so the subject can end up reading
   * noticeably bigger or smaller than the others at the same base size; nudge this per photo
   * until they all read as roughly the same size on screen. */
  scale?: number;
}

/**
 * Real cat photo cameos shown while she's ducked away after being shooed (see
 * entrypoints/content/overlay/real-cat-cameo.ts). One row per file in public/real-cats/ —
 * add a photo to that folder and a matching row here to bring it into rotation.
 */
export const REAL_CAT_PHOTOS: readonly RealCatPhoto[] = [
  { file: 'funny-cat-b-1.png', token: 'b' },
  { file: 'funny-cat-b-2.png', token: 'b', scale: 1.2 },
  { file: 'funny-cat-b-3.png', token: 'b', holdMs: 4_000, scale: 0.8 },
  { file: 'funny-cat-bl-1.png', token: 'bl', scale: 1.8 },
  { file: 'funny-cat-b-4.png', token: 'b' },
  { file: 'funny-cat-b-5-fast.png', token: 'b', holdMs: 2_000, scale: 1.6 },
  { file: 'funny-cat-br-6.png', token: 'br', scale: 1.3 },
  { file: 'funny-cat-b-7.png', token: 'br', scale: 2.1 },
];

export function realCatAssetPath(file: string): string {
  return `${REAL_CATS_BASE_PATH}${file}`;
}

export interface RealCatPlacement {
  file: string;
  slot: PeekSlot;
  /** The photo's own declared token (before group expansion) — 'bl'/'br' specifically (not
   * the 'b' group) mean the photo is composed for that exact corner, which changes which
   * direction its cameo slides in from (see real-cat-cameo.ts's SLOT_ANCHOR). */
  token: AvoidToken;
  holdMs: number;
  scale: number;
}

/** Picks a random real cat photo (or the dev-forced one) and a concrete corner for it —
 * expanding its filename's slot/group token and filtering out whatever corners the current
 * host's own chat bubble/menu already occupies, exactly like her own peek placement does
 * (see ambient-presence.ts's pickPeekPlacementForHost). Returns null when nothing qualifies
 * (e.g. a forced photo that doesn't fit this life stage, or every one of its corners is
 * blocked on this site) — callers should just skip the cameo rather than force a bad spot. */
export function pickRealCatPhoto(
  input: {
    seed: number;
    stage: CatLifeStage;
    hostname?: string;
    forcedFile?: string;
  },
  photoList: readonly RealCatPhoto[] = REAL_CAT_PHOTOS,
): RealCatPlacement | null {
  const blocked = blockedCornersForHost(input.hostname);
  const photos = input.forcedFile
    ? photoList.filter((photo) => photo.file === input.forcedFile)
    : photoList;

  const candidates = photos
    .filter((photo) => !photo.stages || photo.stages.includes(input.stage))
    .flatMap((photo) =>
      slotsForToken(photo.token)
        .filter((slot) => !blocked.has(slot))
        .map((slot) => ({
          file: photo.file,
          slot,
          token: photo.token,
          holdMs: photo.holdMs ?? DEFAULT_REAL_CAT_HOLD_MS,
          scale: photo.scale ?? 1,
        })),
    );

  if (candidates.length === 0) {
    return null;
  }
  return candidates[Math.abs(input.seed) % candidates.length]!;
}

interface DuckGapPresentation {
  companionVisible: boolean;
  ambientActivity: CatPresentation['ambientActivity'];
  ambientPeekUntil: CatPresentation['ambientPeekUntil'];
  lastCareAction: CatPresentation['lastCareAction'];
}

/** True the moment a shoo-triggered peek visit ducks away — the one instant a real cat
 * cameo should get scheduled for when that duck gap ends. Ordinary ambient peeking (never
 * shooed) never qualifies, so she only gets upstaged by a cameo right after being told to go
 * play by herself, never during a quiet spontaneous peek. */
export function isEnteringShooDuckGap(
  presentation: DuckGapPresentation,
  previous: Pick<DuckGapPresentation, 'companionVisible' | 'ambientPeekUntil'>,
): boolean {
  return (
    previous.companionVisible &&
    !presentation.companionVisible &&
    presentation.ambientActivity === 'peeking' &&
    presentation.ambientPeekUntil != null &&
    presentation.ambientPeekUntil !== previous.ambientPeekUntil &&
    presentation.lastCareAction === 'shoo'
  );
}
