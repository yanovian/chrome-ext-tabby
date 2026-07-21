import { applyNodeLocale, loadAppLocale } from '../../../utils/i18n';
import { isDevMoodForced } from '../../../utils/settings';
import { requestSettings } from '../../../utils/runtime-client';
import type { CatPresentation, ExtensionSettings } from '../../../utils/types';
import { STORAGE_KEYS } from '../../../utils/types';
import type { OverlayPositioner } from './positioner';
import type { IntroMenuController } from './intro-menu';

/** The coordinator operations the storage-change reaction needs. Kept as callback methods
 * (not raw field access) because every branch here also has side effects — re-rendering,
 * settling a presentation, tearing down — that the coordinator (and its other collaborators)
 * own, not this listener. */
export interface OverlaySyncHost {
  isCurrentOverlayTab(): boolean;
  isShowOverlayEnabled(): boolean;
  getPresentation(): CatPresentation | null;
  isMenuOpen(): boolean;
  hasPendingAction(): boolean;
  getCachedSettings(): ExtensionSettings | null;
  setCachedSettings(settings: ExtensionSettings): void;
  applyPresentationUpdate(next: CatPresentation): void;
  syncPageOverlayHiddenAndRender(): void;
  finishLocaleChange(): void;
  applyDevForcedPresentation(): void;
  applyShowOverlaySetting(enabled: boolean): void;
  applyIntroCompletedChange(completed: boolean): void;
}

type StorageChangeListener = Parameters<typeof browser.storage.onChanged.addListener>[0];
type StorageChanges = Parameters<StorageChangeListener>[0];

function handlePresentationChange(changes: StorageChanges, host: OverlaySyncHost): void {
  if (!host.isShowOverlayEnabled()) {
    return;
  }
  const next = changes.presentation?.newValue as CatPresentation | undefined;
  // Ambient peeking runs on its own timer in the background and would otherwise duck the cat
  // out from under an open care menu. Suppress just that transition; closing the menu re-syncs
  // to whatever the real state is by then.
  const entersPeekWhileMenuOpen =
    host.isMenuOpen() && next?.mood === 'peek' && host.getPresentation()?.mood !== 'peek';
  if (!next || entersPeekWhileMenuOpen) {
    return;
  }
  const cachedSettings = host.getCachedSettings();
  if (host.hasPendingAction() && !cachedSettings?.devModeEnabled) {
    return;
  }
  if (!cachedSettings) {
    void requestSettings().then((settings) => {
      host.setCachedSettings(settings);
      host.applyPresentationUpdate(next);
    });
    return;
  }
  host.applyPresentationUpdate(next);
}

function handleSettingsChange(changes: StorageChanges, host: OverlaySyncHost): void {
  const next = changes[STORAGE_KEYS.settings]?.newValue as ExtensionSettings | undefined;
  const prev = changes[STORAGE_KEYS.settings]?.oldValue as ExtensionSettings | undefined;
  if (!next) {
    return;
  }
  host.setCachedSettings(next);

  if (prev?.locale !== next.locale) {
    void loadAppLocale(next.locale).then(() => host.finishLocaleChange());
  }

  const devForced = isDevMoodForced(next);
  const devMoodChanged = devForced && prev?.devForceMood !== next.devForceMood;
  const devModeEnabledWithForce = devForced && prev?.devModeEnabled !== true;
  if (devMoodChanged || devModeEnabledWithForce) {
    host.applyDevForcedPresentation();
    return;
  }

  host.applyShowOverlaySetting(next.showOverlay);
}

function handleIntroCompletedChange(changes: StorageChanges, host: OverlaySyncHost): void {
  if (!host.isShowOverlayEnabled()) {
    return;
  }
  const nextCompleted = changes[STORAGE_KEYS.introCompleted]?.newValue === true;
  host.applyIntroCompletedChange(nextCompleted);
}

/** Builds the browser.storage.onChanged listener. Only the tab currently designated as
 * overlay host reacts — otherwise every window that ever hosted the cat would re-render (and
 * re-show its speech bubble) in lockstep, even while unfocused. Reactivation triggers a full
 * resync elsewhere instead. */
export function createStorageChangeListener(host: OverlaySyncHost): StorageChangeListener {
  return (changes, area) => {
    if (area !== 'local' || !host.isCurrentOverlayTab()) {
      return;
    }
    if ('presentation' in changes) {
      handlePresentationChange(changes, host);
    }
    if (STORAGE_KEYS.hiddenPageKeys in changes) {
      if (host.isShowOverlayEnabled()) {
        host.syncPageOverlayHiddenAndRender();
      }
    }
    if (STORAGE_KEYS.settings in changes) {
      handleSettingsChange(changes, host);
    }
    if (STORAGE_KEYS.introCompleted in changes) {
      handleIntroCompletedChange(changes, host);
    }
  };
}

/** Wires the storage listener plus the viewport/pagehide listeners that keep the overlay
 * positioned and cleaned up. A thin class only because it needs to remember its bound
 * listener reference to remove the same one later. */
export class OverlaySync {
  private bound = false;
  private readonly listener: StorageChangeListener;

  constructor(host: OverlaySyncHost) {
    this.listener = createStorageChangeListener(host);
  }

  isBound(): boolean {
    return this.bound;
  }

  bind(onViewportChange: () => void, onPagehide: () => void): void {
    if (this.bound) {
      return;
    }
    this.bound = true;
    browser.storage.onChanged.addListener(this.listener);
    window.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('scroll', onViewportChange);
    window.addEventListener('pagehide', onPagehide);
  }

  unbind(onViewportChange: () => void): void {
    browser.storage.onChanged.removeListener(this.listener);
    this.bound = false;
    window.removeEventListener('resize', onViewportChange);
    window.visualViewport?.removeEventListener('resize', onViewportChange);
    window.visualViewport?.removeEventListener('scroll', onViewportChange);
  }
}

/** The coordinator primitives createOverlaySyncHost() needs to assemble an OverlaySyncHost.
 * Kept separate from OverlaySyncHost itself since a couple of host methods (the dev-forced
 * presentation and show-overlay-setting reactions) are small orchestration sequences of their
 * own, not single field accesses — building them here (instead of inline on the coordinator)
 * is what actually keeps tabby-overlay.ts down to wiring rather than every reaction's logic. */
export interface OverlaySyncCallbacks {
  isCurrentOverlayTab: () => boolean;
  isShowOverlayEnabled: () => boolean;
  setShowOverlayEnabled: (enabled: boolean) => void;
  getPresentation: () => CatPresentation | null;
  assignPresentation: (presentation: CatPresentation) => CatPresentation;
  isMenuOpen: () => boolean;
  hasPendingAction: () => boolean;
  getCachedSettings: () => ExtensionSettings | null;
  setCachedSettings: (settings: ExtensionSettings) => void;
  applyPresentationUpdate: (next: CatPresentation) => void;
  getRoot: () => HTMLElement | null;
  render: (options?: { animateMood?: boolean }) => void;
  syncPageOverlayHidden: () => Promise<void>;
  refreshPresentation: () => Promise<void>;
  teardownOverlay: () => void;
  beginIntroIfNeeded: () => void;
  isActiveInstance: () => boolean;
  setIntroCompleted: (completed: boolean) => void;
  syncOutsideClickListener: () => void;
  positioner: OverlayPositioner;
  introMenu: IntroMenuController;
}

export function createOverlaySyncHost(callbacks: OverlaySyncCallbacks): OverlaySyncHost {
  return {
    isCurrentOverlayTab: callbacks.isCurrentOverlayTab,
    isShowOverlayEnabled: callbacks.isShowOverlayEnabled,
    getPresentation: callbacks.getPresentation,
    isMenuOpen: callbacks.isMenuOpen,
    hasPendingAction: callbacks.hasPendingAction,
    getCachedSettings: callbacks.getCachedSettings,
    setCachedSettings: callbacks.setCachedSettings,
    applyPresentationUpdate: callbacks.applyPresentationUpdate,
    syncPageOverlayHiddenAndRender: () => {
      void callbacks.syncPageOverlayHidden().then(() => callbacks.render());
    },
    finishLocaleChange: () => {
      const root = callbacks.getRoot();
      if (root) {
        applyNodeLocale(root);
      }
      callbacks.render();
    },
    applyDevForcedPresentation: () => {
      const presentation = callbacks.getPresentation();
      if (!presentation) {
        void callbacks.refreshPresentation();
        return;
      }
      const settled = callbacks.assignPresentation(presentation);
      callbacks.positioner.resetPeekTransition(settled.mood === 'peek');
      if (callbacks.introMenu.syncForPeek(settled)) {
        callbacks.syncOutsideClickListener();
      }
      callbacks.render({ animateMood: true });
    },
    applyShowOverlaySetting: (enabled) => {
      callbacks.setShowOverlayEnabled(enabled);
      if (!enabled) {
        callbacks.teardownOverlay();
        return;
      }
      void (async () => {
        await callbacks.syncPageOverlayHidden();
        if (!callbacks.getPresentation()) {
          await callbacks.refreshPresentation();
        }
        callbacks.render();
      })();
    },
    applyIntroCompletedChange: (completed) => {
      callbacks.setIntroCompleted(completed);
      if (!completed) {
        void callbacks.refreshPresentation().then(() => {
          if (callbacks.isActiveInstance()) {
            callbacks.beginIntroIfNeeded();
          }
        });
      }
    },
  };
}
