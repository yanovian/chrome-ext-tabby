import { deriveMoodFromVitals } from '../cat-sim';
import { previewRecoverySpeech } from '../speech-fallback';
import {
  applyDevMoodToTemper,
  applyTemperSimulation,
  temperSimulationFromSession,
  type DevTemperSnapshot,
} from '../dev-temper';
import {
  inferTemperMood,
  readTemperSimulation,
  resolveMoodTimers,
  type TemperSimulation,
} from '../mood-timers';
import {
  isInDrainingRecovery,
  pendingRecoveryNudge,
  readDrainingSessionState,
  writeDrainingSessionState,
  type DrainingSessionState,
} from '../draining-session';
import { buildPresentation, moodOverrideWhileHiding } from '../presentation';
import { isDevMoodForced, saveSettings } from '../settings';
import type { CatMood, CatPresentation, CatState, DevMoodOverride, ExtensionSettings } from '../types';
import { IS_DEV_BUILD, type OrchestratorState } from './types';
import { loadOrchestratorState, persistPresentation, reduceCat, serializePresentationWrite } from './state-io';

function assertDevCompanionAccess(settings: ExtensionSettings): void {
  if (!IS_DEV_BUILD || !settings.devModeEnabled) {
    throw new Error('Dev companion controls require dev mode in a dev build.');
  }
}

export interface DevTemperPayload {
  settings: ExtensionSettings;
  simulation: TemperSimulation;
  previewMood: CatMood;
  inferredMood: CatMood;
  drainingSession: DrainingSessionState;
  presentation: CatPresentation;
}

function devPreviewSpeech(drainingSession: DrainingSessionState): string | null {
  if (!isInDrainingRecovery(drainingSession)) {
    return null;
  }
  const nudge = pendingRecoveryNudge(drainingSession);
  if (nudge === 'easing') {
    return previewRecoverySpeech('recovery_easing');
  }
  if (nudge === 'thanks') {
    return previewRecoverySpeech('recovery_thanks');
  }
  return null;
}

export function buildDevPreviewPresentation(
  state: OrchestratorState,
  settings: ExtensionSettings,
  drainingSession: DrainingSessionState,
  now = Date.now(),
): CatPresentation {
  const moodOverride = isDevMoodForced(settings) ? settings.devForceMood : undefined;
  const last = state.lastPresentation;
  const forcingPeek = moodOverride === 'peek';
  const keepPeekPlacement = forcingPeek && last?.mood === 'peek';
  return buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings,
    now,
    isUserIdle: state.isUserIdle,
    speech: devPreviewSpeech(drainingSession),
    triggerKind: null,
    overlayHidden: last?.overlayHidden ?? false,
    lastCareAction: null,
    companionVisible: moodOverride ? true : (last?.companionVisible ?? true),
    ambientActivity: forcingPeek ? ('peeking' as const) : null,
    ambientPeekUntil: null,
    peekEdge: keepPeekPlacement ? last.peekEdge : null,
    peekInset: keepPeekPlacement ? last.peekInset : null,
    peekCorner: keepPeekPlacement ? last.peekCorner : null,
    eatingUntil: null,
    playingUntil: null,
    stayVisibleUntil: moodOverride ? null : (last?.stayVisibleUntil ?? null),
    drainingSession,
    moodOverride,
  });
}

function buildDevTemperPayload(
  settings: ExtensionSettings,
  session: DrainingSessionState,
  cat: CatState,
  isUserIdle: boolean,
  presentation: CatPresentation,
): DevTemperPayload {
  const simulation =
    settings.devForceMood === 'auto'
      ? temperSimulationFromSession(settings, session)
      : readTemperSimulation(settings);
  const derivedMood = deriveMoodFromVitals({
    vitals: cat.vitals,
    cat,
    now: Date.now(),
    settings,
    isUserIdle,
  });
  const timers = resolveMoodTimers(settings);
  const inferredMood = inferTemperMood(timers, simulation, derivedMood);
  const previewMood = presentation.mood;
  return {
    settings,
    simulation,
    previewMood,
    inferredMood,
    drainingSession: session,
    presentation,
  };
}

/** Dev-only: read temper sliders, inferred mood, and draining session. */
export async function getDevTemperState(): Promise<DevTemperPayload> {
  const state = await loadOrchestratorState();
  assertDevCompanionAccess(state.settings);
  const session = await readDrainingSessionState();
  const presentation = buildDevPreviewPresentation(state, state.settings, session);
  return buildDevTemperPayload(state.settings, session, state.cat, state.isUserIdle, presentation);
}

/** Dev-only: sync simulated dwell time and/or mood override, then refresh preview. */
export function syncDevTemperControls(input: {
  simulation?: Partial<TemperSimulation>;
  devForceMood?: DevMoodOverride;
}): Promise<DevTemperPayload & { presentation: CatPresentation }> {
  return serializePresentationWrite(() => runSyncDevTemperControls(input));
}

async function runSyncDevTemperControls(input: {
  simulation?: Partial<TemperSimulation>;
  devForceMood?: DevMoodOverride;
}): Promise<DevTemperPayload & { presentation: CatPresentation }> {
  const state = await loadOrchestratorState();
  assertDevCompanionAccess(state.settings);

  let snapshot: DevTemperSnapshot;
  if (input.simulation) {
    const current = readTemperSimulation(state.settings);
    snapshot = applyTemperSimulation(
      state.settings,
      { ...current, ...input.simulation },
      { devForceMood: input.devForceMood ?? 'auto' },
    );
  } else if (input.devForceMood !== undefined) {
    snapshot =
      input.devForceMood === 'auto'
        ? applyTemperSimulation(state.settings, readTemperSimulation(state.settings), {
            devForceMood: 'auto',
          })
        : applyDevMoodToTemper(state.settings, input.devForceMood);
  } else {
    throw new Error('syncDevTemper requires simulation or devForceMood.');
  }

  await writeDrainingSessionState(snapshot.drainingSession);
  const presentation = buildDevPreviewPresentation(state, snapshot.settings, snapshot.drainingSession);
  // Save settings first: persistPresentation() re-reads settings from
  // storage to re-apply any forced dev mood. Persisting before saving would
  // read the OLD devForceMood and immediately stomp the override we just
  // computed (e.g. switching to "Peek" would silently revert to whatever
  // mood was forced before).
  await saveSettings(snapshot.settings, IS_DEV_BUILD);
  await persistPresentation(presentation);
  return {
    ...buildDevTemperPayload(
      snapshot.settings,
      snapshot.drainingSession,
      state.cat,
      state.isUserIdle,
      presentation,
    ),
    presentation,
  };
}

/** Dev-only: force Tabby to appear using the current dev mood override. */
export function devForceCompanionShow(now: number): Promise<CatPresentation> {
  return reduceCat({ type: 'devPreview', now }).then((state) => state.lastPresentation!);
}

export async function computeDevPreviewState(now: number): Promise<OrchestratorState> {
  const state = await loadOrchestratorState();
  assertDevCompanionAccess(state.settings);
  const drainingSession = await readDrainingSessionState();
  const presentation = buildDevPreviewPresentation(state, state.settings, drainingSession, now);
  await persistPresentation(presentation);
  return { ...state, lastPresentation: presentation };
}

/** Dev-only: force Tabby to hide on the active tab right away. */
export function devForceCompanionHide(now: number): Promise<CatPresentation> {
  return reduceCat({ type: 'devHide', now }).then((state) => state.lastPresentation!);
}

export async function computeDevHideState(now: number): Promise<OrchestratorState> {
  const state = await loadOrchestratorState();
  assertDevCompanionAccess(state.settings);

  const base = state.lastPresentation;
  const presentation = buildPresentation({
    cat: state.cat,
    vitals: state.cat.vitals,
    settings: state.settings,
    now,
    isUserIdle: state.isUserIdle,
    speech: null,
    triggerKind: null,
    overlayHidden: base?.overlayHidden ?? false,
    lastCareAction: base?.lastCareAction ?? null,
    companionVisible: false,
    ambientActivity: null,
    ambientPeekUntil: null,
    moodOverride: moodOverrideWhileHiding(base?.mood, false),
  });

  await persistPresentation(presentation);
  return { ...state, lastPresentation: presentation };
}
