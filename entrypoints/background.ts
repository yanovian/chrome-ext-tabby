import { markIntroCompleted } from '../utils/intro';
import { completeFeedingIfDue, completePlayingIfDue } from '../utils/cat';
import { recordDrainingSessionElapsed } from '../utils/draining-session';
import { getSettings } from '../utils/settings';
import { runMinuteTick } from '../utils/orchestrator';
import { ALARM_NAMES } from '../utils/types';
import { enqueueTask } from './background/task-queue';
import { bootstrap, bootstrapInstall } from './background/bootstrap';
import {
  activePageContext,
  applyTabNavigation,
  clearActiveTabForNoFocus,
  focusActiveTab,
  hasTrackableActiveTab,
  refreshPresentationForActiveTab,
  tryScoreActivePage,
  updateToolbarFromPresentation,
} from './background/tab-activity';
import { syncActiveTabOverlay, syncOverlayToTab } from './background/overlay-sync';
import { registerMessageListener } from './background/message-router';

const IS_DEV_BUILD = import.meta.env.DEV;

export default defineBackground(() => {
  void bootstrap();

  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'update') {
      if (!IS_DEV_BUILD) {
        void markIntroCompleted();
        enqueueTask(() => bootstrap());
      }
      return;
    }
    if (details.reason === 'install') {
      enqueueTask(() => bootstrapInstall());
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
      const shouldPresent = hasTrackableActiveTab();
      if (shouldPresent) {
        const settings = await getSettings(IS_DEV_BUILD);
        const page = activePageContext();
        await recordDrainingSessionElapsed({
          title: page.title,
          url: page.url,
          elapsedMs: 60_000,
          now,
          settings,
        });
      }
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
        await clearActiveTabForNoFocus();
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
      const { shouldRefreshPresentation, shouldSyncOverlay } = await applyTabNavigation(
        tabId,
        changeInfo,
        tab,
      );
      if (shouldRefreshPresentation) {
        await refreshPresentationForActiveTab();
      }
      if (shouldSyncOverlay) {
        await syncOverlayToTab({ id: tabId, url: tab.url });
      }
    });
  });

  registerMessageListener();

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !('presentation' in changes)) {
      return;
    }
    void updateToolbarFromPresentation();
  });
});
