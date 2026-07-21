import {
  notifyOverlayActivate,
  notifyOverlayDeactivate,
  resolveActiveOverlayTabId,
} from '../../utils/active-overlay';
import { getCurrentPresentation } from '../../utils/cat';
import { isPageOverlayHidden } from '../../utils/page-overlay';
import { getSettings } from '../../utils/settings';

const IS_DEV_BUILD = import.meta.env.DEV;

/** Tab that currently hosts the floating cat (at most one). */
let activeOverlayTabId: number | null = null;

/** Pick which tab (if any) should host the overlay right now, and message whichever tabs
 * need to activate or deactivate to make that true. The single place that decides this, so
 * "which tab shows the cat" can never end up true in two tabs at once. */
export async function syncOverlayToTab(
  tab: { id?: number; url?: string } | undefined,
): Promise<void> {
  const settings = await getSettings(IS_DEV_BUILD);
  const nextTabId = resolveActiveOverlayTabId(tab, settings.showOverlay);

  if (nextTabId === null) {
    await deactivateOverlayIfHosting();
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

/** If some tab currently hosts the overlay, tell it to deactivate and forget it did. Used
 * when a setting change (turning the overlay off) needs to hide her immediately without
 * going through the normal "which tab should host her" decision above. */
export async function deactivateOverlayIfHosting(): Promise<void> {
  if (activeOverlayTabId !== null) {
    await notifyOverlayDeactivate(activeOverlayTabId);
    activeOverlayTabId = null;
  }
}

export async function syncActiveTabOverlay(): Promise<void> {
  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  await syncOverlayToTab(activeTab);
}

/** Re-checks a few times after install/onboarding, since the very first sync can race the
 * content script's own initial activation before it's finished wiring up. */
export async function retryActiveOverlaySync(): Promise<void> {
  for (const delayMs of [400, 1200, 2500]) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await syncActiveTabOverlay();
  }
}
