import { isTrackableUrl, parseHostname } from '../utils/classifier';
import { markIntroCompleted, resetIntro } from '../utils/intro';
import {
  ensureOverlayOnAllTabs,
  ensureOverlayOnTab,
  registerPageOverlayScript,
} from '../utils/overlay-inject';
import {
  ensureCatExists,
  evaluateAndPresent,
  getCurrentPresentation,
  handleCareAction,
  loadOrchestratorState,
  recordBrowsingSession,
  runMinuteTick,
  showOverlayOnPage,
} from '../utils/orchestrator';
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

let taskQueue = Promise.resolve();

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
  const badge =
    presentation.mood === 'starving'
      ? '!'
      : presentation.speech && !presentation.overlayHidden
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
  await updateToolbarFromPresentation();
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

async function bootstrap(): Promise<void> {
  await ensureSettingsExist(IS_DEV_BUILD);
  if (IS_DEV_BUILD) {
    try {
      await registerPageOverlayScript();
    } catch (error) {
      console.error('[Tabby] Could not register overlay script.', error);
    }
    // Runtime registration only applies to new navigations — inject open tabs too.
    await ensureOverlayOnAllTabs({ injectIfNeeded: true });
  }
  await ensureCatExists(Date.now());
  void preloadSpeechEngine();
  const state = await loadOrchestratorState();
  await evaluateAndPresent(state, Date.now(), {
    forceDevSpeech: IS_DEV_BUILD && state.settings.devModeEnabled,
  });
  await scheduleTickAlarm();
  await updateToolbarFromPresentation();
  if (!IS_DEV_BUILD) {
    await ensureOverlayOnAllTabs();
  }

  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  await syncFocusToTab(activeTab, Date.now());
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
      await runMinuteTick(Date.now());
      await updateToolbarFromPresentation();
    });
  });

  browser.tabs.onActivated.addListener((activeInfo) => {
    enqueueTask(async () => {
      const tab = await browser.tabs.get(activeInfo.tabId);
      await ensureOverlayOnTab(tab, { injectIfNeeded: IS_DEV_BUILD });
      await syncFocusToTab(tab);
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
      await ensureOverlayOnTab(activeTab, { injectIfNeeded: IS_DEV_BUILD });
      await syncFocusToTab(activeTab);
    });
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      enqueueTask(async () => {
        await ensureOverlayOnTab({ id: tabId, url: tab.url }, { injectIfNeeded: IS_DEV_BUILD });
      });
    }

    if (!changeInfo.url && !changeInfo.title && changeInfo.status !== 'complete') {
      return;
    }

    enqueueTask(async () => {
      if (tab.active && tab.id === activeSnapshot.tabId) {
        if (isTrackableUrl(tab.url)) {
          activeSnapshot = {
            ...activeSnapshot,
            title: tab.title ?? activeSnapshot.title,
            url: tab.url ?? activeSnapshot.url,
            hostname: parseHostname(tab.url ?? activeSnapshot.url),
          };
        }
      }
    });
  });

  browser.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
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
            const data = await saveSettings(message.settings, IS_DEV_BUILD);
            const state = await loadOrchestratorState();
            await evaluateAndPresent(
              { ...state, settings: data },
              Date.now(),
              { forceDevSpeech: data.devModeEnabled },
            );
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
            const data = await handleCareAction(
              message.action as CareAction,
              Date.now(),
              {
                title: activeSnapshot.title || undefined,
                topic: undefined,
              },
            );
            await updateToolbarFromPresentation();
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            return;
          }
          case 'showOverlay': {
            const data = await showOverlayOnPage(Date.now(), {
              title: activeSnapshot.title || undefined,
            });
            await updateToolbarFromPresentation();
            sendResponse({ ok: true, data } satisfies RuntimeResponse);
            return;
          }
          case 'resetIntro': {
            await resetIntro();
            sendResponse({ ok: true } satisfies RuntimeResponse);
            return;
          }
          case 'tick': {
            const state = await runMinuteTick(Date.now());
            await evaluateAndPresent(state, Date.now(), {
              forceDevSpeech: IS_DEV_BUILD,
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
