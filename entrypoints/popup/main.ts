import {
  publicAssetUrl,
  requestPresentation,
  requestResetIntro,
  requestSaveSettings,
  requestSettings,
} from '../../utils/runtime-client';
import type { ExtensionSettings } from '../../utils/types';

const IS_DEV_BUILD = import.meta.env.DEV;

const fields = {
  readPageContent: document.getElementById('read-page-content') as HTMLInputElement,
  pageTextMaxChars: document.getElementById('page-text-max-chars') as HTMLInputElement,
  showOverlay: document.getElementById('show-overlay') as HTMLInputElement,
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
const resetIntroButton = document.getElementById('reset-intro') as HTMLButtonElement;
const showOnPageButton = document.getElementById('show-on-page') as HTMLButtonElement;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function showStatus(message: string): void {
  statusEl.textContent = message;
  setTimeout(() => {
    if (statusEl.textContent === message) {
      statusEl.textContent = '';
    }
  }, 2000);
}

function fillForm(settings: ExtensionSettings): void {
  fields.readPageContent.checked = settings.readPageContent;
  fields.pageTextMaxChars.value = String(settings.pageTextMaxChars);
  fields.showOverlay.checked = settings.showOverlay;
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
    showOverlay: fields.showOverlay.checked,
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
      showStatus('Saved.');
    })();
  }, 350);
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

  for (const element of Object.values(fields)) {
    element.addEventListener('change', scheduleSave);
    element.addEventListener('input', scheduleSave);
  }

  showOnPageButton.addEventListener('click', () => {
    void (async () => {
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      await browser.runtime.sendMessage({ type: 'showOverlay' });
      if (activeTab?.id) {
        await browser.scripting.insertCSS({
          target: { tabId: activeTab.id },
          files: ['/content-scripts/content.css'],
        }).catch(() => undefined);
        await browser.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['/content-scripts/content.js'],
        }).catch(() => undefined);
      }
      const next = await requestPresentation();
      previewCat.src = publicAssetUrl(next.sprite);
      showStatus('Tabby is on your page — drag her by the ⋮⋮ handle.');
    })();
  });

  forceTickButton.hidden = !IS_DEV_BUILD;
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
