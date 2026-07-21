import { loadAppLocale } from '../../utils/i18n';
import {
  cancelDoNotDisturb as cancelDoNotDisturbState,
  enableDoNotDisturb,
  getPageOverlayState,
  hideOverlayOnPage,
  runMinuteTick,
} from '../../utils/orchestrator';
import {
  clearCompanionSpeech,
  devForceCompanionHide,
  devForceCompanionShow,
  evaluateAndPresent,
  getCurrentPresentation,
  getDevTemperState,
  handleCareAction,
  recordInteractionPing,
  restartIntroSession,
  settleAfterIntro,
  showOverlayOnPage,
  syncDevTemperControls,
} from '../../utils/cat';
import { getDoNotDisturbStatus } from '../../utils/do-not-disturb';
import { resolveCareActionPageUrl } from '../../utils/care-action';
import { clearAllPageOverlayHides, isPageOverlayHidden } from '../../utils/page-overlay';
import { getSettings, saveSettings, settingsChangeRequiresPresent } from '../../utils/settings';
import { resolveActiveOverlayTabId } from '../../utils/active-overlay';
import type { CareAction, RuntimeMessage, RuntimeResponse } from '../../utils/types';
import {
  activePageContext,
  activeTabContext,
  tryScoreActivePage,
  updateToolbarFromPresentation,
} from './tab-activity';
import { deactivateOverlayIfHosting, syncActiveTabOverlay, syncOverlayToTab } from './overlay-sync';

const IS_DEV_BUILD = import.meta.env.DEV;

export interface MessageSender {
  tab?: { id?: number; url?: string };
}

export type SendResponse = (response: RuntimeResponse) => void;

async function activeTab(): Promise<{ id?: number; url?: string; title?: string } | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Shared tail for handlers whose effect might change whether/where the overlay shows. */
async function syncOverlayAndToolbarForActiveTab(): Promise<void> {
  await syncOverlayToTab(await activeTab());
  await updateToolbarFromPresentation();
}

type DevGuard = { ok: true } | { ok: false; response: RuntimeResponse };

/** Dev tools that also require the user's own "dev mode" setting on, with a friendlier
 * message than the generic one buildDevPreviewPresentation's own internal guard would throw. */
async function requireDevBuildAndMode(featureLabel: string): Promise<DevGuard> {
  if (!IS_DEV_BUILD) {
    return { ok: false, response: { ok: false, error: `${featureLabel} are only available in dev builds.` } };
  }
  const settings = await getSettings(IS_DEV_BUILD);
  if (!settings.devModeEnabled) {
    return { ok: false, response: { ok: false, error: 'Turn on dev mode to use companion test controls.' } };
  }
  return { ok: true };
}

/** Dev tools that only gate on the build itself (their own internal call already throws if
 * dev mode isn't on, with a less specific message — acceptable for these two). */
function requireDevBuild(featureLabel: string): DevGuard {
  if (!IS_DEV_BUILD) {
    return { ok: false, response: { ok: false, error: `${featureLabel} are only available in dev builds.` } };
  }
  return { ok: true };
}

export async function handleGetPresentation(sendResponse: SendResponse): Promise<void> {
  const data = await getCurrentPresentation();
  sendResponse({ ok: true, data });
}

export async function handleGetSettings(sendResponse: SendResponse): Promise<void> {
  const data = await getSettings(IS_DEV_BUILD);
  sendResponse({ ok: true, data });
}

export async function handleSaveSettings(
  message: Extract<RuntimeMessage, { type: 'saveSettings' }>,
  sendResponse: SendResponse,
): Promise<void> {
  const before = await getSettings(IS_DEV_BUILD);
  const data = await saveSettings(message.settings, IS_DEV_BUILD);
  if (before.locale !== data.locale) {
    await loadAppLocale(data.locale);
  }
  if (data.showOverlay && !before.showOverlay) {
    await clearAllPageOverlayHides();
    const tab = await activeTab();
    await showOverlayOnPage(Date.now(), { url: tab?.url, title: tab?.title });
    await syncOverlayToTab(tab);
  } else if (!data.showOverlay && before.showOverlay) {
    await deactivateOverlayIfHosting();
  } else if (
    data.showOverlay &&
    (!message.skipPresent || settingsChangeRequiresPresent(before, data))
  ) {
    // saveSettings() above already persisted `data`, so evaluateAndPresent's own
    // fresh state load picks it up — no need to load state here just to override it.
    await evaluateAndPresent(Date.now(), {
      forceDevSpeech: data.devModeEnabled,
      page: activePageContext(),
    });
  }
  await updateToolbarFromPresentation();
  sendResponse({ ok: true, data });
}

export async function handleCareActionMessage(
  message: Extract<RuntimeMessage, { type: 'careAction' }>,
  sender: MessageSender,
  sendResponse: SendResponse,
): Promise<void> {
  const tab = await activeTabContext();
  const pageUrl = resolveCareActionPageUrl(message.url, sender.tab?.url, tab.url);
  const data = await handleCareAction(message.action as CareAction, Date.now(), {
    title: tab.title,
    topic: undefined,
    url: pageUrl,
  });
  await updateToolbarFromPresentation();
  sendResponse({ ok: true, data });
}

export async function handleGetPageOverlayState(
  message: Extract<RuntimeMessage, { type: 'getPageOverlayState' }>,
  sendResponse: SendResponse,
): Promise<void> {
  const settings = await getSettings(IS_DEV_BUILD);
  const tab = await activeTabContext();
  const data = await getPageOverlayState(message.url ?? tab.url, settings);
  sendResponse({ ok: true, data });
}

export async function handleGetDoNotDisturb(sendResponse: SendResponse): Promise<void> {
  const data = await getDoNotDisturbStatus();
  sendResponse({ ok: true, data });
}

export async function handleCancelDoNotDisturb(sendResponse: SendResponse): Promise<void> {
  const data = await cancelDoNotDisturbState(Date.now());
  await syncOverlayAndToolbarForActiveTab();
  sendResponse({ ok: true, data });
}

export async function handleSetDoNotDisturb(
  message: Extract<RuntimeMessage, { type: 'setDoNotDisturb' }>,
  sendResponse: SendResponse,
): Promise<void> {
  const data = await enableDoNotDisturb(message.duration, Date.now());
  await syncOverlayAndToolbarForActiveTab();
  sendResponse({ ok: true, data });
}

export async function handleShowOverlay(
  message: Extract<RuntimeMessage, { type: 'showOverlay' }>,
  sendResponse: SendResponse,
): Promise<void> {
  const tab = await activeTabContext();
  const data = await showOverlayOnPage(Date.now(), {
    title: message.title ?? tab.title,
    url: message.url ?? tab.url,
  });
  await syncOverlayAndToolbarForActiveTab();
  sendResponse({ ok: true, data });
}

export async function handleHideOverlay(
  message: Extract<RuntimeMessage, { type: 'hideOverlay' }>,
  sendResponse: SendResponse,
): Promise<void> {
  const tab = await activeTabContext();
  const data = await hideOverlayOnPage({ url: message.url ?? tab.url });
  await syncOverlayAndToolbarForActiveTab();
  sendResponse({ ok: true, data });
}

export async function handleSyncActiveOverlay(sendResponse: SendResponse): Promise<void> {
  const settings = await getSettings(IS_DEV_BUILD);
  if (settings.showOverlay) {
    await syncActiveTabOverlay();
  }
  sendResponse({ ok: true });
}

export async function handleIsActiveOverlayTab(
  sender: MessageSender,
  sendResponse: SendResponse,
): Promise<void> {
  const settings = await getSettings(IS_DEV_BUILD);
  const tab = await activeTab();
  const onActiveTab =
    settings.showOverlay &&
    sender.tab?.id === tab?.id &&
    resolveActiveOverlayTabId(sender.tab, true) !== null;
  if (!onActiveTab) {
    sendResponse({ ok: true, data: { active: false } });
    return;
  }
  const presentation = await getCurrentPresentation();
  const pageHidden = await isPageOverlayHidden(sender.tab?.url);
  sendResponse({ ok: true, data: { active: presentation.companionVisible && !pageHidden } });
}

export async function handleResetIntro(sendResponse: SendResponse): Promise<void> {
  const data = await restartIntroSession(Date.now());
  sendResponse({ ok: true, data });
  void syncActiveTabOverlay().then(() => updateToolbarFromPresentation());
}

export async function handleClearCompanionSpeech(sendResponse: SendResponse): Promise<void> {
  const data = await clearCompanionSpeech(Date.now());
  sendResponse({ ok: true, data });
}

export async function handleRecordInteraction(sendResponse: SendResponse): Promise<void> {
  await recordInteractionPing(Date.now());
  sendResponse({ ok: true });
}

export async function handleSettleAfterIntro(sendResponse: SendResponse): Promise<void> {
  const data = await settleAfterIntro(Date.now());
  sendResponse({ ok: true, data });
  void syncActiveTabOverlay().then(() => updateToolbarFromPresentation());
}

export async function handleDevForceCompanionShow(sendResponse: SendResponse): Promise<void> {
  const guard = await requireDevBuildAndMode('Dev companion controls');
  if (!guard.ok) {
    sendResponse(guard.response);
    return;
  }
  const data = await devForceCompanionShow(Date.now());
  sendResponse({ ok: true, data });
  void syncActiveTabOverlay().then(() => updateToolbarFromPresentation());
}

export async function handleDevForceCompanionHide(sendResponse: SendResponse): Promise<void> {
  const guard = await requireDevBuildAndMode('Dev companion controls');
  if (!guard.ok) {
    sendResponse(guard.response);
    return;
  }
  const data = await devForceCompanionHide(Date.now());
  sendResponse({ ok: true, data });
  void syncActiveTabOverlay().then(() => updateToolbarFromPresentation());
}

export async function handleGetDevTemper(sendResponse: SendResponse): Promise<void> {
  const guard = requireDevBuild('Dev temper controls');
  if (!guard.ok) {
    sendResponse(guard.response);
    return;
  }
  const data = await getDevTemperState();
  sendResponse({ ok: true, data });
}

export async function handleSyncDevTemper(
  message: Extract<RuntimeMessage, { type: 'syncDevTemper' }>,
  sendResponse: SendResponse,
): Promise<void> {
  const guard = requireDevBuild('Dev temper controls');
  if (!guard.ok) {
    sendResponse(guard.response);
    return;
  }
  const data = await syncDevTemperControls({
    simulation: message.simulation,
    devForceMood: message.devForceMood,
  });
  sendResponse({ ok: true, data });
  void syncActiveTabOverlay().then(() => updateToolbarFromPresentation());
}

export async function handleTick(sendResponse: SendResponse): Promise<void> {
  const settings = await getSettings(IS_DEV_BUILD);
  await tryScoreActivePage(Date.now());
  const state = await runMinuteTick(Date.now(), {
    forceTick: IS_DEV_BUILD && settings.devModeEnabled,
    page: activePageContext(),
  });
  sendResponse({ ok: true, data: state.lastPresentation });
  void syncActiveTabOverlay().then(() => updateToolbarFromPresentation());
}

export function handlePing(sendResponse: SendResponse): void {
  sendResponse({ ok: true });
}

export function handleUnknownMessage(sendResponse: SendResponse): void {
  sendResponse({ ok: false, error: 'Unknown message type' });
}
