import {
  publicAssetUrl,
  requestSyncActiveOverlay,
  requestHideOverlayOnPage,
  requestPageOverlayState,
  requestPresentation,
  requestResetIntro,
  requestSaveSettings,
  requestSettings,
  requestShowOverlayOnPage,
} from '../../utils/runtime-client';
import type { ExtensionSettings } from '../../utils/types';

const IS_DEV_BUILD = import.meta.env.DEV;

const fields = {
  readPageContent: document.getElementById('read-page-content') as HTMLInputElement,
  pageTextMaxChars: document.getElementById('page-text-max-chars') as HTMLInputElement,
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
};

const statusEl = document.getElementById('status') as HTMLParagraphElement;
const previewCat = document.getElementById('preview-cat') as HTMLImageElement;
const devBuildHint = document.getElementById('dev-build-hint') as HTMLParagraphElement;
const forceTickButton = document.getElementById('force-tick') as HTMLButtonElement;
const forceTickHint = document.getElementById('force-tick-hint') as HTMLParagraphElement;
const resetIntroButton = document.getElementById('reset-intro') as HTMLButtonElement;
const showAllButton = document.getElementById('show-all-btn') as HTMLButtonElement;
const hideAllButton = document.getElementById('hide-all-btn') as HTMLButtonElement;
const showPageButton = document.getElementById('show-page-btn') as HTMLButtonElement;
const hidePageButton = document.getElementById('hide-page-btn') as HTMLButtonElement;
const pageOverlayHint = document.getElementById('page-overlay-hint') as HTMLParagraphElement;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let overlayActionBusy = false;
let cachedSettings: ExtensionSettings;

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
  fields.readPageContent.checked = settings.readPageContent;
  fields.pageTextMaxChars.value = String(settings.pageTextMaxChars);
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
}

function readPartialSettings(): Partial<ExtensionSettings> {
  return {
    readPageContent: fields.readPageContent.checked,
    pageTextMaxChars: Number(fields.pageTextMaxChars.value),
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
  previewCat.src = publicAssetUrl(next.sprite);
  await refreshOverlayButtons();
}

function bindOverlayButton(
  button: HTMLButtonElement,
  action: () => Promise<void>,
): void {
  button.addEventListener('click', () => {
    if (overlayActionBusy) {
      return;
    }
    void (async () => {
      overlayActionBusy = true;
      button.disabled = true;
      try {
        await action();
      } catch (error) {
        showStatus(error instanceof Error ? error.message : 'Could not update Tabby.');
        await refreshOverlayButtons();
      } finally {
        button.disabled = false;
        overlayActionBusy = false;
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
  previewCat.src = publicAssetUrl(presentation.sprite);
  if (settings.showOverlay) {
    try {
      await requestSyncActiveOverlay();
    } catch {
      // Overlay sync is best-effort; still render controls below.
    }
  }
  await refreshOverlayButtons(settings);

  for (const element of Object.values(fields)) {
    element.addEventListener('change', scheduleSave);
    element.addEventListener('input', scheduleSave);
  }

  bindOverlayButton(showAllButton, () => setGlobalOverlayVisible(true));
  bindOverlayButton(hideAllButton, () => setGlobalOverlayVisible(false));
  bindOverlayButton(showPageButton, () => setPageOverlayVisible(true));
  bindOverlayButton(hidePageButton, () => setPageOverlayVisible(false));

  forceTickButton.hidden = !IS_DEV_BUILD;
  forceTickHint.hidden = !IS_DEV_BUILD;
  resetIntroButton.hidden = !IS_DEV_BUILD;
  forceTickButton.addEventListener('click', () => {
    void (async () => {
      await browser.runtime.sendMessage({ type: 'tick' });
      const next = await requestPresentation();
      previewCat.src = publicAssetUrl(next.sprite);
      showStatus(`Ticked. Mood: ${next.mood}${next.speech ? ' — speaking' : ''}.`);
    })();
  });

  resetIntroButton.addEventListener('click', () => {
    void (async () => {
      await requestResetIntro();
      showStatus('Intro reset — reload the page or show Tabby to test.');
    })();
  });
}

void initialize();
