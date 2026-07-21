import { getCatState } from '../db';
import { patchPresentationForDevForce } from '../presentation';
import { getSettings } from '../settings';
import type { CatPresentation } from '../types';
import { STORAGE_KEYS } from '../types';
import { computeCareActionState } from './care-actions';
import { computeTickState } from './ambient-tick';
import {
  computeClearSpeechState,
  computeRestartIntroState,
  computeSettleAfterIntroState,
  computeShowOnPageState,
} from './presentation-lookup';
import { computeDevHideState, computeDevPreviewState } from './dev-tools';
import { IS_DEV_BUILD, type CatEvent, type OrchestratorState } from './types';

export async function loadOrchestratorState(): Promise<OrchestratorState> {
  const [cat, settings] = await Promise.all([
    getCatState(),
    getSettings(IS_DEV_BUILD),
  ]);
  const lastPresentation = await readCachedPresentation();
  return {
    cat,
    settings,
    isUserIdle: false,
    lastPresentation,
  };
}

export async function persistPresentation(
  presentation: CatPresentation,
  now = Date.now(),
): Promise<void> {
  const [settings, stored] = await Promise.all([
    getSettings(IS_DEV_BUILD),
    readCachedPresentation(),
  ]);
  const finalized = patchPresentationForDevForce(presentation, settings, now, stored);
  await browser.storage.local.set({
    [STORAGE_KEYS.presentation]: finalized,
  });
}

export async function readCachedPresentation(): Promise<CatPresentation | null> {
  const result = await browser.storage.local.get([STORAGE_KEYS.presentation]);
  return (result[STORAGE_KEYS.presentation] as CatPresentation | undefined) ?? null;
}

/**
 * Serializes overlapping presentation reads+writes (e.g. a care action racing the
 * background's tab-switch recompute, or a popup-triggered dev preview racing an
 * ambient tick): each call reads the cached presentation, computes a new one, then
 * persists it, and without serialization a slow call's read-then-write can straddle
 * a faster call's write and silently clobber it with stale data on completion.
 * Queuing calls one after another means every read always sees the previous call's
 * finished write. reduceCat is the only thing that uses this directly — every other
 * presentation-computing function (dev preview, clear speech, settle-after-intro, etc.)
 * still calls it individually since those are narrower, one-off operations, not part of
 * the care-action/ambient-recompute duo reduceCat exists to keep from racing each other.
 */
let presentationQueue: Promise<unknown> = Promise.resolve();

export function serializePresentationWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = presentationQueue.then(task);
  presentationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * THE single place that decides what Tabby's presentation becomes for a care action or an
 * ambient recompute — the two categories every normal-user-facing trigger falls into. Every
 * caller builds a CatEvent and calls this rather than reading-computing-persisting on its
 * own; it owns that whole cycle, including serialization, so two different kinds of event
 * (e.g. a care action and a tab-switch recompute landing around the same time) can never
 * race each other and silently clobber one's result with the other's stale read.
 */
export function reduceCat(event: CatEvent): Promise<OrchestratorState> {
  return serializePresentationWrite(() => runReduceCat(event));
}

async function runReduceCat(event: CatEvent): Promise<OrchestratorState> {
  switch (event.type) {
    case 'careAction':
      return computeCareActionState(event.action, event.now, event.page);
    case 'tick':
      return computeTickState(event.now, {
        page: event.page,
        forceDevSpeech: event.forceDevSpeech,
        forceTick: event.forceTick,
        isUserIdle: event.isUserIdle,
      });
    case 'showOnPage':
      return computeShowOnPageState(event.now, event.page);
    case 'clearSpeech':
      return computeClearSpeechState(event.now);
    case 'settleAfterIntro':
      return computeSettleAfterIntroState(event.now);
    case 'restartIntro':
      return computeRestartIntroState(event.now);
    case 'devPreview':
      return computeDevPreviewState(event.now);
    case 'devHide':
      return computeDevHideState(event.now);
  }
}
