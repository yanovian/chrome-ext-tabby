import {
  publicAnimationAssetUrl,
  requestCancelDoNotDisturb,
  requestDevForceCompanionHide,
  requestDevForceCompanionShow,
  requestDoNotDisturbStatus,
  requestSyncActiveOverlay,
  requestHideOverlayOnPage,
  requestPageOverlayState,
  requestPresentation,
  requestResetIntro,
  requestSaveSettings,
  requestSetDoNotDisturb,
  requestSettings,
  requestShowOverlayOnPage,
} from '../../utils/runtime-client';
import { CompanionLottiePlayer } from '../../utils/lottie-companion';
import type { DoNotDisturbDuration, ExtensionSettings, RuntimeResponse } from '../../utils/types';

const IS_DEV_BUILD = import.meta.env.DEV;

const fields = {
  localSpeechEnabled: document.getElementById('local-speech-enabled') as HTMLInputElement,
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

const statusEl = document.getElementById('status') as HTMLParagraphElement;
const previewHost = document.getElementById('preview-cat-host') as HTMLDivElement;
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
let dndRefreshTimer: number | null = null;
let actionBusy = false;
let cachedSettings: ExtensionSettings;
let previewPlayer: CompanionLottiePlayer | null = null;

async function updatePreviewCat(assetPath: string): Promise<void> {
  if (!previewPlayer) {
    previewPlayer = new CompanionLottiePlayer();
    previewHost.appendChild(previewPlayer.canvas);
  }
  await previewPlayer.load(publicAnimationAssetUrl, assetPath);
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
  } catch {
    // Content script not loaded yet — inject below.
  }
  await browser.scripting
    .insertCSS({
      target: { tabId },
      files: ['/content-scripts/content.css'],
    })
    .catch(() => undefined);
  await browser.scripting
    .executeScript({
      target: { tabId },
      files: ['/content-scripts/content.js'],
    })
    .catch(() => undefined);
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
    pageOverlayHint.textContent = 'Tabby is hidden on every page.';
    return;
  }

  const state = await requestPageOverlayState(tab.url);
  if (!state.applicable) {
    pageOverlayHint.textContent = 'Open a normal web page to show or hide Tabby here.';
    return;
  }

  pageOverlayHint.textContent = '';
  showPageButton.hidden = state.visible;
  hidePageButton.hidden = !state.visible;
}

function fillForm(settings: ExtensionSettings): void {
  cachedSettings = settings;
  fields.localSpeechEnabled.checked = settings.localSpeechEnabled;
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
    showOverlay: cachedSettings.showOverlay,
    localSpeechEnabled: fields.localSpeechEnabled.checked,
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
    devForceMood: fields.devForceMood.value as ExtensionSettings['devForceMood'],
  };
}

function scheduleSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    void (async () => {
      const saved = await requestSaveSettings(readPartialSettings());
      fillForm(saved);
      await refreshOverlayButtons(saved);
      const next = await requestPresentation();
      await updatePreviewCat(next.sprite);
      showStatus('Saved.');
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
  showStatus(show ? 'Tabby is on the active tab.' : 'Tabby is hidden on every page.');
}

async function setPageOverlayVisible(show: boolean): Promise<void> {
  const tab = await getActiveTab();
  if (show) {
    await requestShowOverlayOnPage(tab.url, tab.title);
    await ensureOverlayOnActiveTab(tab.id);
    showStatus('Tabby is on this page.');
  } else {
    await requestHideOverlayOnPage(tab.url);
    showStatus('Tabby is hidden on this page.');
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
  showStatus('Do not disturb turned off.');
}

async function enableDoNotDisturb(duration: DoNotDisturbDuration): Promise<void> {
  const next = await requestSetDoNotDisturb(duration);
  await updatePreviewCat(next.sprite);
  await refreshDoNotDisturbSection();
  await refreshOverlayButtons();
  showStatus('Do not disturb is on.');
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
        showStatus(error instanceof Error ? error.message : 'Could not update Tabby.');
        await refreshDoNotDisturbSection();
        await refreshOverlayButtons();
      } finally {
        button.disabled = false;
        actionBusy = false;
      }
    })();
  });
}

async function initialize(): Promise<void> {
  devBuildHint.textContent = IS_DEV_BUILD
    ? 'Dev build detected — extra interactions are available when dev mode is on.'
    : 'Dev controls apply when running `pnpm dev`.';

  const [settings, presentation] = await Promise.all([
    requestSettings(),
    requestPresentation(),
  ]);

  fillForm(settings);
  await updatePreviewCat(presentation.sprite);
  await refreshDoNotDisturbSection();
  await refreshOverlayButtons(settings);

  for (const element of Object.values(fields)) {
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

  dndRefreshTimer = window.setInterval(() => {
    if (!dndActivePanel.hidden) {
      void refreshDoNotDisturbSection();
    }
  }, 30_000);

  window.addEventListener('unload', () => {
    if (dndRefreshTimer) {
      window.clearInterval(dndRefreshTimer);
    }
  });

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
      showStatus('Intro reset — the tour should appear on the active tab.');
    })();
  });
}

void initialize();
