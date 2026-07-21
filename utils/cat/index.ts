/**
 * Tabby's single source of truth: what she looks like, where she is, what she's doing, and
 * what she's saying right now — plus the one reducer that's allowed to change any of it.
 *
 * Split across this folder by concern:
 * - state-io.ts: the persisted state shape's I/O, the write-serialization queue, and reduceCat
 *   (the one dispatcher every event funnels through).
 * - care-actions.ts: dispatches a care action to the do-not-disturb/reveal/shoo special cases
 *   or to care-general.ts for pet/treat/play/ask/dismiss.
 * - care-general.ts: the pet/treat/play/ask/dismiss branch itself.
 * - care-moments.ts: the feeding/playing "moments" a treat/play action can kick off (munching,
 *   wild paws, then a thank-you), shared with ambient-tick.ts which continues/completes them.
 * - ambient-tick.ts: the ambient recompute (the other half of "what does she look like now",
 *   alongside care-actions) — memories, emotional triggers, and the presence machine below.
 * - presence.ts: the peek/rest/idle ambient phase state machine (formerly utils/presence.ts,
 *   merged in here since it's still "the Cat," just not crammed into one file).
 * - dev-tools.ts: dev-build-only preview/force-mood controls.
 * - presentation-lookup.ts: the content-script read path (getCurrentPresentation) plus the
 *   smaller one-off lifecycle events (show-on-page, clear-speech, settle-after-intro, etc).
 *
 * utils/orchestrator.ts keeps only genuine browser-extension glue (page-visit vitals scoring,
 * the minute-tick alarm handler, per-page overlay-hidden tracking, DND wrappers) built on top
 * of what's exported here.
 */
export type { OrchestratorState, PageContext, CatEvent } from './types';

export {
  loadOrchestratorState,
  persistPresentation,
  readCachedPresentation,
  reduceCat,
} from './state-io';

export { handleCareAction } from './care-actions';
export { completeFeedingIfDue, completePlayingIfDue } from './care-moments';

export {
  presentOnActiveTab,
  setUserIdle,
  evaluateAndPresent,
} from './ambient-tick';

export type { ResolvedPresence } from './presence';
export { resolveCompanionPresence } from './presence';

export type { DevTemperPayload } from './dev-tools';
export {
  getDevTemperState,
  syncDevTemperControls,
  devForceCompanionShow,
  devForceCompanionHide,
} from './dev-tools';

export {
  ensureCatExists,
  recordInteractionPing,
  showOverlayOnPage,
  getCurrentPresentation,
  restartIntroSession,
  clearCompanionSpeech,
  settleAfterIntro,
} from './presentation-lookup';
