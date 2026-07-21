import { requestDevTemperState, requestSyncActiveOverlay, requestSyncDevTemper } from '../../utils/runtime-client';
import {
  MOOD_TIMER_DEV_SIM_BOUNDS,
  MOOD_TIMER_PRODUCTION,
  formatTemperDuration,
  type TemperSimulation,
} from '../../utils/mood-timers';
import { t } from '../../utils/i18n';
import type { ExtensionSettings } from '../../utils/types';
import { IS_DEV_BUILD } from './env';
import { fields, temperFields } from './dom-refs';
import { getCachedSettings, setCachedSettings } from './settings-store';
import { updatePreviewCat } from './preview-cat';
import { showStatus } from './status';

let temperTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSimulation: Partial<TemperSimulation> | null = null;
let syncingTemper = false;

export function isSyncingTemper(): boolean {
  return syncingTemper;
}

function configureRangeInput(
  input: HTMLInputElement,
  bounds: { min: number; max: number; step: number },
  value: number,
): void {
  input.min = String(bounds.min);
  input.max = String(bounds.max);
  input.step = String(bounds.step);
  input.value = String(value);
}

export function fillTemperSimulation(
  simulation: TemperSimulation,
  previewMood: string,
  devForceMood: ExtensionSettings['devForceMood'],
): void {
  temperFields.scenario.value = simulation.scenario;
  temperFields.drainingRow.hidden = simulation.scenario !== 'on_feed';
  temperFields.recoveryAwayRow.hidden = simulation.scenario !== 'away_from_feed';

  const drainingValue = Math.min(
    simulation.simulatedDrainingMs,
    MOOD_TIMER_DEV_SIM_BOUNDS.simulatedDrainingMs.max,
  );
  configureRangeInput(
    temperFields.drainingMs,
    {
      ...MOOD_TIMER_DEV_SIM_BOUNDS.simulatedDrainingMs,
      max: Math.max(
        MOOD_TIMER_DEV_SIM_BOUNDS.simulatedDrainingMs.max,
        MOOD_TIMER_PRODUCTION.overwhelmedThresholdMs + 15 * 60_000,
      ),
    },
    drainingValue,
  );
  temperFields.drainingLabel.textContent = formatTemperDuration(drainingValue);

  const awayValue = Math.min(
    simulation.simulatedRecoveryAwayMs,
    MOOD_TIMER_DEV_SIM_BOUNDS.simulatedRecoveryAwayMs.max,
  );
  configureRangeInput(
    temperFields.recoveryAwayMs,
    {
      ...MOOD_TIMER_DEV_SIM_BOUNDS.simulatedRecoveryAwayMs,
      max: Math.max(
        MOOD_TIMER_DEV_SIM_BOUNDS.simulatedRecoveryAwayMs.max,
        MOOD_TIMER_PRODUCTION.recoveryThanksThresholdMs + 60_000,
      ),
    },
    awayValue,
  );
  temperFields.recoveryAwayLabel.textContent = formatTemperDuration(awayValue);

  const moodLabel =
    devForceMood === 'auto' ? `Auto preview: ${previewMood}` : `Mood override: ${previewMood}`;
  temperFields.inferred.textContent = moodLabel;
}

export async function refreshDevTemperUi(): Promise<void> {
  if (!IS_DEV_BUILD || !getCachedSettings().devModeEnabled) {
    temperFields.panel.hidden = true;
    return;
  }
  temperFields.panel.hidden = false;
  try {
    const state = await requestDevTemperState();
    syncingTemper = true;
    fillTemperSimulation(state.simulation, state.previewMood, state.settings.devForceMood);
    fields.devForceMood.value = state.settings.devForceMood;
    await updatePreviewCat(state.presentation.sprite, { force: true });
  } catch {
    temperFields.inferred.textContent = 'Turn on dev interactions to use simulation.';
  } finally {
    syncingTemper = false;
  }
}

export async function applyDevMoodOrSimulation(input: {
  simulation?: Partial<TemperSimulation>;
  devForceMood?: ExtensionSettings['devForceMood'];
}): Promise<void> {
  if (!getCachedSettings().devModeEnabled) {
    showStatus(t('settings.devOn'));
    return;
  }
  try {
    syncingTemper = true;
    const result = await requestSyncDevTemper(input);
    setCachedSettings(result.settings);
    fillTemperSimulation(result.simulation, result.previewMood, result.settings.devForceMood);
    fields.devForceMood.value = result.settings.devForceMood;
    await updatePreviewCat(result.presentation.sprite, { force: true });
    void requestSyncActiveOverlay();
    showStatus(t('settings.previewMood', { mood: result.previewMood }));
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not update preview.');
  } finally {
    syncingTemper = false;
  }
}

function readSimulationFromSliders(): TemperSimulation {
  return {
    scenario: temperFields.scenario.value as TemperSimulation['scenario'],
    simulatedDrainingMs: Number(temperFields.drainingMs.value),
    simulatedRecoveryAwayMs: Number(temperFields.recoveryAwayMs.value),
  };
}

function cancelPendingSimulationSync(): void {
  if (temperTimer) {
    clearTimeout(temperTimer);
    temperTimer = null;
  }
  pendingSimulation = null;
}

function scheduleSimulationSync(partial: Partial<TemperSimulation>): void {
  pendingSimulation = { ...pendingSimulation, ...partial };
  if (temperTimer) {
    clearTimeout(temperTimer);
  }
  temperTimer = setTimeout(() => {
    const simulation = pendingSimulation;
    pendingSimulation = null;
    if (!simulation) {
      return;
    }
    void applyDevMoodOrSimulation({ simulation });
  }, 150);
}

export function bindTemperControls(): void {
  const onSimulationInput = (key: keyof TemperSimulation, input: HTMLInputElement, label: HTMLElement) => {
    input.addEventListener('input', () => {
      label.textContent = formatTemperDuration(Number(input.value));
      scheduleSimulationSync({ [key]: Number(input.value) } as Partial<TemperSimulation>);
    });
  };

  onSimulationInput('simulatedDrainingMs', temperFields.drainingMs, temperFields.drainingLabel);
  onSimulationInput('simulatedRecoveryAwayMs', temperFields.recoveryAwayMs, temperFields.recoveryAwayLabel);

  temperFields.scenario.addEventListener('change', () => {
    const scenario = temperFields.scenario.value as TemperSimulation['scenario'];
    temperFields.drainingRow.hidden = scenario !== 'on_feed';
    temperFields.recoveryAwayRow.hidden = scenario !== 'away_from_feed';
    scheduleSimulationSync({ ...readSimulationFromSliders(), scenario });
  });

  fields.devForceMood.addEventListener('change', () => {
    if (syncingTemper) {
      return;
    }
    cancelPendingSimulationSync();
    const mood = fields.devForceMood.value as ExtensionSettings['devForceMood'];
    void applyDevMoodOrSimulation({ devForceMood: mood });
  });
}
