import { isTrackableUrl, parseHostname } from './classifier';

export interface ActiveTabSnapshot {
  tabId: number | null;
  title: string;
  url: string;
  hostname: string;
  focusStartedAt: number | null;
}

export function createEmptySnapshot(): ActiveTabSnapshot {
  return {
    tabId: null,
    title: '',
    url: '',
    hostname: '',
    focusStartedAt: null,
  };
}

export function beginFocus(
  snapshot: ActiveTabSnapshot,
  tab: { id?: number; title?: string; url?: string },
  now: number,
): ActiveTabSnapshot {
  if (!tab.id || !isTrackableUrl(tab.url)) {
    return createEmptySnapshot();
  }

  return {
    tabId: tab.id,
    title: tab.title ?? '',
    url: tab.url,
    hostname: parseHostname(tab.url),
    focusStartedAt: now,
  };
}

export function endFocus(snapshot: ActiveTabSnapshot, now: number): {
  snapshot: ActiveTabSnapshot;
  activeDurationMs: number;
} {
  if (!snapshot.focusStartedAt || snapshot.tabId === null) {
    return { snapshot: createEmptySnapshot(), activeDurationMs: 0 };
  }

  const activeDurationMs = Math.max(0, now - snapshot.focusStartedAt);
  return {
    snapshot: createEmptySnapshot(),
    activeDurationMs,
  };
}

export function snapshotFromTab(
  tab: { id?: number; title?: string; url?: string },
  now: number,
): ActiveTabSnapshot {
  return beginFocus(createEmptySnapshot(), tab, now);
}
