import { canShowOverlayOnUrl } from './overlay-inject';
import { ignoreIfExtensionUnavailable } from './extension-errors';

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
  } catch (error) {
    ignoreIfExtensionUnavailable('overlay deactivate', error);
  }
}

export async function notifyOverlayActivate(tabId: number): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await browser.tabs.sendMessage(tabId, {
        type: OVERLAY_TAB_MESSAGE.activate,
      } satisfies OverlayTabMessage);
      return;
    } catch (error) {
      if (attempt === 2) {
        ignoreIfExtensionUnavailable('overlay activate', error);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
}
