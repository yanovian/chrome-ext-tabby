import { canShowOverlayOnUrl } from './overlay-inject';

export const OVERLAY_TAB_MESSAGE = {
  activate: 'overlayActivate',
  deactivate: 'overlayDeactivate',
} as const;

export type OverlayTabMessage =
  | { type: typeof OVERLAY_TAB_MESSAGE.activate }
  | { type: typeof OVERLAY_TAB_MESSAGE.deactivate };

/** Pick which tab should host the floating cat right now. */
export function resolveActiveOverlayTabId(
  tab: { id?: number; url?: string } | undefined,
  showOverlay: boolean,
): number | null {
  if (!showOverlay || !tab?.id || !canShowOverlayOnUrl(tab.url)) {
    return null;
  }
  return tab.id;
}

export async function notifyOverlayDeactivate(tabId: number): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, {
      type: OVERLAY_TAB_MESSAGE.deactivate,
    } satisfies OverlayTabMessage);
  } catch {
    // Tab closed or content script unavailable.
  }
}

export async function notifyOverlayActivate(tabId: number): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, {
      type: OVERLAY_TAB_MESSAGE.activate,
    } satisfies OverlayTabMessage);
  } catch {
    // Page may still be loading; the content script checks on load.
  }
}
