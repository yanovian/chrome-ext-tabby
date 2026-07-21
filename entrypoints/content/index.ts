import { OVERLAY_TAB_MESSAGE } from '../../utils/active-overlay';
import { ignoreIfExtensionUnavailable } from '../../utils/extension-errors';
import {
  isOverlayHostExcluded,
  overlayExcludeMatchPatterns,
} from '../../utils/overlay-excluded-hosts';
import { requestIsActiveOverlayTab } from '../../utils/runtime-client';
import type { TabbyOverlay } from './tabby-overlay';

type OverlayModule = typeof import('./tabby-overlay');

/** Dev-mode content-script reloads re-execute this file over the same page without a full
 * navigation, so a fresh closure's addListener would stack a second, stale listener on top of
 * the previous injection's — both then react to every message. Track the current one on
 * `window` (survives across injections, unlike this module's own locals) so a new injection
 * can remove its predecessor first. */
const MESSAGE_LISTENER_KEY = '__tabbyMessageListener';

type RuntimeMessageListener = (message: unknown) => boolean | void;

let overlayModule: OverlayModule | null = null;
let overlayInstance: TabbyOverlay | null = null;
let overlayPromise: Promise<TabbyOverlay> | null = null;

async function loadOverlayModule(): Promise<OverlayModule> {
  overlayModule ??= await import('./tabby-overlay');
  return overlayModule;
}

async function getOverlay(): Promise<TabbyOverlay | null> {
  if (isOverlayHostExcluded(location.hostname)) {
    return null;
  }
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
  if (!shouldProbeActiveTab() || isOverlayHostExcluded(location.hostname)) {
    return;
  }
  void requestIsActiveOverlayTab()
    .then(({ active }) => {
      if (active) {
        void getOverlay().then((overlay) => overlay?.warmActivate());
      }
    })
    .catch((error) => ignoreIfExtensionUnavailable('warm activate probe', error));
}

export default defineContentScript({
  matches: ['<all_urls>'],
  excludeMatches: overlayExcludeMatchPatterns(),
  runAt: 'document_idle',
  // Manifest registration works without host_permissions (runtime registration does not).
  registration: 'manifest',

  main() {
    if (window.top !== window.self) {
      return;
    }
    if (isOverlayHostExcluded(location.hostname)) {
      return;
    }

    const globalWindow = window as unknown as Record<string, RuntimeMessageListener | undefined>;
    const previousListener = globalWindow[MESSAGE_LISTENER_KEY];
    if (previousListener) {
      browser.runtime.onMessage.removeListener(previousListener);
    }

    // Inactive tabs stay idle — only visible focused tabs probe once.
    const onRuntimeMessage: RuntimeMessageListener = (message) => {
      const type = (message as { type?: string } | undefined)?.type;
      if (type === 'ping') {
        return true;
      }
      if (type === OVERLAY_TAB_MESSAGE.activate) {
        if (isOverlayHostExcluded(location.hostname)) {
          return;
        }
        void getOverlay().then((overlay) => overlay?.warmActivate());
        return;
      }
      if (type === OVERLAY_TAB_MESSAGE.deactivate) {
        void getOverlay().then((overlay) => overlay?.gracefulDeactivate());
      }
    };
    globalWindow[MESSAGE_LISTENER_KEY] = onRuntimeMessage;
    browser.runtime.onMessage.addListener(onRuntimeMessage);

    scheduleWarmActivate();
  },
});
