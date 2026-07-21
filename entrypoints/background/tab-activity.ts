import { isTrackableUrl, parseHostname } from '../../utils/classifier';
import { presentOnActiveTab, getCurrentPresentation } from '../../utils/cat';
import { recordDrainingSessionElapsed, syncDrainingSessionToPage } from '../../utils/draining-session';
import { recordPageVisit } from '../../utils/orchestrator';
import { isPageOverlayHidden } from '../../utils/page-overlay';
import { effectiveAppearanceLimits, getSettings } from '../../utils/settings';
import { beginFocus, createEmptySnapshot, endFocus, type ActiveTabSnapshot } from '../../utils/tab-session';
import { hasDwelledLongEnough } from '../../utils/visit-dedup';
import type { PageContext } from '../../utils/cat';
import { syncOverlayToTab } from './overlay-sync';

const IS_DEV_BUILD = import.meta.env.DEV;

/**
 * Tracks which tab the user is currently reading, scores its dwell time toward her mood, and
 * keeps the toolbar badge/title in sync with whatever she currently looks like. One module
 * because all three read or drive the same activeSnapshot — splitting them further would just
 * mean threading it back and forth between files that all need it at once.
 */

/** Tracks the tab the user is currently reading. */
let activeSnapshot: ActiveTabSnapshot = createEmptySnapshot();

/** Whether the current page focus has already been scored for mood. */
let scoredCurrentFocus = false;

export function activePageContext(): PageContext {
  return {
    title: activeSnapshot.title || undefined,
    url: activeSnapshot.url || undefined,
  };
}

export async function activeTabContext(): Promise<{ url?: string; title?: string }> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return {
    url: tab?.url || activeSnapshot.url || undefined,
    title: tab?.title || activeSnapshot.title || undefined,
  };
}

/** Whether a minute-tick alarm should score/present the active tab right now. */
export function hasTrackableActiveTab(): boolean {
  return activeSnapshot.tabId !== null && isTrackableUrl(activeSnapshot.url);
}

export async function updateToolbarFromPresentation(): Promise<void> {
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

/** Score the active page after 1+ minute dwell, once per focus, if not in recent-10 dedup. */
export async function tryScoreActivePage(now = Date.now()): Promise<void> {
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

export async function flushActiveTab(now = Date.now()): Promise<void> {
  const { snapshot, activeDurationMs } = endFocus(activeSnapshot, now);
  let shouldRefreshForNudge = false;
  if (activeDurationMs > 0 && isTrackableUrl(activeSnapshot.url)) {
    const settings = await getSettings(IS_DEV_BUILD);
    const session = await recordDrainingSessionElapsed({
      title: activeSnapshot.title,
      url: activeSnapshot.url,
      elapsedMs: activeDurationMs,
      now,
      settings,
    });
    shouldRefreshForNudge =
      session.pendingNudgeKind !== null || session.pendingRecoveryNudge !== null;
  }
  await tryScoreActivePage(now);
  if (shouldRefreshForNudge) {
    await refreshPresentationForActiveTab(now);
  }
  activeSnapshot = snapshot;
  scoredCurrentFocus = false;
}

export async function refreshPresentationForActiveTab(now = Date.now()): Promise<void> {
  const settings = await getSettings(IS_DEV_BUILD);
  if (!settings.showOverlay || !isTrackableUrl(activeSnapshot.url)) {
    return;
  }

  // No forceDevSpeech here: this runs on every tab focus change, not just when the user
  // deliberately asked to preview something (the popup's "Force Tick" button, or a settings
  // save). Forcing speech here would bypass the normal daily cap/cooldown on every single tab
  // switch whenever devModeEnabled happens to be on for unrelated reasons (mood overrides,
  // relaxed limits) — she should only talk because of an explicit interaction or the normal,
  // rare ambient trigger, same as production.
  await presentOnActiveTab(now, {
    title: activeSnapshot.title || undefined,
    url: activeSnapshot.url || undefined,
  });
  await updateToolbarFromPresentation();
}

export async function syncFocusToTab(
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

  const settings = await getSettings(IS_DEV_BUILD);
  await syncDrainingSessionToPage({
    title: tab.title ?? undefined,
    url: tab.url ?? undefined,
    now,
    settings,
  });
}

export async function focusActiveTab(
  tab: { id?: number; title?: string; url?: string } | undefined,
  now = Date.now(),
): Promise<void> {
  await syncFocusToTab(tab, now);
  await refreshPresentationForActiveTab(now);
  await syncOverlayToTab(tab);
}

/** The active tab navigated in place (same tab id, new URL or just a title/status change).
 * Updates activeSnapshot to match and reports what follow-up the caller owes: a fresh
 * presentation read if the URL (or load status) changed, an overlay re-sync once the page
 * has fully loaded. */
export async function applyTabNavigation(
  tabId: number,
  changeInfo: { url?: string; status?: string },
  tab: { active: boolean; url?: string; title?: string },
): Promise<{ shouldRefreshPresentation: boolean; shouldSyncOverlay: boolean }> {
  let shouldRefreshPresentation = false;

  if (tab.active && tabId === activeSnapshot.tabId && isTrackableUrl(tab.url)) {
    if (changeInfo.url) {
      await tryScoreActivePage();
      activeSnapshot = beginFocus(
        {
          ...activeSnapshot,
          title: tab.title ?? activeSnapshot.title,
          url: tab.url ?? activeSnapshot.url,
          hostname: parseHostname(tab.url ?? activeSnapshot.url),
        },
        { id: tabId, title: tab.title, url: tab.url },
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

    shouldRefreshPresentation = Boolean(changeInfo.url) || changeInfo.status === 'complete';
  }

  return {
    shouldRefreshPresentation,
    shouldSyncOverlay: changeInfo.status === 'complete' && tab.active,
  };
}

/** Window lost focus entirely (e.g. switched to another app) — nothing is active anymore. */
export async function clearActiveTabForNoFocus(): Promise<void> {
  await flushActiveTab();
  activeSnapshot = createEmptySnapshot();
  scoredCurrentFocus = false;
}
