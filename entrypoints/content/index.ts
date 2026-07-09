import { OVERLAY_TAB_MESSAGE } from '../../utils/active-overlay';
import { ignoreIfExtensionUnavailable } from '../../utils/extension-errors';
import { requestIsActiveOverlayTab } from '../../utils/runtime-client';
import type { TabbyOverlay } from './tabby-overlay';

type OverlayModule = typeof import('./tabby-overlay');

let overlayModule: OverlayModule | null = null;
let overlayInstance: TabbyOverlay | null = null;
let overlayPromise: Promise<TabbyOverlay> | null = null;

async function loadOverlayModule(): Promise<OverlayModule> {
  overlayModule ??= await import('./tabby-overlay');
  return overlayModule;
}

async function getOverlay(): Promise<TabbyOverlay> {
  if (overlayInstance) {
    return overlayInstance;
  }
  if (overlayPromise) {
    return overlayPromise;
  }

  overlayPromise = loadOverlayModule().then((mod) => {
    const globalWindow = window as unknown as Record<string, TabbyOverlay | undefined>;
    const existing = globalWindow[mod.OVERLAY_GLOBAL_KEY];
    if (existing) {
      existing.destroy();
      delete globalWindow[mod.OVERLAY_GLOBAL_KEY];
    }

    overlayInstance = new mod.TabbyOverlay();
    globalWindow[mod.OVERLAY_GLOBAL_KEY] = overlayInstance;
    return overlayInstance;
  });

  try {
    return await overlayPromise;
  } finally {
    overlayPromise = null;
  }
}

function shouldProbeActiveTab(): boolean {
  return document.visibilityState === 'visible';
}

function scheduleWarmActivate(): void {
  if (!shouldProbeActiveTab()) {
    return;
  }
  void requestIsActiveOverlayTab()
    .then(({ active }) => {
      if (active) {
        void getOverlay().then((overlay) => overlay.warmActivate());
      }
    })
    .catch((error) => ignoreIfExtensionUnavailable('warm activate probe', error));
}

export default defineContentScript({
  matches: ['<all_urls>'],
  excludeMatches: [
    '*://chrome.google.com/webstore/*',
    '*://chromewebstore.google.com/*',
  ],
  runAt: 'document_idle',
  // Manifest registration works without host_permissions (runtime registration does not).
  registration: 'manifest',

  main() {
    if (window.top !== window.self) {
      return;
    }

    // Inactive tabs stay idle — only visible focused tabs probe once.
    browser.runtime.onMessage.addListener((message) => {
      if (message?.type === 'ping') {
        return true;
      }
      if (message?.type === OVERLAY_TAB_MESSAGE.activate) {
        void getOverlay().then((overlay) => overlay.warmActivate());
        return;
      }
      if (message?.type === OVERLAY_TAB_MESSAGE.deactivate) {
        void getOverlay().then((overlay) => overlay.gracefulDeactivate());
      }
    });

    scheduleWarmActivate();
  },
});
