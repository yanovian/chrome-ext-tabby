import { isTrackableUrl, parseHostname } from '../utils/classifier';
import { markIntroCompleted, resetIntro } from '../utils/intro';
import {
  notifyOverlayActivate,
  notifyOverlayDeactivate,
  resolveActiveOverlayTabId,
} from '../utils/active-overlay';
import {
  ensureCatExists,
  evaluateAndPresent,
  getCurrentPresentation,
  getPageOverlayState,
  handleCareAction,
  hideOverlayOnPage,
  loadOrchestratorState,
  presentOnActiveTab,
  recordBrowsingSession,
  runMinuteTick,
  showOverlayOnPage,
  type PageContext,
} from '../utils/orchestrator';
import { resolveCareActionPageUrl } from '../utils/care-action';
import { isPageOverlayHidden, clearAllPageOverlayHides } from '../utils/page-overlay';
import { preloadSpeechEngine } from '../utils/speech-service';
import { ensureSettingsExist, getSettings, saveSettings, effectiveAppearanceLimits } from '../utils/settings';
import {
  beginFocus,
  createEmptySnapshot,
  endFocus,
  type ActiveTabSnapshot,
} from '../utils/tab-session';
import { ALARM_NAMES } from '../utils/types';
import type { CareAction, RuntimeMessage, RuntimeResponse } from '../utils/types';

const IS_DEV_BUILD = import.meta.env.DEV;

/** Tracks the tab the user is currently reading. */
let activeSnapshot: ActiveTabSnapshot = createEmptySnapshot();

/** Last page text snippet reported by the active tab's content script. */
let latestPageTextSnippet = '';

/** Tab that currently hosts the floating cat (at most one). */
let activeOverlayTabId: number | null = null;

let taskQueue = Promise.resolve();

async function activeTabContext(): Promise<{ url?: string; title?: string }> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return {
    url: tab?.url || activeSnapshot.url || undefined,
    title: tab?.title || activeSnapshot.title || undefined,
  };
}

function enqueueTask(task: () => Promise<void>): void {
  taskQueue = taskQueue.then(task).catch((error) => {
    console.error('[Tabby]', error);
  });
}

async function scheduleTickAlarm(): Promise<void> {
  await browser.alarms.clear(ALARM_NAMES.tick);
  await browser.alarms.create(ALARM_NAMES.tick, { periodInMinutes: 1 });
}

async function updateToolbarFromPresentation(): Promise<void> {
  const presentation = await getCurrentPresentation();
  const hiddenOnActiveTab = await isPageOverlayHidden(activeSnapshot.url);
  const badge =
    presentation.mood === 'starving'
      ? '!'
      : presentation.speech && !hiddenOnActiveTab
        ? '•'
        : '';
  await browser.action.setBadgeText({ text: badge });
  await browser.action.setBadgeBackgroundColor({ color: '#E07A5F' });
  await browser.action.setTitle({ title: `Tabby — ${presentation.mood}` });
}

async function flushActiveTab(now = Date.now()): Promise<void> {
  const ending = { ...activeSnapshot };
  const { snapshot, activeDurationMs } = endFocus(activeSnapshot, now);
  activeSnapshot = snapshot;

  const settings = await getSettings(IS_DEV_BUILD);
  const { minTabDurationMs } = effectiveAppearanceLimits(settings);

  if (
    !ending.tabId ||
    !isTrackableUrl(ending.url) ||
    activeDurationMs < minTabDurationMs
  ) {
    return;
  }

  await recordBrowsingSession({
    title: ending.title,
    url: ending.url,
    hostname: ending.hostname,
    pageTextSnippet: latestPageTextSnippet,
    activeDurationMs,
    now,
  });
}

async function refreshPresentationForActiveTab(now = Date.now()): Promise<void> {
  const settings = await getSettings(IS_DEV_BUILD);
  if (!settings.showOverlay || !isTrackableUrl(activeSnapshot.url)) {
    return;
  }

  await presentOnActiveTab(
    now,
    {
      title: activeSnapshot.title || undefined,
      url: activeSnapshot.url || undefined,
    },
    { forceDevSpeech: IS_DEV_BUILD && settings.devModeEnabled },
  );
  await updateToolbarFromPresentation();
}

async function syncOverlayToTab(
  tab: { id?: number; url?: string } | undefined,
): Promise<void> {
  const settings = await getSettings(IS_DEV_BUILD);
  const nextTabId = resolveActiveOverlayTabId(tab, settings.showOverlay);

  if (activeOverlayTabId !== null && activeOverlayTabId !== nextTabId) {
    await notifyOverlayDeactivate(activeOverlayTabId);
  }

  activeOverlayTabId = nextTabId;

  if (nextTabId !== null) {
    await notifyOverlayActivate(nextTabId);
  }
}

async function focusActiveTab(
  tab: { id?: number; title?: string; url?: string } | undefined,
  now = Date.now(),
): Promise<void> {
  await syncFocusToTab(tab, now);
  await refreshPresentationForActiveTab(now);
  await syncOverlayToTab(tab);
}

async function syncFocusToTab(
  tab: { id?: number; title?: string; url?: string } | undefined,
  now = Date.now(),
): Promise<void> {
  await flushActiveTab(now);
  latestPageTextSnippet = '';

  if (!tab?.id || !isTrackableUrl(tab.url)) {
    activeSnapshot = createEmptySnapshot();
    return;
  }

  activeSnapshot = beginFocus(createEmptySnapshot(), tab, now);
}

function activePageContext(): PageContext {
  return {
    title: activeSnapshot.title || undefined,
    url: activeSnapshot.url || undefined,
  };
}

async function bootstrap(): Promise<void> {
  await ensureSettingsExist(IS_DEV_BUILD);
  await ensureCatExists(Date.now());
  const state = await loadOrchestratorState();
  if (state.settings.localSpeechEnabled) {
    void preloadSpeechEngine();
  }
  await scheduleTickAlarm();

  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  await focusActiveTab(activeTab, Date.now());
  if (!state.settings.showOverlay) {
    await updateToolbarFromPresentation();
  }
}

export default defineBackground(() => {
  void bootstrap();

  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'update') {
      if (!IS_DEV_BUILD) {
        void markIntroCompleted();
      }
      // Dev reloads already run bootstrap(); skip duplicate work.
      if (!IS_DEV_BUILD) {
        enqueueTask(() => bootstrap());
      }
      return;
    }
    if (details.reason === 'install') {
      void resetIntro();
      enqueueTask(() => bootstrap());
    }
  });

  browser.runtime.onStartup.addListener(() => {
    enqueueTask(() => bootstrap());
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== ALARM_NAMES.tick) {
      return;
    }

    enqueueTask(async () => {
      await runMinuteTick(Date.now(), { present: false });
      await updateToolbarFromPresentation();
    });
  });

  browser.tabs.onActivated.addListener((activeInfo) => {
    enqueueTask(async () => {
      const tab = await browser.tabs.get(activeInfo.tabId);
      await focusActiveTab(tab);
    });
  });

  browser.windows.onFocusChanged.addListener((windowId) => {
    enqueueTask(async () => {
      if (windowId === browser.windows.WINDOW_ID_NONE) {
        await flushActiveTab();
        activeSnapshot = createEmptySnapshot();
        return;
      }

      const [activeTab] = await browser.tabs.query({
        active: true,
        windowId,
      });
      await focusActiveTab(activeTab);
    });
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo.url && !changeInfo.title && changeInfo.status !== 'complete') {
      return;
    }

    enqueueTask(async () => {
      if (tab.active && tab.id === activeSnapshot.tabId && isTrackableUrl(tab.url)) {
        activeSnapshot = {
          ...activeSnapshot,
          title: tab.title ?? activeSnapshot.title,
          url: tab.url ?? activeSnapshot.url,
          hostname: parseHostname(tab.url ?? activeSnapshot.url),
        };
        if (changeInfo.url || changeInfo.status === 'complete') {
          latestPageTextSnippet = '';
          await refreshPresentationForActiveTab();
        }
      }

      if (changeInfo.status === 'complete' && tab.active) {
        await syncOverlayToTab({ id: tabId, url: tab.url });
      }
    });
  });

  browser.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
    const msgType = (message as { type?: string })?.type;
    if (msgType === 'speech:generate' || msgType === 'speech:warm') {
      return false;
    }

    void (async () => {
      try {
        switch (message?.type) {
          case 'getPresentation': {
            const data = await getCurrentPresentation();
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            return;
          }
          case 'getSettings': {
            const data = await getSettings(IS_DEV_BUILD);
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            return;
          }
          case 'saveSettings': {
            const before = await getSettings(IS_DEV_BUILD);
            const data = await saveSettings(message.settings, IS_DEV_BUILD);
            if (data.showOverlay && !before.showOverlay) {
              await clearAllPageOverlayHides();
              const [activeTab] = await browser.tabs.query({
                active: true,
                currentWindow: true,
              });
              await refreshPresentationForActiveTab();
              await syncOverlayToTab(activeTab);
            } else if (!data.showOverlay && before.showOverlay) {
              if (activeOverlayTabId !== null) {
                await notifyOverlayDeactivate(activeOverlayTabId);
                activeOverlayTabId = null;
              }
            } else if (data.showOverlay) {
              const state = await loadOrchestratorState();
              await evaluateAndPresent(
                { ...state, settings: data },
                Date.now(),
                { forceDevSpeech: data.devModeEnabled, page: activePageContext() },
              );
            }
            await updateToolbarFromPresentation();
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            return;
          }
          case 'observeTab': {
            latestPageTextSnippet = message.observation.pageTextSnippet;
            sendResponse({ ok: true } satisfies RuntimeResponse);
            return;
          }
          case 'careAction': {
            const pageUrl = resolveCareActionPageUrl(
              message.url,
              sender.tab?.url,
              activeSnapshot.url || undefined,
            );
            const data = await handleCareAction(
              message.action as CareAction,
              Date.now(),
              {
                title: activeSnapshot.title || undefined,
                topic: undefined,
                url: pageUrl,
              },
            );
            await updateToolbarFromPresentation();
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            return;
          }
          case 'getPageOverlayState': {
            const settings = await getSettings(IS_DEV_BUILD);
            const tab = await activeTabContext();
            const data = await getPageOverlayState(message.url ?? tab.url, settings);
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            return;
          }
          case 'showOverlay': {
            const tab = await activeTabContext();
            const data = await showOverlayOnPage(Date.now(), {
              title: message.title ?? tab.title,
              url: message.url ?? tab.url,
            });
            const [activeTab] = await browser.tabs.query({
              active: true,
              currentWindow: true,
            });
            await syncOverlayToTab(activeTab);
            await updateToolbarFromPresentation();
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            return;
          }
          case 'hideOverlay': {
            const tab = await activeTabContext();
            const data = await hideOverlayOnPage({
              url: message.url ?? tab.url,
            });
            await updateToolbarFromPresentation();
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            return;
          }
          case 'syncActiveOverlay': {
            const settings = await getSettings(IS_DEV_BUILD);
            if (settings.showOverlay) {
              const [activeTab] = await browser.tabs.query({
                active: true,
                currentWindow: true,
              });
              await syncOverlayToTab(activeTab);
            }
            sendResponse({ ok: true } satisfies RuntimeResponse);
            return;
          }
          case 'isActiveOverlayTab': {
            sendResponse({
              ok: true,
              data: { active: sender.tab?.id === activeOverlayTabId },
            } satisfies RuntimeResponse);
            return;
          }
          case 'resetIntro': {
            await resetIntro();
            sendResponse({ ok: true } satisfies RuntimeResponse);
            return;
          }
          case 'tick': {
            await runMinuteTick(Date.now(), {
              forceTick: IS_DEV_BUILD,
              page: activePageContext(),
            });
            await updateToolbarFromPresentation();
            sendResponse({ ok: true } satisfies RuntimeResponse);
            return;
          }
          case 'ping': {
            sendResponse({ ok: true } satisfies RuntimeResponse);
            return;
          }
          default:
            sendResponse({
              ok: false,
              error: 'Unknown message type',
            } satisfies RuntimeResponse);
        }
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Unexpected error',
        } satisfies RuntimeResponse);
      }
    })();

    return true;
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !('presentation' in changes)) {
      return;
    }
    void updateToolbarFromPresentation();
  });
});
