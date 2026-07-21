import {
  requestHideOverlayOnPage,
  requestPageOverlayState,
  requestPresentation,
  requestSaveSettings,
  requestShowOverlayOnPage,
  requestSyncActiveOverlay,
} from '../../utils/runtime-client';
import { ignoreIfExtensionUnavailable } from '../../utils/extension-errors';
import { t } from '../../utils/i18n';
import type { ExtensionSettings } from '../../utils/types';
import { hidePageButton, hideAllButton, pageOverlayHint, showAllButton, showPageButton } from './dom-refs';
import { getCachedSettings, setCachedSettings } from './settings-store';
import { updatePreviewCat } from './preview-cat';
import { showStatus } from './status';
import { fillForm, readPartialSettings } from './settings-form';
// refreshDoNotDisturbSection (dnd-actions.ts) also calls back into refreshOverlayButtons here
// — both sides are function declarations only invoked from event handlers, never at
// module-init time, so the cycle never actually runs during either module's own evaluation.
import { refreshDoNotDisturbSection } from './dnd-actions';

export interface ActiveTabInfo {
  id?: number;
  url?: string;
  title?: string;
}

export async function getActiveTab(): Promise<ActiveTabInfo> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return {
    id: tab?.id,
    url: tab?.url,
    title: tab?.title,
  };
}

export async function ensureOverlayOnActiveTab(tabId?: number): Promise<void> {
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

export async function refreshOverlayButtons(settings: ExtensionSettings = getCachedSettings()): Promise<void> {
  setCachedSettings(settings);
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

export async function setGlobalOverlayVisible(show: boolean): Promise<void> {
  const saved = await requestSaveSettings({
    ...readPartialSettings(),
    showOverlay: show,
  });
  setCachedSettings(saved);
  fillForm(saved);
  if (show) {
    await requestSyncActiveOverlay();
  }
  await refreshOverlayButtons(saved);
  showStatus(show ? t('settings.shownOnTab') : t('settings.hiddenAll'));
}

export async function setPageOverlayVisible(show: boolean): Promise<void> {
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
