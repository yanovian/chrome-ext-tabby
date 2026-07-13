import {
  publicAnimationAssetUrl,
  requestCancelDoNotDisturb,
  requestDevForceCompanionHide,
  requestDevForceCompanionShow,
  requestDevTemperState,
  requestDoNotDisturbStatus,
  requestSyncActiveOverlay,
  requestSyncDevTemper,
  requestHideOverlayOnPage,
  requestPageOverlayState,
  requestPresentation,
  requestResetIntro,
  requestSaveSettings,
  requestSetDoNotDisturb,
  requestSettings,
  requestShowOverlayOnPage,
} from '../../utils/runtime-client';
import { ignoreIfExtensionUnavailable } from '../../utils/extension-errors';
import { CompanionGifPlayer } from '../../utils/gif-companion';
import {
  companionPreviewSizeForStage,
  lifeStageFromCompanionAssetPath,
} from '../../utils/companion-animation';
import {
  MOOD_TIMER_DEV_SIM_BOUNDS,
  MOOD_TIMER_PRODUCTION,
  formatTemperDuration,
  type TemperSimulation,
} from '../../utils/mood-timers';
import { shouldSyncDevForceMoodUi } from '../../utils/dev-temper';
import { settingsChangeRequiresPresent } from '../../utils/settings';
import type { CatLifeStage, DoNotDisturbDuration, ExtensionSettings, RuntimeResponse } from '../../utils/types';
import { APP_LOCALES, LOCALE_FLAGS, LOCALE_LABELS } from '../../utils/locale-registry';
import { applyDataI18n, applyDocumentLocale, loadAppLocale, t } from '../../utils/i18n';

const IS_DEV_BUILD = import.meta.env.DEV;

const localeSelect = document.getElementById('locale-select') as HTMLSelectElement;

function populateLocaleSelect(select: HTMLSelectElement, current: string): void {
  select.replaceChildren();
  for (const code of APP_LOCALES) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = `${LOCALE_FLAGS[code]} ${LOCALE_LABELS[code]}`;
    select.appendChild(option);
  }
  if (APP_LOCALES.includes(current as (typeof APP_LOCALES)[number])) {
    select.value = current;
  }
}

async function applyPopupLocale(locale: string): Promise<void> {
  await loadAppLocale(locale);
  applyDocumentLocale();
  applyDataI18n();
  document.title = `${t('settings.title')} settings`;
}

const fields = {
  quietStart: document.getElementById('quiet-start') as HTMLInputElement,
  quietEnd: document.getElementById('quiet-end') as HTMLInputElement,
  maxAppearances: document.getElementById('max-appearances') as HTMLInputElement,
  cooldownMinutes: document.getElementById('cooldown-minutes') as HTMLInputElement,
  devModeEnabled: document.getElementById('dev-mode-enabled') as HTMLInputElement,
  devMaxAppearances: document.getElementById('dev-max-appearances') as HTMLInputElement,
  devCooldownMinutes: document.getElementById('dev-cooldown-minutes') as HTMLInputElement,
  devStatMultiplier: document.getElementById('dev-stat-multiplier') as HTMLInputElement,
  devMinTabMs: document.getElementById('dev-min-tab-ms') as HTMLInputElement,
  devForceLifeStage: document.getElementById('dev-force-life-stage') as HTMLSelectElement,
  devForceMood: document.getElementById('dev-force-mood') as HTMLSelectElement,
};

const temperFields = {
  panel: document.getElementById('dev-temper-panel') as HTMLElement,
  inferred: document.getElementById('dev-temper-inferred') as HTMLParagraphElement,
  scenario: document.getElementById('dev-temper-scenario') as HTMLSelectElement,
  drainingRow: document.getElementById('dev-draining-row') as HTMLDivElement,
  drainingMs: document.getElementById('dev-simulated-draining-ms') as HTMLInputElement,
  drainingLabel: document.getElementById('dev-draining-label') as HTMLElement,
  recoveryAwayRow: document.getElementById('dev-recovery-away-row') as HTMLDivElement,
  recoveryAwayMs: document.getElementById('dev-simulated-recovery-away-ms') as HTMLInputElement,
  recoveryAwayLabel: document.getElementById('dev-recovery-away-label') as HTMLElement,
};

const statusEl = document.getElementById('status') as HTMLParagraphElement;
const previewHost = document.getElementById('preview-cat-host') as HTMLDivElement;
const devSettingsSection = document.getElementById('dev-settings-section') as HTMLElement;
const devBuildHint = document.getElementById('dev-build-hint') as HTMLParagraphElement;
const forceTickButton = document.getElementById('force-tick') as HTMLButtonElement;
const forceTickHint = document.getElementById('force-tick-hint') as HTMLParagraphElement;
const devForceAppearButton = document.getElementById('dev-force-appear') as HTMLButtonElement;
const devForceHideButton = document.getElementById('dev-force-hide') as HTMLButtonElement;
const devPresenceHint = document.getElementById('dev-presence-hint') as HTMLParagraphElement;
const resetIntroButton = document.getElementById('reset-intro') as HTMLButtonElement;
const showAllButton = document.getElementById('show-all-btn') as HTMLButtonElement;
const hideAllButton = document.getElementById('hide-all-btn') as HTMLButtonElement;
const showPageButton = document.getElementById('show-page-btn') as HTMLButtonElement;
const hidePageButton = document.getElementById('hide-page-btn') as HTMLButtonElement;
const pageOverlayHint = document.getElementById('page-overlay-hint') as HTMLParagraphElement;
const dndActivePanel = document.getElementById('dnd-active-panel') as HTMLDivElement;
const dndInactivePanel = document.getElementById('dnd-inactive-panel') as HTMLDivElement;
const dndStatusText = document.getElementById('dnd-status-text') as HTMLParagraphElement;
const cancelDndButton = document.getElementById('cancel-dnd-btn') as HTMLButtonElement;
const setDnd30Button = document.getElementById('set-dnd-30-btn') as HTMLButtonElement;
const setDnd60Button = document.getElementById('set-dnd-60-btn') as HTMLButtonElement;
const setDndTodayButton = document.getElementById('set-dnd-today-btn') as HTMLButtonElement;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let temperTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSimulation: Partial<TemperSimulation> | null = null;
let syncingTemper = false;
let actionBusy = false;
let cachedSettings: ExtensionSettings;
let previewPlayer: CompanionGifPlayer | null = null;
let previewSpritePath: string | null = null;
let previewStage: CatLifeStage | null = null;

function applyPreviewSize(stage: CatLifeStage): void {
  const size = companionPreviewSizeForStage(stage);
  previewHost.style.width = `${size}px`;
  previewHost.style.height = `${size}px`;
}

async function updatePreviewCat(
  assetPath: string,
  options: { force?: boolean; stage?: CatLifeStage } = {},
): Promise<void> {
  const stage = options.stage ?? lifeStageFromCompanionAssetPath(assetPath) ?? 'playful';
  if (
    !options.force &&
    previewSpritePath === assetPath &&
    previewStage === stage &&
    previewPlayer
  ) {
    return;
  }
  if (!previewPlayer) {
    previewPlayer = new CompanionGifPlayer();
    previewHost.appendChild(previewPlayer.image);
  }
  applyPreviewSize(stage);
  await previewPlayer.load(publicAnimationAssetUrl, assetPath);
  previewSpritePath = assetPath;
  previewStage = stage;
}

interface ActiveTabInfo {
  id?: number;
  url?: string;
  title?: string;
}

function showStatus(message: string): void {
  statusEl.textContent = message;
  setTimeout(() => {
    if (statusEl.textContent === message) {
      statusEl.textContent = '';
    }
  }, 2000);
}

async function getActiveTab(): Promise<ActiveTabInfo> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return {
    id: tab?.id,
    url: tab?.url,
    title: tab?.title,
  };
}

async function ensureOverlayOnActiveTab(tabId?: number): Promise<void> {
  if (!tabId) {
    return;
  }
  try {
    await browser.tabs.sendMessage(tabId, { type: 'ping' });
    return;
  } catch (error) {
    ignoreIfExtensionUnavailable('overlay ping', error);
  }
  await browser.scripting
    .insertCSS({
      target: { tabId },
      files: ['/content-scripts/content.css'],
    })
    .catch((error) => ignoreIfExtensionUnavailable('overlay css inject', error));
  await browser.scripting
    .executeScript({
      target: { tabId },
      files: ['/content-scripts/content.js'],
    })
    .catch((error) => ignoreIfExtensionUnavailable('overlay script inject', error));
}

async function refreshDoNotDisturbSection(): Promise<void> {
  const status = await requestDoNotDisturbStatus();
  if (!status.active || !status.summary) {
    dndActivePanel.hidden = true;
    dndInactivePanel.hidden = false;
    dndStatusText.textContent = '';
    return;
  }

  dndActivePanel.hidden = false;
  dndInactivePanel.hidden = true;
  dndStatusText.textContent = status.summary;
}

async function refreshOverlayButtons(settings = cachedSettings): Promise<void> {
  cachedSettings = settings;
  const tab = await getActiveTab();

  showAllButton.hidden = settings.showOverlay;
  hideAllButton.hidden = !settings.showOverlay;
  showPageButton.hidden = true;
  hidePageButton.hidden = true;

  if (!settings.showOverlay) {
    pageOverlayHint.textContent = t('settings.hiddenAll');
    return;
  }

  const state = await requestPageOverlayState(tab.url);
  if (!state.applicable) {
    pageOverlayHint.textContent = t('settings.openWebPage');
    return;
  }

  pageOverlayHint.textContent = '';
  showPageButton.hidden = state.visible;
  hidePageButton.hidden = !state.visible;
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

function fillTemperSimulation(
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
    devForceMood === 'auto'
      ? `Auto preview: ${previewMood}`
      : `Mood override: ${previewMood}`;
  temperFields.inferred.textContent = moodLabel;
}

async function refreshDevTemperUi(): Promise<void> {
  if (!IS_DEV_BUILD || !cachedSettings.devModeEnabled) {
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

async function applyDevMoodOrSimulation(
  input: {
    simulation?: Partial<TemperSimulation>;
    devForceMood?: ExtensionSettings['devForceMood'];
  },
): Promise<void> {
  if (!cachedSettings.devModeEnabled) {
    showStatus(t('settings.devOn'));
    return;
  }
  try {
    syncingTemper = true;
    const result = await requestSyncDevTemper(input);
    cachedSettings = result.settings;
    fillTemperSimulation(
      result.simulation,
      result.previewMood,
      result.settings.devForceMood,
    );
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

function bindTemperControls(): void {
  const onSimulationInput = (
    key: keyof TemperSimulation,
    input: HTMLInputElement,
    label: HTMLElement,
  ) => {
    input.addEventListener('input', () => {
      label.textContent = formatTemperDuration(Number(input.value));
      scheduleSimulationSync({ [key]: Number(input.value) } as Partial<TemperSimulation>);
    });
  };

  onSimulationInput(
    'simulatedDrainingMs',
    temperFields.drainingMs,
    temperFields.drainingLabel,
  );
  onSimulationInput(
    'simulatedRecoveryAwayMs',
    temperFields.recoveryAwayMs,
    temperFields.recoveryAwayLabel,
  );

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

function fillForm(settings: ExtensionSettings): void {
  cachedSettings = settings;
  populateLocaleSelect(localeSelect, settings.locale);
  fields.quietStart.value = String(settings.quietHoursStart);
  fields.quietEnd.value = String(settings.quietHoursEnd);
  fields.maxAppearances.value = String(settings.maxAppearancesPerDay);
  fields.cooldownMinutes.value = String(settings.appearanceCooldownMinutes);
  fields.devModeEnabled.checked = settings.devModeEnabled;
  fields.devMaxAppearances.value = String(settings.devMaxAppearancesPerDay);
  fields.devCooldownMinutes.value = String(settings.devAppearanceCooldownMinutes);
  fields.devStatMultiplier.value = String(settings.devStatMultiplier);
  fields.devMinTabMs.value = String(settings.devMinTabDurationMs);
  fields.devForceLifeStage.value = settings.devForceLifeStage;
  fields.devForceMood.value = settings.devForceMood;
}

function readPartialSettings(): Partial<ExtensionSettings> {
  return {
    locale: localeSelect.value,
    showOverlay: cachedSettings.showOverlay,
    quietHoursStart: Number(fields.quietStart.value),
    quietHoursEnd: Number(fields.quietEnd.value),
    maxAppearancesPerDay: Number(fields.maxAppearances.value),
    appearanceCooldownMinutes: Number(fields.cooldownMinutes.value),
    devModeEnabled: fields.devModeEnabled.checked,
    devMaxAppearancesPerDay: Number(fields.devMaxAppearances.value),
    devAppearanceCooldownMinutes: Number(fields.devCooldownMinutes.value),
    devStatMultiplier: Number(fields.devStatMultiplier.value),
    devMinTabDurationMs: Number(fields.devMinTabMs.value),
    devForceLifeStage: fields.devForceLifeStage.value as ExtensionSettings['devForceLifeStage'],
  };
}

function scheduleSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    void (async () => {
      const before = cachedSettings;
      const saved = await requestSaveSettings(readPartialSettings(), { skipPresent: true });
      cachedSettings = saved;
      if (before.locale !== saved.locale) {
        await applyPopupLocale(saved.locale);
      }
      fillForm(saved);
      if (settingsChangeRequiresPresent(before, saved)) {
        const presentation = await requestPresentation();
        await updatePreviewCat(presentation.sprite, {
          force: true,
          stage: presentation.stage,
        });
      }
      await refreshOverlayButtons(saved);
      showStatus(t('settings.saved'));
    })();
  }, 350);
}

async function setGlobalOverlayVisible(show: boolean): Promise<void> {
  cachedSettings = await requestSaveSettings({
    ...readPartialSettings(),
    showOverlay: show,
  });
  fillForm(cachedSettings);
  if (show) {
    await requestSyncActiveOverlay();
  }
  await refreshOverlayButtons(cachedSettings);
  showStatus(show ? t('settings.shownOnTab') : t('settings.hiddenAll'));
}

async function setPageOverlayVisible(show: boolean): Promise<void> {
  const tab = await getActiveTab();
  if (show) {
    await requestShowOverlayOnPage(tab.url, tab.title);
    await ensureOverlayOnActiveTab(tab.id);
    showStatus(t('settings.shownPage'));
  } else {
    await requestHideOverlayOnPage(tab.url);
    showStatus(t('settings.hiddenPage'));
  }
  const next = await requestPresentation();
  await updatePreviewCat(next.sprite);
  await refreshDoNotDisturbSection();
  await refreshOverlayButtons();
}

async function cancelDoNotDisturb(): Promise<void> {
  const next = await requestCancelDoNotDisturb();
  await updatePreviewCat(next.sprite);
  await refreshDoNotDisturbSection();
  await refreshOverlayButtons();
  showStatus(t('settings.dndOff'));
}

async function enableDoNotDisturb(duration: DoNotDisturbDuration): Promise<void> {
  const next = await requestSetDoNotDisturb(duration);
  await updatePreviewCat(next.sprite);
  await refreshDoNotDisturbSection();
  await refreshOverlayButtons();
  showStatus(t('settings.dndOn'));
}

function bindActionButton(
  button: HTMLButtonElement,
  action: () => Promise<void>,
): void {
  button.addEventListener('click', () => {
    if (actionBusy) {
      return;
    }
    void (async () => {
      actionBusy = true;
      button.disabled = true;
      try {
        await action();
      } catch (error) {
        showStatus(error instanceof Error ? error.message : t('settings.unavailable'));
        await refreshDoNotDisturbSection();
        await refreshOverlayButtons();
      } finally {
        button.disabled = false;
        actionBusy = false;
      }
    })();
  });
}

function bindLocaleControl(): void {
  localeSelect.addEventListener('change', () => {
    void (async () => {
      const nextLocale = localeSelect.value;
      await applyPopupLocale(nextLocale);
      const saved = await requestSaveSettings(
        { locale: nextLocale },
        { skipPresent: false },
      );
      cachedSettings = saved;
      await refreshDoNotDisturbSection();
      await refreshOverlayButtons(saved);
    })();
  });
}

async function initialize(): Promise<void> {
  devSettingsSection.hidden = !IS_DEV_BUILD;

  if (!IS_DEV_BUILD) {
    const [settings, presentation] = await Promise.all([
      requestSettings(),
      requestPresentation(),
    ]);
    await applyPopupLocale(settings.locale);
    fillForm(settings);
    bindLocaleControl();
    void updatePreviewCat(presentation.sprite);
    await refreshDoNotDisturbSection();
    await refreshOverlayButtons(settings);

    for (const element of [
      fields.quietStart,
      fields.quietEnd,
      fields.maxAppearances,
      fields.cooldownMinutes,
    ]) {
      element.addEventListener('change', scheduleSave);
      element.addEventListener('input', scheduleSave);
    }

    bindActionButton(showAllButton, () => setGlobalOverlayVisible(true));
    bindActionButton(hideAllButton, () => setGlobalOverlayVisible(false));
    bindActionButton(showPageButton, () => setPageOverlayVisible(true));
    bindActionButton(hidePageButton, () => setPageOverlayVisible(false));
    bindActionButton(cancelDndButton, () => cancelDoNotDisturb());
    bindActionButton(setDnd30Button, () => enableDoNotDisturb('30m'));
    bindActionButton(setDnd60Button, () => enableDoNotDisturb('60m'));
    bindActionButton(setDndTodayButton, () => enableDoNotDisturb('today'));

    window.setInterval(() => {
      if (!dndActivePanel.hidden) {
        void refreshDoNotDisturbSection();
      }
    }, 30_000);
    return;
  }

  devBuildHint.textContent =
    'Dev build detected — extra interactions are available when dev mode is on.';

  const [settings, presentation] = await Promise.all([
    requestSettings(),
    requestPresentation(),
  ]);

  await applyPopupLocale(settings.locale);
  fillForm(settings);
  bindLocaleControl();
  await refreshDoNotDisturbSection();
  await refreshOverlayButtons(settings);
  if (settings.devModeEnabled) {
    await refreshDevTemperUi();
  } else {
    void updatePreviewCat(presentation.sprite);
  }

  const devFormFields = Object.values(fields).filter(
    (element) => element !== fields.devForceMood,
  );
  for (const element of devFormFields) {
    element.addEventListener('change', scheduleSave);
    element.addEventListener('input', scheduleSave);
  }
  fields.devModeEnabled.addEventListener('change', () => {
    void refreshDevTemperUi();
    scheduleSave();
  });
  bindTemperControls();

  bindActionButton(showAllButton, () => setGlobalOverlayVisible(true));
  bindActionButton(hideAllButton, () => setGlobalOverlayVisible(false));
  bindActionButton(showPageButton, () => setPageOverlayVisible(true));
  bindActionButton(hidePageButton, () => setPageOverlayVisible(false));
  bindActionButton(cancelDndButton, () => cancelDoNotDisturb());
  bindActionButton(setDnd30Button, () => enableDoNotDisturb('30m'));
  bindActionButton(setDnd60Button, () => enableDoNotDisturb('60m'));
  bindActionButton(setDndTodayButton, () => enableDoNotDisturb('today'));

  window.setInterval(() => {
    if (!dndActivePanel.hidden) {
      void refreshDoNotDisturbSection();
    }
  }, 30_000);

  forceTickButton.hidden = !IS_DEV_BUILD;
  forceTickHint.hidden = !IS_DEV_BUILD;
  devForceAppearButton.hidden = !IS_DEV_BUILD;
  devForceHideButton.hidden = !IS_DEV_BUILD;
  devPresenceHint.hidden = !IS_DEV_BUILD;
  resetIntroButton.hidden = !IS_DEV_BUILD;

  function afterDevCompanionChange(presentation: { sprite: string }, label: string): void {
    void updatePreviewCat(presentation.sprite);
    void refreshOverlayButtons();
    showStatus(label);
  }

  bindActionButton(devForceAppearButton, async () => {
    const next = await requestDevForceCompanionShow();
    afterDevCompanionChange(next, `Tabby is visible (${next.mood}).`);
  });
  bindActionButton(devForceHideButton, async () => {
    const next = await requestDevForceCompanionHide();
    afterDevCompanionChange(next, 'Tabby hidden.');
  });

  forceTickButton.addEventListener('click', () => {
    void (async () => {
      const response = (await browser.runtime.sendMessage({
        type: 'tick',
      })) as RuntimeResponse<{ mood: string; speech: string | null; sprite: string }>;
      if (!response?.ok) {
        showStatus('Could not tick Tabby.');
        return;
      }
      const next = response.data;
      if (next) {
        void updatePreviewCat(next.sprite);
      }
      void refreshOverlayButtons();
      showStatus(
        next
          ? `Ticked. Mood: ${next.mood}${next.speech ? ' — speaking' : ''}.`
          : 'Ticked.',
      );
    })();
  });

  resetIntroButton.addEventListener('click', () => {
    void (async () => {
      await requestResetIntro();
      showStatus(t('settings.introReset'));
    })();
  });

  // Other flows (e.g. tapping a peek on the page) can change devForceMood
  // behind this popup's back (it resets to "auto" on reveal). Without this,
  // the dropdown keeps showing the old value, so re-picking that same option
  // fires no `change` event and looks like the dev menu stopped working.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') {
      return;
    }
    const next = changes.settings?.newValue as ExtensionSettings | undefined;
    if (!next || !cachedSettings) {
      return;
    }
    cachedSettings = next;
    const displayed = fields.devForceMood.value as ExtensionSettings['devForceMood'];
    if (shouldSyncDevForceMoodUi(displayed, next, syncingTemper)) {
      void refreshDevTemperUi();
    }
  });
}

void initialize();
