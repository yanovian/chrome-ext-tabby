/**
 * Browser-extension glue built on top of utils/cat.ts (the single source of truth for what
 * Tabby looks like and the one reducer that changes it). Everything here is genuinely about
 * the browser, not about the cat: scoring page dwell time into vitals, the minute-tick alarm
 * handler, per-page overlay-hidden tracking, and do-not-disturb wrappers.
 */
import { applyMinuteTick, applyVisitToVitals, resetDailyNudgeCounter } from './cat-sim';
import {
  clearDoNotDisturb,
  clearExpiredDoNotDisturb,
  doNotDisturbDurationToCareAction,
  isDoNotDisturbActive,
} from './do-not-disturb';
import { appendObservation, saveCatState } from './db';
import { hidePageOverlay, isPageOverlayHidden, pageOverlayKey } from './page-overlay';
import { effectiveAppearanceLimits, getSettings } from './settings';
import { registerVisit } from './visit-dedup';
import {
  evaluateAndPresent,
  getCurrentPresentation,
  handleCareAction,
  loadOrchestratorState,
  readCachedPresentation,
  reduceCat,
  type OrchestratorState,
  type PageContext,
} from './cat';
import type { CatPresentation, DoNotDisturbDuration, ExtensionSettings, PageOverlayState } from './types';
import { STORAGE_KEYS } from './types';

const IS_DEV_BUILD = import.meta.env.DEV;

export type { OrchestratorState, PageContext };

async function loadRecentVisitKeys(): Promise<string[]> {
  const result = await browser.storage.local.get([STORAGE_KEYS.recentVisitKeys]);
  const raw = result[STORAGE_KEYS.recentVisitKeys];
  return Array.isArray(raw) ? (raw as string[]) : [];
}

async function saveRecentVisitKeys(keys: string[]): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.recentVisitKeys]: keys });
}

/** Score the active page after 1+ minute dwell, once per focus, if not in recent-10 dedup. */
export async function recordPageVisit(input: {
  title: string;
  url: string;
  hostname: string;
  activeDurationMs: number;
  now: number;
}): Promise<{ state: OrchestratorState; counted: boolean }> {
  const state = await loadOrchestratorState();
  const recentKeys = await loadRecentVisitKeys();
  const visit = registerVisit(input.url, recentKeys);

  if (!visit.counted) {
    return { state, counted: false };
  }

  await saveRecentVisitKeys(visit.recentKeys);

  const { statMultiplier } = effectiveAppearanceLimits(state.settings);

  const observation = await appendObservation({
    observedAt: input.now,
    title: input.title,
    url: input.url,
    hostname: input.hostname,
    activeDurationMs: input.activeDurationMs,
  });

  let cat = resetDailyNudgeCounter(state.cat, input.now);
  if (observation.category) {
    cat = {
      ...cat,
      vitals: applyVisitToVitals(cat.vitals, {
        category: observation.category,
        statMultiplier,
      }),
    };
  }

  await saveCatState(cat);
  return { state: { ...state, cat }, counted: true };
}

/** @deprecated Use recordPageVisit — kept as an alias for tests. */
export const recordBrowsingSession = recordPageVisit;

export async function runMinuteTick(
  now: number,
  options: {
    forceDevSpeech?: boolean;
    forceTick?: boolean;
    page?: PageContext;
    /** When false, only update vitals — presentation waits for the active tab. */
    present?: boolean;
  } = {},
): Promise<OrchestratorState> {
  const state = await loadOrchestratorState();
  const cat = resetDailyNudgeCounter(state.cat, now);
  const vitals = applyMinuteTick(cat.vitals, {
    cat,
    now,
    settings: state.settings,
    isUserIdle: state.isUserIdle,
  });

  const nextCat = { ...cat, vitals };
  await saveCatState(nextCat);
  const nextState = { ...state, cat: nextCat };
  if (options.present === false) {
    return nextState;
  }
  // nextCat is already persisted above, so reduceCat's own fresh state load picks it up —
  // no need to thread this specific state object through.
  return reduceCat({ type: 'tick', now, ...options });
}

export async function hideOverlayOnPage(page: PageContext = {}): Promise<CatPresentation> {
  await hidePageOverlay(page.url);
  return getCurrentPresentation();
}

export async function getPageOverlayState(
  url: string | undefined,
  settings?: ExtensionSettings,
): Promise<PageOverlayState> {
  const resolved = settings ?? (await getSettings(IS_DEV_BUILD));
  if (!resolved.showOverlay || !pageOverlayKey(url)) {
    return { applicable: false, visible: false };
  }
  const hidden = await isPageOverlayHidden(url);
  const presentation = await readCachedPresentation();
  const now = Date.now();
  const doNotDisturb = await clearExpiredDoNotDisturb(now);
  let companionVisible = presentation?.companionVisible ?? false;
  if (isDoNotDisturbActive(doNotDisturb, now)) {
    companionVisible = false;
  }
  return { applicable: true, visible: !hidden && companionVisible };
}

export async function cancelDoNotDisturb(now: number): Promise<CatPresentation> {
  await clearDoNotDisturb();
  const cached = await readCachedPresentation();
  if (cached) {
    return cached;
  }

  const result = await evaluateAndPresent(now);
  return result.lastPresentation!;
}

export async function enableDoNotDisturb(
  duration: DoNotDisturbDuration,
  now: number,
): Promise<CatPresentation> {
  return handleCareAction(doNotDisturbDurationToCareAction(duration), now);
}
