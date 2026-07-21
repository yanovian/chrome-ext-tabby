import {
  requestDevForceCompanionHide,
  requestDevForceCompanionShow,
  requestPresentation,
  requestResetIntro,
  requestSettings,
} from '../../utils/runtime-client';
import { shouldSyncDevForceMoodUi } from '../../utils/dev-temper';
import { t } from '../../utils/i18n';
import type { CatPresentation, ExtensionSettings, RuntimeResponse } from '../../utils/types';
import { IS_DEV_BUILD } from './env';
import {
  cancelDndButton,
  devBuildHint,
  devForceAppearButton,
  devForceHideButton,
  devPresenceHint,
  devSettingsSection,
  dndActivePanel,
  fields,
  forceTickButton,
  forceTickHint,
  hideAllButton,
  hidePageButton,
  resetIntroButton,
  setDnd30Button,
  setDnd60Button,
  setDndTodayButton,
  showAllButton,
  showPageButton,
} from './dom-refs';
import { getCachedSettings, setCachedSettings } from './settings-store';
import { applyPopupLocale, bindLocaleControl } from './locale';
import { fillForm, scheduleSave } from './settings-form';
import { updatePreviewCat } from './preview-cat';
import { cancelDoNotDisturb, enableDoNotDisturb, refreshDoNotDisturbSection } from './dnd-actions';
import { refreshOverlayButtons, setGlobalOverlayVisible, setPageOverlayVisible } from './overlay-actions';
import { bindActionButton } from './action-buttons';
import { showStatus } from './status';
import { bindTemperControls, isSyncingTemper, refreshDevTemperUi } from './dev-temper';

async function loadInitialSettingsAndPresentation(): Promise<{
  settings: ExtensionSettings;
  presentation: CatPresentation;
}> {
  const [settings, presentation] = await Promise.all([requestSettings(), requestPresentation()]);
  await applyPopupLocale(settings.locale);
  fillForm(settings);
  bindLocaleControl();
  return { settings, presentation };
}

function bindSettingsFieldAutosave(elements: Iterable<HTMLElement>): void {
  for (const element of elements) {
    element.addEventListener('change', scheduleSave);
    element.addEventListener('input', scheduleSave);
  }
}

/** Identical in both the production and dev popup: the overlay visibility and DND buttons
 * behave the same regardless of dev mode. */
function bindSharedOverlayAndDndButtons(): void {
  bindActionButton(showAllButton, () => setGlobalOverlayVisible(true));
  bindActionButton(hideAllButton, () => setGlobalOverlayVisible(false));
  bindActionButton(showPageButton, () => setPageOverlayVisible(true));
  bindActionButton(hidePageButton, () => setPageOverlayVisible(false));
  bindActionButton(cancelDndButton, () => cancelDoNotDisturb());
  bindActionButton(setDnd30Button, () => enableDoNotDisturb('30m'));
  bindActionButton(setDnd60Button, () => enableDoNotDisturb('60m'));
  bindActionButton(setDndTodayButton, () => enableDoNotDisturb('today'));
}

function startDndPolling(): void {
  window.setInterval(() => {
    if (!dndActivePanel.hidden) {
      void refreshDoNotDisturbSection();
    }
  }, 30_000);
}

async function initializeProductionPopup(): Promise<void> {
  const { settings, presentation } = await loadInitialSettingsAndPresentation();
  void updatePreviewCat(presentation.sprite);
  await refreshDoNotDisturbSection();
  await refreshOverlayButtons(settings);

  bindSettingsFieldAutosave([
    fields.quietStart,
    fields.quietEnd,
    fields.maxAppearances,
    fields.cooldownMinutes,
  ]);
  bindSharedOverlayAndDndButtons();
  startDndPolling();
}

function afterDevCompanionChange(presentation: { sprite: string }, label: string): void {
  void updatePreviewCat(presentation.sprite);
  void refreshOverlayButtons();
  showStatus(label);
}

function revealDevOnlyControls(): void {
  forceTickButton.hidden = !IS_DEV_BUILD;
  forceTickHint.hidden = !IS_DEV_BUILD;
  devForceAppearButton.hidden = !IS_DEV_BUILD;
  devForceHideButton.hidden = !IS_DEV_BUILD;
  devPresenceHint.hidden = !IS_DEV_BUILD;
  resetIntroButton.hidden = !IS_DEV_BUILD;
}

function bindDevOnlyControls(): void {
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
      showStatus(next ? `Ticked. Mood: ${next.mood}${next.speech ? ' — speaking' : ''}.` : 'Ticked.');
    })();
  });

  resetIntroButton.addEventListener('click', () => {
    void (async () => {
      await requestResetIntro();
      showStatus(t('settings.introReset'));
    })();
  });

  // Other flows (e.g. tapping a peek on the page) can change devForceMood behind this popup's
  // back (it resets to "auto" on reveal). Without this, the dropdown keeps showing the old
  // value, so re-picking that same option fires no `change` event and looks like the dev menu
  // stopped working.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') {
      return;
    }
    const next = changes.settings?.newValue as ExtensionSettings | undefined;
    const cachedSettings = getCachedSettings();
    if (!next || !cachedSettings) {
      return;
    }
    setCachedSettings(next);
    const displayed = fields.devForceMood.value as ExtensionSettings['devForceMood'];
    if (shouldSyncDevForceMoodUi(displayed, next, isSyncingTemper())) {
      void refreshDevTemperUi();
    }
  });
}

async function initializeDevPopup(): Promise<void> {
  devBuildHint.textContent = 'Dev build detected — extra interactions are available when dev mode is on.';

  const { settings, presentation } = await loadInitialSettingsAndPresentation();
  await refreshDoNotDisturbSection();
  await refreshOverlayButtons(settings);
  if (settings.devModeEnabled) {
    await refreshDevTemperUi();
  } else {
    void updatePreviewCat(presentation.sprite);
  }

  const devFormFields = Object.values(fields).filter((element) => element !== fields.devForceMood);
  bindSettingsFieldAutosave(devFormFields);
  fields.devModeEnabled.addEventListener('change', () => {
    void refreshDevTemperUi();
    scheduleSave();
  });
  bindTemperControls();

  bindSharedOverlayAndDndButtons();
  startDndPolling();

  revealDevOnlyControls();
  bindDevOnlyControls();
}

async function initialize(): Promise<void> {
  devSettingsSection.hidden = !IS_DEV_BUILD;

  if (!IS_DEV_BUILD) {
    await initializeProductionPopup();
    return;
  }

  await initializeDevPopup();
}

void initialize();
