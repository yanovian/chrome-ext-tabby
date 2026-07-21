import { mapInteractionToCareAction, type InteractionAction } from '../../utils/cat-interactions';
import { markIntroCompleted } from '../../utils/intro';
import { loadAppLocale } from '../../utils/i18n';
import { isCompanionOverlayVisible } from '../../utils/overlay-visibility';
import { patchPresentationForDevForce } from '../../utils/presentation';
import { isFeedingActive } from '../../utils/feeding-moment';
import { isPlayingActive } from '../../utils/play-moment';
import {
  COMPANION_EXIT_ANIMATION,
  COMPANION_EXIT_MS,
  OVERLAY_EXIT_CLASS,
  preloadCompanionSprite,
  shouldAnimateMoodTransition,
  waitForOverlayAnimation,
} from '../../utils/overlay-entrance';
import { isPageOverlayHidden } from '../../utils/page-overlay';
import {
  pingBackground,
  publicAnimationAssetUrl,
  requestCareAction,
  requestClearCompanionSpeech,
  requestPresentation,
  requestRecordInteraction,
  requestSettleAfterIntro,
  requestSettings,
} from '../../utils/runtime-client';
import { ignoreIfExtensionUnavailable } from '../../utils/extension-errors';
import type { CatPresentation, ExtensionSettings } from '../../utils/types';
import { isPeeking } from './overlay/peek-state';
import { OverlayPositioner } from './overlay/positioner';
import { OverlayTransitions } from './overlay/transitions';
import { IntroMenuController, type MenuBuildHandlers } from './overlay/intro-menu';
import { OverlaySync, createOverlaySyncHost } from './overlay/sync';
import { applyPresentationUpdate } from './overlay/presentation-update';
import { OutsideClickWatcher } from './overlay/outside-click';
import { ROOT_ID, buildRoot, patchRoot, playEntrance, type PatchOptions, type RenderContext } from './overlay/renderer';
import './style.css';

export const OVERLAY_GLOBAL_KEY = '__tabbyOverlayInstance';

export class TabbyOverlay {
  private presentation: CatPresentation | null = null;
  private pageOverlayHidden = false;
  private root: HTMLElement | null = null;
  /** True only for the one tab (in the focused window) the background has designated as overlay host. */
  private isCurrentOverlayTab = false;
  private showOverlayEnabled = true;
  private cachedSettings: ExtensionSettings | null = null;
  private exiting = false;
  private initPromise: Promise<void> | null = null;
  private mountGeneration = 0;
  private pendingReveal = false;

  private readonly positioner = new OverlayPositioner();
  private readonly transitions = new OverlayTransitions();
  private readonly introMenu = new IntroMenuController();
  private readonly outsideClick = new OutsideClickWatcher();
  private readonly sync: OverlaySync;

  private readonly onViewportChange = (): void => {
    this.applyPosition();
  };

  private readonly menuHandlers: MenuBuildHandlers = {
    onAdvanceIntro: () => this.advanceIntro(),
    onSkipIntro: () => void this.completeIntro(),
    onCloseMenu: () => this.closeMenu(),
    onToggleMore: () => {
      this.introMenu.toggleMoreOpen();
      this.render();
      if (this.introMenu.isMenuOpen()) {
        this.syncOutsideClickListener();
      }
    },
    onDismissSpeech: () => this.dismissSpeechBubble(),
    onAction: (action) => void this.handleInteraction(action),
  };

  constructor() {
    this.sync = new OverlaySync(
      createOverlaySyncHost({
        isCurrentOverlayTab: () => this.isCurrentOverlayTab,
        isShowOverlayEnabled: () => this.showOverlayEnabled,
        setShowOverlayEnabled: (enabled) => {
          this.showOverlayEnabled = enabled;
        },
        getPresentation: () => this.presentation,
        assignPresentation: (presentation) => this.assignPresentation(presentation),
        isMenuOpen: () => this.introMenu.isMenuOpen(),
        hasPendingAction: () => this.introMenu.getPendingAction() !== null,
        getCachedSettings: () => this.cachedSettings,
        setCachedSettings: (settings) => {
          this.cachedSettings = settings;
        },
        applyPresentationUpdate: (next) => this.applyPresentationUpdate(next),
        getRoot: () => this.root,
        render: (options) => this.render(options),
        syncPageOverlayHidden: () => this.syncPageOverlayHidden(),
        refreshPresentation: () => this.refreshPresentation(),
        teardownOverlay: () => this.teardownOverlay(),
        beginIntroIfNeeded: () => this.beginIntroIfNeeded(),
        isActiveInstance: () => this.isActiveInstance(),
        setIntroCompleted: (completed) => this.introMenu.setIntroCompleted(completed),
        syncOutsideClickListener: () => this.syncOutsideClickListener(),
        positioner: this.positioner,
        introMenu: this.introMenu,
      }),
    );
  }

  private isActiveInstance(): boolean {
    const globalWindow = window as unknown as Record<string, TabbyOverlay | undefined>;
    return globalWindow[OVERLAY_GLOBAL_KEY] === this;
  }

  /** Remove every overlay root node — guards against duplicate cats after re-inject or races. */
  private removeAllOverlayRoots(): void {
    for (const node of document.querySelectorAll(`#${ROOT_ID}`)) {
      node.remove();
    }
    if (this.root && !this.root.isConnected) {
      this.root = null;
    }
  }

  /** Re-fetch every piece of state from the background/storage. Used on first init and whenever
   * this tab regains overlay-host status, since state may have drifted while it was inactive
   * (the storage listener is suspended for inactive tabs — see initialize()). */
  private async resyncState(): Promise<void> {
    const settings = await requestSettings();
    this.cachedSettings = settings;
    if (!this.isActiveInstance()) {
      return;
    }
    await loadAppLocale(settings.locale);
    this.showOverlayEnabled = settings.showOverlay;

    if (!this.showOverlayEnabled) {
      this.teardownOverlay();
      return;
    }

    await this.positioner.load();
    if (!this.isActiveInstance()) {
      return;
    }
    await this.introMenu.load();
    if (!this.isActiveInstance()) {
      return;
    }
    await this.syncPageOverlayHidden();
    if (!this.isActiveInstance()) {
      return;
    }
    await this.refreshPresentation();
    if (!this.isActiveInstance()) {
      return;
    }
    this.beginIntroIfNeeded();
  }

  async initialize(): Promise<void> {
    await pingBackground();
    if (!this.isActiveInstance()) {
      return;
    }
    await this.resyncState();
    this.sync.bind(this.onViewportChange, () => this.removeOutsideClickListener());
  }

  /** Wake or refresh the overlay without tearing down UI state. */
  async warmActivate(): Promise<void> {
    if (!this.isActiveInstance()) {
      return;
    }
    // Only the tab the background just told us is the current host may show anything.
    const regainedHost = !this.isCurrentOverlayTab;
    this.isCurrentOverlayTab = true;

    if (!this.sync.isBound()) {
      this.initPromise ??= this.initialize().finally(() => {
        this.initPromise = null;
      });
      await this.initPromise;
      return;
    }

    // While inactive, storage updates were ignored, so presentation may be stale — and the
    // exit animation's teardown can still be pending, since browsers throttle timers/animations
    // in hidden tabs. Always resync on regaining host status rather than trusting
    // root.isConnected as a freshness signal.
    if (regainedHost || !this.root?.isConnected) {
      await this.resyncState();
      return;
    }

    if (!this.isOverlayVisible()) {
      void this.exitOverlay();
    }
  }

  private async syncPageOverlayHidden(): Promise<void> {
    this.pageOverlayHidden = await isPageOverlayHidden(location.href);
  }

  private teardownOverlay(): void {
    this.exiting = false;
    this.removeOutsideClickListener();
    this.transitions.destroyPlayer();
    this.removeAllOverlayRoots();
    this.root = null;
  }

  /** Tear down UI and timers when the script is replaced during dev reload. */
  destroy(): void {
    this.sync.unbind(this.onViewportChange);
    this.teardownOverlay();
    this.presentation = null;
    this.introMenu.resetMenuAndSpeechState();
    this.isCurrentOverlayTab = false;
  }

  /** Play the exit animation before tearing down (tab switch or hide). */
  async gracefulDeactivate(): Promise<void> {
    if (!this.isActiveInstance()) {
      return;
    }
    this.isCurrentOverlayTab = false;
    if (this.root?.isConnected && !this.exiting) {
      // Same reset closeMenu() does: without it, whichever button was highlighted before
      // this tab lost focus reappears as "active" the next time the menu reopens here,
      // even though the user never touched it this time around.
      this.introMenu.resetMenuAndSpeechState();
      this.removeOutsideClickListener();
      await this.exitOverlay(true);
      return;
    }
    this.destroy();
  }

  private isOverlayVisible(): boolean {
    return isCompanionOverlayVisible({
      showOverlayEnabled: this.showOverlayEnabled,
      presentation: this.presentation,
      pageOverlayHidden: this.pageOverlayHidden,
    });
  }

  private settlePresentation(presentation: CatPresentation): CatPresentation {
    if (!this.cachedSettings) {
      return presentation;
    }
    return patchPresentationForDevForce(presentation, this.cachedSettings);
  }

  private assignPresentation(presentation: CatPresentation): CatPresentation {
    const settled = this.settlePresentation(presentation);
    this.presentation = settled;
    return settled;
  }

  /** See overlay/presentation-update.ts for what this actually does — kept there since it's
   * one cohesive "settle it, then figure out peek/menu/speech-bubble state" sequence rather
   * than coordinator wiring. */
  private applyPresentationUpdate(next: CatPresentation): void {
    applyPresentationUpdate(next, {
      getPresentation: () => this.presentation,
      setPresentation: (presentation) => {
        this.presentation = presentation;
      },
      settlePresentation: (presentation) => this.settlePresentation(presentation),
      positioner: this.positioner,
      introMenu: this.introMenu,
      syncOutsideClickListener: () => this.syncOutsideClickListener(),
      render: (options) => this.render(options),
      isOverlayVisible: () => this.isOverlayVisible(),
      beginIntroIfNeeded: () => this.beginIntroIfNeeded(),
      getRoot: () => this.root,
    });
  }

  private async refreshPresentation(): Promise<void> {
    if (!this.cachedSettings) {
      this.cachedSettings = await requestSettings();
    }
    const fetched = await requestPresentation();
    if (fetched) {
      await preloadCompanionSprite(publicAnimationAssetUrl, fetched.sprite);
    }
    if (!this.isActiveInstance()) {
      return;
    }

    if (!fetched) {
      this.presentation = null;
      this.render();
      return;
    }

    this.applyPresentationUpdate(fetched);
  }

  private isCareMoment(presentation = this.presentation): boolean {
    const now = Date.now();
    return (
      isFeedingActive(presentation?.eatingUntil ?? null, now) ||
      isPlayingActive(presentation?.playingUntil ?? null, now)
    );
  }

  private hasOverlayChrome(): boolean {
    return !isPeeking(this.presentation) && this.introMenu.hasChrome(this.presentation);
  }

  private syncOutsideClickListener(): void {
    if (this.hasOverlayChrome()) {
      this.bindOutsideClickListener();
    } else {
      this.removeOutsideClickListener();
    }
  }

  private beginIntroIfNeeded(): void {
    if (this.introMenu.isIntroCompleted() || !this.isOverlayVisible()) {
      return;
    }
    this.introMenu.startIntro();
    this.render({ animateMenu: true });
    this.bindOutsideClickListener();
  }

  private async completeIntro(): Promise<void> {
    this.introMenu.beginCompleting();
    this.removeOutsideClickListener();

    await markIntroCompleted();
    this.presentation = await requestSettleAfterIntro();
    this.syncOutsideClickListener();
    this.render();
  }

  private advanceIntro(): void {
    const result = this.introMenu.advanceIntroStep();
    if (result === 'complete') {
      void this.completeIntro();
      return;
    }
    if (result === 'advanced') {
      this.render();
    }
  }

  private closeMenu(): void {
    if (!this.introMenu.closeMenuState()) {
      return;
    }
    this.pingInteraction();
    void this.dismissCompanionSpeech();
  }

  private openMenu(): void {
    if (!this.introMenu.openMenuState(this.isCareMoment())) {
      return;
    }
    this.pingInteraction();
    this.render();
    this.syncOutsideClickListener();
  }

  /** Opening/closing the menu counts as an interaction even without a care action, so
   * automatic ambient behavior (peek, rest) waits the same settle period it would after
   * an actual pet/play/ask. Fire and forget: nothing on screen depends on this resolving. */
  private pingInteraction(): void {
    void requestRecordInteraction().catch((error) =>
      ignoreIfExtensionUnavailable('record interaction', error),
    );
  }

  private dismissSpeechBubble(): void {
    void this.dismissCompanionSpeech();
  }

  private async dismissCompanionSpeech(): Promise<void> {
    this.introMenu.setSpeechBubbleOpen(false);
    this.presentation = await requestClearCompanionSpeech();
    this.syncOutsideClickListener();
    this.render();
  }

  private bindOutsideClickListener(): void {
    this.outsideClick.bind(
      () => this.root,
      () => {
        if (this.introMenu.isMenuOpen()) {
          this.closeMenu();
        } else if (this.introMenu.isSpeechBubbleOpen()) {
          this.dismissSpeechBubble();
        }
      },
    );
  }

  private removeOutsideClickListener(): void {
    this.outsideClick.unbind();
  }

  /** Builds the shared render/build inputs for renderer.ts. onTap is captured against
   * whatever presentation this render pass is for — buildRoot only runs on a fresh mount, so
   * the tap handler it attaches keeps referencing that mount's presentation for its
   * isCareMoment check until the next full remount, same as before this file was split. */
  private renderContext(presentationForTap: CatPresentation): RenderContext {
    return {
      positioner: this.positioner,
      transitions: this.transitions,
      introMenu: this.introMenu,
      hasOverlayChrome: this.hasOverlayChrome(),
      isIntroActive: this.introMenu.isIntroActive(),
      isCareMoment: this.isCareMoment(),
      menuHandlers: this.menuHandlers,
      getPresentation: () => this.presentation,
      onTap: this.makeTapHandler(presentationForTap),
    };
  }

  private makeTapHandler(mountedPresentation: CatPresentation): () => void {
    return () => {
      if (this.introMenu.isIntroActive()) {
        return;
      }
      if (isPeeking(this.presentation)) {
        void this.revealFromPeek();
        return;
      }
      if (this.isCareMoment(mountedPresentation)) {
        return;
      }
      if (this.introMenu.isMenuOpen()) {
        this.closeMenu();
      } else {
        this.openMenu();
      }
    };
  }

  private render(options: PatchOptions = {}): void {
    if (!this.isActiveInstance()) {
      return;
    }

    // Defensive backstop: never mount/keep DOM in a tab that isn't the current overlay host.
    if (!this.isCurrentOverlayTab) {
      this.removeOutsideClickListener();
      if (this.root?.isConnected && !this.exiting) {
        void this.exitOverlay(true);
      } else if (!this.root?.isConnected) {
        this.teardownOverlay();
      }
      return;
    }

    if (!this.isOverlayVisible()) {
      this.removeOutsideClickListener();
      if (this.root?.isConnected && !this.exiting) {
        void this.exitOverlay();
      } else if (!this.root?.isConnected) {
        this.teardownOverlay();
      }
      return;
    }

    if (this.presentation) {
      this.presentation = this.settlePresentation(this.presentation);
    }

    if (this.root?.isConnected) {
      for (const node of document.querySelectorAll(`#${ROOT_ID}`)) {
        if (node !== this.root) {
          node.remove();
        }
      }
      patchRoot(this.root, this.presentation!, options, this.renderContext(this.presentation!));
      this.applyPosition();
      if (this.hasOverlayChrome()) {
        requestAnimationFrame(() => this.applyPosition());
      }
      return;
    }

    this.removeAllOverlayRoots();
    const generation = ++this.mountGeneration;
    void this.mountOverlay(options, generation);
  }

  private async mountOverlay(options: PatchOptions = {}, generation: number): Promise<void> {
    const presentation = this.presentation;
    if (!presentation || !this.isActiveInstance()) {
      return;
    }

    const root = await buildRoot(
      presentation,
      { animateMenu: options.animateMenu ?? this.hasOverlayChrome() },
      this.renderContext(presentation),
    );
    if (generation !== this.mountGeneration || !this.isActiveInstance() || !this.isOverlayVisible()) {
      return;
    }

    this.removeAllOverlayRoots();
    this.root = root;
    document.documentElement.appendChild(this.root);
    this.applyPosition();
    if (this.introMenu.isMenuOpen()) {
      requestAnimationFrame(() => this.applyPosition());
    }
    playEntrance(this.root);

    if (options.reactToTrigger) {
      this.transitions.animateCatReaction();
    }
  }

  private async exitOverlay(force = false): Promise<void> {
    if (!this.root?.isConnected || this.exiting) {
      return;
    }

    this.exiting = true;
    this.root.classList.add(OVERLAY_EXIT_CLASS);
    const playedPeekDuck = await this.transitions.playPeekDuckExit(this.presentation);
    if (!playedPeekDuck) {
      await waitForOverlayAnimation(this.root, COMPANION_EXIT_ANIMATION, COMPANION_EXIT_MS);
    }

    if (!this.isActiveInstance()) {
      return;
    }

    this.exiting = false;
    if (force || !this.isOverlayVisible()) {
      this.teardownOverlay();
    }
  }

  private async revealFromPeek(): Promise<void> {
    if (!isPeeking(this.presentation) || this.pendingReveal) {
      return;
    }

    this.pendingReveal = true;
    try {
      const next = await requestCareAction('reveal', location.href);
      // Restore the saved (pre-peek) position before applyPresentationUpdate's render, or
      // it would render one frame at the peek-edge position first.
      await this.positioner.restorePeekSavedPosition();
      this.applyPresentationUpdate(next);
    } catch (error) {
      ignoreIfExtensionUnavailable('reveal from peek', error);
    } finally {
      this.pendingReveal = false;
    }
  }

  private applyPosition(): void {
    if (!this.root || !this.presentation) {
      return;
    }
    this.positioner.apply(this.root, this.presentation, this.hasOverlayChrome());
  }

  private async handleInteraction(action: InteractionAction): Promise<void> {
    if (this.introMenu.getPendingAction()) {
      return;
    }

    this.introMenu.setPendingAction(action);
    const previousSprite = this.presentation?.sprite ?? null;
    this.render();

    try {
      const careAction = mapInteractionToCareAction(action);
      const next = this.assignPresentation(await requestCareAction(careAction, location.href));
      if (this.introMenu.syncForCareMoment(next)) {
        this.syncOutsideClickListener();
      }
      this.introMenu.setHighlightedAction(action);

      if (action === 'dismiss') {
        await this.syncPageOverlayHidden();
        this.introMenu.dismissMenuAndSpeech();
        this.removeOutsideClickListener();
      } else if (action === 'dnd_30' || action === 'dnd_60' || action === 'dnd_today' || action === 'shoo') {
        this.introMenu.closeMenuAfterAction();
        this.syncOutsideClickListener();
      }
    } finally {
      this.introMenu.setPendingAction(null);
      this.render({
        animateMood: shouldAnimateMoodTransition({
          previousSprite,
          nextSprite: this.presentation?.sprite ?? previousSprite ?? '',
          hasVisibleOverlay: Boolean(this.root?.isConnected),
        }),
        animateMenu: this.introMenu.isSpeechBubbleOpen() && !this.introMenu.isMenuOpen(),
      });

      if (this.introMenu.isMenuOpen() && action !== 'dismiss' && !this.isCareMoment()) {
        this.bindOutsideClickListener();
      }
    }
  }
}
