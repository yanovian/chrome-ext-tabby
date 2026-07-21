import { deriveMoodFromVitals } from '../cat-sim';
import { pickAmbientPeekVisitDurationMs, pickStayVisibleAfterRevealMs } from '../ambient-presence';
import { careActionToDoNotDisturb, setDoNotDisturb } from '../do-not-disturb';
import { readDrainingSessionState, type DrainingSessionState } from '../draining-session';
import { buildPresentation, isPeekPresentation } from '../presentation';
import { resolvePeekRestoreAmbient } from '../peek-restore';
import { saveSettings } from '../settings';
import type { CareAction, CatPresentation, DoNotDisturbDuration } from '../types';
import { IS_DEV_BUILD, type OrchestratorState, type PageContext } from './types';
import { loadOrchestratorState, persistPresentation, reduceCat } from './state-io';
import { computeTickState } from './ambient-tick';
import { computeGeneralCareState } from './care-general';

export function handleCareAction(
  action: CareAction,
  now: number,
  page: PageContext = {},
): Promise<CatPresentation> {
  return reduceCat({ type: 'careAction', action, now, page }).then((state) => state.lastPresentation!);
}

/** Dispatches a care action to whichever branch handles it: do-not-disturb actions short-
 * circuit before any state load, reveal/shoo are their own special cases (see below), and
 * everything else (pet/treat/play/ask/dismiss) goes through care-general.ts. */
export async function computeCareActionState(
  action: CareAction,
  now: number,
  page: PageContext = {},
): Promise<OrchestratorState> {
  const dndDuration = careActionToDoNotDisturb(action);
  if (dndDuration) {
    return computeDoNotDisturbCareState(dndDuration, now);
  }

  const state = await loadOrchestratorState();
  const drainingSession = await readDrainingSessionState();

  switch (action) {
    case 'reveal':
      return computeRevealCareState(state, now, drainingSession);
    case 'shoo':
      return computeShooCareState(state, now, drainingSession);
    case 'dnd_30':
    case 'dnd_60':
    case 'dnd_today':
      // careActionToDoNotDisturb already returns a duration for these, handled above — this
      // branch only exists so the default case below can narrow to exactly the general
      // actions (TS can't infer that from a plain function call's return value alone).
      throw new Error(`unreachable care action: ${action}`);
    default:
      return computeGeneralCareState(state, action, now, page, drainingSession);
  }
}

async function computeDoNotDisturbCareState(
  dndDuration: DoNotDisturbDuration,
  now: number,
): Promise<OrchestratorState> {
  await setDoNotDisturb(dndDuration, now);
  const state = await loadOrchestratorState();
  const mood = deriveMoodFromVitals({
    vitals: state.cat.vitals,
    cat: state.cat,
    now,
    settings: state.settings,
    isUserIdle: state.isUserIdle,
  });
  const presentation = buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech: null,
    triggerKind: null,
    overlayHidden: false,
    companionVisible: false,
    ambientActivity: null,
    ambientPeekUntil: null,
    moodOverride: mood,
  });
  await persistPresentation(presentation);
  return { ...state, lastPresentation: presentation };
}

async function computeRevealCareState(
  state: OrchestratorState,
  now: number,
  drainingSession: DrainingSessionState,
): Promise<OrchestratorState> {
  const last = state.lastPresentation;
  // Check the whole peek cycle (ambientActivity), not just the visible
  // moment (isPeekPresentation): between visits she's hidden in a "duck
  // gap" with companionVisible false, but mood still reads 'peek'. That
  // gap isn't a real resting mood — tapping her mid-gap must still
  // restore the real one, not fall through and leave her hidden.
  if (!last || last.ambientActivity !== 'peeking') {
    if (last) {
      return { ...state, lastPresentation: last };
    }
    // Call the tick computation directly (not the public, re-serializing
    // reduceCat/evaluateAndPresent wrapper) — we're already running inside
    // reduceCat's own queued task, and queuing another task behind ourselves
    // here would deadlock waiting for a slot that can't open until we return.
    return computeTickState(now, {});
  }
  let settings = state.settings;
  if (settings.devForceMood === 'peek') {
    settings = { ...settings, devForceMood: 'auto' };
    // saveSettings() without isDevBuild forces devModeEnabled back to
    // false (mergeSettings' default), silently locking the whole dev menu
    // out after revealing a dev-forced peek. Must pass IS_DEV_BUILD here.
    await saveSettings(settings, IS_DEV_BUILD);
  }
  const restoredActivity = last.peekRestoreAmbientActivity;
  const restoredUntil = last.peekRestoreAmbientUntil;
  const restoreAmbient =
    restoredActivity !== null &&
    restoredActivity !== 'peeking' &&
    restoredUntil !== null &&
    restoredUntil > now;
  const presentation = buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings,
    now,
    isUserIdle: state.isUserIdle,
    speech: null,
    triggerKind: null,
    overlayHidden: last.overlayHidden,
    lastCareAction: last.lastCareAction,
    companionVisible: true,
    ambientActivity: restoreAmbient ? restoredActivity : null,
    ambientPeekUntil: restoreAmbient ? restoredUntil : null,
    peekEdge: null,
    peekInset: null,
    peekCorner: null,
    peekRestoreAmbientActivity: null,
    peekRestoreAmbientUntil: null,
    stayVisibleUntil:
      now + pickStayVisibleAfterRevealMs(settings, now, state.cat.adoptedAt),
    eatingUntil: last.eatingUntil,
    playingUntil: last.playingUntil,
    drainingSession,
  });
  await persistPresentation(presentation);
  return { ...state, lastPresentation: presentation };
}

async function computeShooCareState(
  state: OrchestratorState,
  now: number,
  drainingSession: DrainingSessionState,
): Promise<OrchestratorState> {
  const last = state.lastPresentation;
  if (last && isPeekPresentation(last)) {
    return { ...state, lastPresentation: last };
  }
  const restore = resolvePeekRestoreAmbient(last, true);
  const presentation = buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech: null,
    triggerKind: null,
    overlayHidden: last?.overlayHidden ?? false,
    lastCareAction: 'shoo',
    companionVisible: true,
    ambientPeekUntil:
      now + pickAmbientPeekVisitDurationMs(state.settings, now, state.cat.adoptedAt),
    peekRestoreAmbientActivity: restore.peekRestoreAmbientActivity,
    peekRestoreAmbientUntil: restore.peekRestoreAmbientUntil,
    moodOverride: 'peek',
    drainingSession,
  });
  await persistPresentation(presentation);
  return { ...state, lastPresentation: presentation };
}
