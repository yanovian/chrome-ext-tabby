import { isTrackableUrl, parseHostname } from '../utils/classifier';
import { markIntroCompleted, resetIntro } from '../utils/intro';
import {
  notifyOverlayActivate,
  notifyOverlayDeactivate,
  resolveActiveOverlayTabId,
} from '../utils/active-overlay';
import {
  ensureCatExists,
  cancelDoNotDisturb,
  clearCompanionSpeech,
  devForceCompanionHide,
  devForceCompanionShow,
  enableDoNotDisturb,
  completeFeedingIfDue,
  completePlayingIfDue,
  evaluateAndPresent,
  getCurrentPresentation,
  getPageOverlayState,
  handleCareAction,
  hideOverlayOnPage,
  loadOrchestratorState,
  presentOnActiveTab,
  recordPageVisit,
  restartIntroSession,
  runMinuteTick,
  showOverlayOnPage,
  settleAfterIntro,
  type PageContext,
} from '../utils/orchestrator';
import { getDoNotDisturbStatus } from '../utils/do-not-disturb';
import { resolveCareActionPageUrl } from '../utils/care-action';
import { isPageOverlayHidden, clearAllPageOverlayHides } from '../utils/page-overlay';
import { effectiveAppearanceLimits, ensureSettingsExist, getSettings, saveSettings } from '../utils/settings';
import {
  beginFocus,
  createEmptySnapshot,
  endFocus,
  type ActiveTabSnapshot,
} from '../utils/tab-session';
import { hasDwelledLongEnough } from '../utils/visit-dedup';
import type { CareAction, RuntimeMessage, RuntimeResponse } from '../utils/types';
import { ALARM_NAMES } from '../utils/types';

const IS_DEV_BUILD = import.meta.env.DEV;

/** Tracks the tab the user is currently reading. */
let activeSnapshot: ActiveTabSnapshot = createEmptySnapshot();

/** Whether the current page focus has already been scored for mood. */
let scoredCurrentFocus = false;

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

async function tryScoreActivePage(now = Date.now()): Promise<void> {
  if (
    scoredCurrentFocus ||
    !activeSnapshot.tabId ||
    !isTrackableUrl(activeSnapshot.url) ||
    !activeSnapshot.focusStartedAt
  ) {
    return;
  }

  const settings = await getSettings(IS_DEV_BUILD);
  const { minPageDwellMs } = effectiveAppearanceLimits(settings);
  if (!hasDwelledLongEnough(activeSnapshot.focusStartedAt, now, minPageDwellMs)) {
    return;
  }

  const dwellMs = now - activeSnapshot.focusStartedAt;
  const result = await recordPageVisit({
    title: activeSnapshot.title,
    url: activeSnapshot.url,
    hostname: activeSnapshot.hostname,
    activeDurationMs: dwellMs,
    now,
  });

  if (result.counted) {
    scoredCurrentFocus = true;
    await refreshPresentationForActiveTab(now);
  }
}

async function flushActiveTab(now = Date.now()): Promise<void> {
  await tryScoreActivePage(now);
  const { snapshot } = endFocus(activeSnapshot, now);
  activeSnapshot = snapshot;
  scoredCurrentFocus = false;
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

  if (nextTabId === null) {
    if (activeOverlayTabId !== null) {
      await notifyOverlayDeactivate(activeOverlayTabId);
      activeOverlayTabId = null;
    }
    return;
  }

  const presentation = await getCurrentPresentation();
  const pageHidden = await isPageOverlayHidden(tab?.url);
  const shouldShow = presentation.companionVisible && !pageHidden;
  const previousHost = activeOverlayTabId;

  if (previousHost !== null && previousHost !== nextTabId) {
    await notifyOverlayDeactivate(previousHost);
    activeOverlayTabId = null;
  }

  if (shouldShow) {
    await notifyOverlayActivate(nextTabId);
    activeOverlayTabId = nextTabId;
    return;
  }

  if (previousHost === nextTabId) {
    await notifyOverlayDeactivate(nextTabId);
  }
  activeOverlayTabId = null;
}

async function retryActiveOverlaySync(): Promise<void> {
  for (const delayMs of [400, 1200]) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await syncActiveTabOverlay();
  }
}

async function syncActiveTabOverlay(): Promise<void> {
  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  await syncOverlayToTab(activeTab);
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

  if (!tab?.id || !isTrackableUrl(tab.url)) {
    activeSnapshot = createEmptySnapshot();
    scoredCurrentFocus = false;
    return;
  }

  activeSnapshot = beginFocus(createEmptySnapshot(), tab, now);
  scoredCurrentFocus = false;
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
  await scheduleTickAlarm();

  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  await focusActiveTab(activeTab, Date.now());
  const settings = await getSettings(IS_DEV_BUILD);
  if (!settings.showOverlay) {
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
      if (!IS_DEV_BUILD) {
        enqueueTask(() => bootstrap());
      }
      return;
    }
    if (details.reason === 'install') {
      enqueueTask(async () => {
        await resetIntro();
        await bootstrap();
        await retryActiveOverlaySync();
      });
    }
  });

  browser.runtime.onStartup.addListener(() => {
    enqueueTask(() => bootstrap());
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAMES.feedingComplete) {
      enqueueTask(async () => {
        await completeFeedingIfDue(Date.now());
        await updateToolbarFromPresentation();
      });
      return;
    }

    if (alarm.name === ALARM_NAMES.playingComplete) {
      enqueueTask(async () => {
        await completePlayingIfDue(Date.now());
        await updateToolbarFromPresentation();
      });
      return;
    }

    if (alarm.name !== ALARM_NAMES.tick) {
      return;
    }

    enqueueTask(async () => {
      const now = Date.now();
      await tryScoreActivePage(now);
      const shouldPresent =
        activeSnapshot.tabId !== null && isTrackableUrl(activeSnapshot.url);
      await runMinuteTick(now, {
        present: shouldPresent,
        page: shouldPresent ? activePageContext() : undefined,
      });
      if (shouldPresent) {
        await syncActiveTabOverlay();
      }
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
        scoredCurrentFocus = false;
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
        if (changeInfo.url) {
          await tryScoreActivePage();
          activeSnapshot = beginFocus(
            {
              ...activeSnapshot,
              title: tab.title ?? activeSnapshot.title,
              url: tab.url ?? activeSnapshot.url,
              hostname: parseHostname(tab.url ?? activeSnapshot.url),
            },
            { id: tab.id, title: tab.title, url: tab.url },
            Date.now(),
          );
          scoredCurrentFocus = false;
        } else {
          activeSnapshot = {
            ...activeSnapshot,
            title: tab.title ?? activeSnapshot.title,
            url: tab.url ?? activeSnapshot.url,
            hostname: parseHostname(tab.url ?? activeSnapshot.url),
          };
        }

        if (changeInfo.url || changeInfo.status === 'complete') {
          await refreshPresentationForActiveTab();
        }
      }

      if (changeInfo.status === 'complete' && tab.active) {
        await syncOverlayToTab({ id: tabId, url: tab.url });
      }
    });
  });

  browser.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
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
          case 'getDoNotDisturb': {
            const data = await getDoNotDisturbStatus();
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            return;
          }
          case 'cancelDoNotDisturb': {
            const data = await cancelDoNotDisturb(Date.now());
            const [activeTab] = await browser.tabs.query({
              active: true,
              currentWindow: true,
            });
            await syncOverlayToTab(activeTab);
            await updateToolbarFromPresentation();
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            return;
          }
          case 'setDoNotDisturb': {
            const data = await enableDoNotDisturb(message.duration, Date.now());
            const [activeTab] = await browser.tabs.query({
              active: true,
              currentWindow: true,
            });
            await syncOverlayToTab(activeTab);
            await updateToolbarFromPresentation();
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
            const [activeTab] = await browser.tabs.query({
              active: true,
              currentWindow: true,
            });
            await syncOverlayToTab(activeTab);
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
            const settings = await getSettings(IS_DEV_BUILD);
            const [activeTab] = await browser.tabs.query({
              active: true,
              currentWindow: true,
            });
            const onActiveTab =
              settings.showOverlay &&
              sender.tab?.id === activeTab?.id &&
              resolveActiveOverlayTabId(sender.tab, true) !== null;
            if (!onActiveTab) {
              sendResponse({
                ok: true,
                data: { active: false },
              } satisfies RuntimeResponse);
              return;
            }
            const presentation = await getCurrentPresentation();
            const pageHidden = await isPageOverlayHidden(sender.tab?.url);
            sendResponse({
              ok: true,
              data: { active: presentation.companionVisible && !pageHidden },
            } satisfies RuntimeResponse);
            return;
          }
          case 'resetIntro': {
            const data = await restartIntroSession(Date.now());
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            void syncActiveTabOverlay().then(() => updateToolbarFromPresentation());
            return;
          }
          case 'clearCompanionSpeech': {
            const data = await clearCompanionSpeech(Date.now());
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            return;
          }
          case 'settleAfterIntro': {
            const data = await settleAfterIntro(Date.now());
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            void syncActiveTabOverlay().then(() => updateToolbarFromPresentation());
            return;
          }
          case 'devForceCompanionShow': {
            if (!IS_DEV_BUILD) {
              sendResponse({
                ok: false,
                error: 'Dev companion controls are only available in dev builds.',
              } satisfies RuntimeResponse);
              return;
            }
            const settings = await getSettings(IS_DEV_BUILD);
            if (!settings.devModeEnabled) {
              sendResponse({
                ok: false,
                error: 'Turn on dev mode to use companion test controls.',
              } satisfies RuntimeResponse);
              return;
            }
            const data = await devForceCompanionShow(Date.now());
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            void syncActiveTabOverlay().then(() => updateToolbarFromPresentation());
            return;
          }
          case 'devForceCompanionHide': {
            if (!IS_DEV_BUILD) {
              sendResponse({
                ok: false,
                error: 'Dev companion controls are only available in dev builds.',
              } satisfies RuntimeResponse);
              return;
            }
            const settings = await getSettings(IS_DEV_BUILD);
            if (!settings.devModeEnabled) {
              sendResponse({
                ok: false,
                error: 'Turn on dev mode to use companion test controls.',
              } satisfies RuntimeResponse);
              return;
            }
            const data = await devForceCompanionHide(Date.now());
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            void syncActiveTabOverlay().then(() => updateToolbarFromPresentation());
            return;
          }
          case 'tick': {
            const settings = await getSettings(IS_DEV_BUILD);
            await tryScoreActivePage(Date.now());
            const state = await runMinuteTick(Date.now(), {
              forceTick: IS_DEV_BUILD && settings.devModeEnabled,
              page: activePageContext(),
            });
            sendResponse({
              ok: true,
              data: state.lastPresentation,
            } satisfies RuntimeResponse);
            void syncActiveTabOverlay().then(() => updateToolbarFromPresentation());
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
