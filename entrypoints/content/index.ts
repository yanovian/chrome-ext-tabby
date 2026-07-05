import { extractPageTextSnippet } from '../../utils/page-text';
import {
  mapInteractionToCareAction,
  type InteractionAction,
} from '../../utils/cat-interactions';
import {
  INTRO_SKIP_LABEL,
  introNextLabel,
  introStepCount,
  introStepText,
  isIntroCompleted,
  markIntroCompleted,
} from '../../utils/intro';
import { isPageOverlayHidden } from '../../utils/page-overlay';
import {
  CAT_DISPLAY_SIZE,
  defaultOverlayPosition,
  clampOverlayPosition,
  isDefaultOverlayPosition,
  resolveAnchoredPosition,
  resolveMenuLayout,
} from '../../utils/overlay-position';
import {
  pingBackground,
  publicAssetUrl,
  requestCareAction,
  requestPresentation,
  requestSettings,
} from '../../utils/runtime-client';
import type { CatPresentation, ExtensionSettings, OverlayPosition } from '../../utils/types';
import { STORAGE_KEYS } from '../../utils/types';
import './style.css';

const ROOT_ID = 'tabby-companion-root';
const GLOBAL_KEY = '__tabbyOverlayInstance';
const DRAG_THRESHOLD_PX = 4;

class TabbyOverlay {
  private presentation: CatPresentation | null = null;
  private pageOverlayHidden = false;
  private menuOpen = false;
  private moreOpen = false;
  private pendingAction: InteractionAction | null = null;
  private introCompleted = true;
  private introStep: number | null = null;
  private position: OverlayPosition = defaultOverlayPosition();
  private pageTextInterval: ReturnType<typeof setInterval> | null = null;
  private root: HTMLElement | null = null;
  private outsideClickListener: ((event: Event) => void) | null = null;
  private storageListenerBound = false;
  private showOverlayEnabled = true;

  private isActiveInstance(): boolean {
    const globalWindow = window as unknown as Record<string, TabbyOverlay | undefined>;
    return globalWindow[GLOBAL_KEY] === this;
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

  async initialize(): Promise<void> {
    await pingBackground();
    if (!this.isActiveInstance()) {
      return;
    }
    const settings = await requestSettings();
    if (!this.isActiveInstance()) {
      return;
    }
    this.showOverlayEnabled = settings.showOverlay;

    if (!this.showOverlayEnabled) {
      this.teardownOverlay();
      this.bindStorageListenerIfNeeded();
      return;
    }

    await this.loadPosition();
    if (!this.isActiveInstance()) {
      return;
    }
    await this.loadIntroState();
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

    if (settings.readPageContent && !this.pageTextInterval) {
      await this.reportPageText(settings.pageTextMaxChars);
      this.pageTextInterval = setInterval(() => {
        void this.reportPageText(settings.pageTextMaxChars);
      }, 30_000);
    }

    if (this.storageListenerBound) {
      return;
    }
    this.bindStorageListenerIfNeeded();
  }

  private bindStorageListenerIfNeeded(): void {
    if (this.storageListenerBound) {
      return;
    }
    this.storageListenerBound = true;

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') {
        return;
      }
      if ('presentation' in changes) {
        if (!this.showOverlayEnabled) {
          return;
        }
        const next = changes.presentation?.newValue as CatPresentation | undefined;
        if (next && !this.pendingAction) {
          const previousSpeech = this.presentation?.speech ?? null;
          this.presentation = next;
          if (next.speech && next.triggerKind && next.speech !== previousSpeech) {
            this.menuOpen = true;
            this.bindOutsideClickListener();
          } else {
            this.menuOpen = false;
            this.moreOpen = false;
            this.removeOutsideClickListener();
          }
          this.render();
        }
      }
      if (STORAGE_KEYS.hiddenPageKeys in changes) {
        if (!this.showOverlayEnabled) {
          return;
        }
        void this.syncPageOverlayHidden().then(() => this.render());
      }
      if (STORAGE_KEYS.settings in changes) {
        const next = changes[STORAGE_KEYS.settings]?.newValue as ExtensionSettings | undefined;
        if (!next) {
          return;
        }
        this.showOverlayEnabled = next.showOverlay;
        if (!next.showOverlay) {
          this.teardownOverlay();
        } else {
          void (async () => {
            await this.syncPageOverlayHidden();
            if (!this.presentation) {
              await this.refreshPresentation();
            }
            this.render();
          })();
        }
      }
      if (STORAGE_KEYS.introCompleted in changes) {
        if (!this.showOverlayEnabled) {
          return;
        }
        const completed = changes[STORAGE_KEYS.introCompleted]?.newValue === true;
        this.introCompleted = completed;
        if (!completed) {
          this.introStep = 0;
          this.menuOpen = true;
          this.render();
          this.bindOutsideClickListener();
        }
      }
    });

    window.addEventListener('resize', () => {
      this.applyPosition();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.syncPresentationWhenVisible();
      }
    });

    window.addEventListener('pagehide', () => {
      this.removeOutsideClickListener();
      if (this.pageTextInterval) {
        clearInterval(this.pageTextInterval);
      }
    });
  }

  private async syncPageOverlayHidden(): Promise<void> {
    this.pageOverlayHidden = await isPageOverlayHidden(location.href);
  }

  private teardownOverlay(): void {
    this.removeOutsideClickListener();
    if (this.pageTextInterval) {
      clearInterval(this.pageTextInterval);
      this.pageTextInterval = null;
    }
    this.removeAllOverlayRoots();
    this.root = null;
  }

  /** Tear down UI and timers when the script is replaced during dev reload. */
  destroy(): void {
    this.teardownOverlay();
    this.presentation = null;
    this.pendingAction = null;
    this.menuOpen = false;
    this.moreOpen = false;
  }

  private isOverlayVisible(): boolean {
    return (
      this.showOverlayEnabled && !!this.presentation && !this.pageOverlayHidden
    );
  }

  private async loadPosition(): Promise<void> {
    const stored = await browser.storage.local.get([STORAGE_KEYS.overlayPosition]);
    const saved = stored[STORAGE_KEYS.overlayPosition] as OverlayPosition | undefined;
    this.position = saved ?? defaultOverlayPosition();
  }

  private async savePosition(): Promise<void> {
    await browser.storage.local.set({
      [STORAGE_KEYS.overlayPosition]: this.position,
    });
  }

  private async refreshPresentation(): Promise<void> {
    this.presentation = await requestPresentation();
    this.render();
  }

  /** Re-fetch the global cat when this tab becomes visible (background tabs miss storage events). */
  private async syncPresentationWhenVisible(): Promise<void> {
    if (!this.isActiveInstance() || !this.showOverlayEnabled || this.pendingAction) {
      return;
    }

    try {
      const next = await requestPresentation();
      if (!this.isActiveInstance() || this.pendingAction) {
        return;
      }
      this.presentation = next;
      this.menuOpen = false;
      this.moreOpen = false;
      this.removeOutsideClickListener();
      this.render();
    } catch {
      // Background may be asleep.
    }
  }

  private async reportPageText(maxChars: number): Promise<void> {
    const snippet = extractPageTextSnippet(maxChars);
    await browser.runtime.sendMessage({
      type: 'observeTab',
      observation: {
        observedAt: Date.now(),
        title: document.title,
        url: location.href,
        hostname: location.hostname,
        pageTextSnippet: snippet,
        activeDurationMs: 0,
      },
    });
  }

  private async loadIntroState(): Promise<void> {
    this.introCompleted = await isIntroCompleted();
  }

  private isIntroActive(): boolean {
    return !this.introCompleted && this.introStep !== null;
  }

  private beginIntroIfNeeded(): void {
    if (this.introCompleted || !this.isOverlayVisible()) {
      return;
    }
    this.introStep = 0;
    this.menuOpen = true;
    this.render();
    this.bindOutsideClickListener();
  }

  private async completeIntro(): Promise<void> {
    await markIntroCompleted();
    this.introCompleted = true;
    this.introStep = null;
    this.menuOpen = false;
    this.moreOpen = false;
    this.removeOutsideClickListener();
    this.render();
  }

  private advanceIntro(): void {
    if (this.introStep === null) {
      return;
    }
    if (this.introStep >= introStepCount() - 1) {
      void this.completeIntro();
      return;
    }
    this.introStep += 1;
    this.render();
  }

  private closeMenu(): void {
    if (this.isIntroActive()) {
      return;
    }
    if (!this.menuOpen) {
      return;
    }
    this.menuOpen = false;
    this.moreOpen = false;
    this.pendingAction = null;
    this.removeOutsideClickListener();
    this.render();
  }

  private openMenu(): void {
    if (this.menuOpen) {
      return;
    }
    this.menuOpen = true;
    this.render();
    this.bindOutsideClickListener();
  }

  private bindOutsideClickListener(): void {
    this.removeOutsideClickListener();
    this.outsideClickListener = (event: Event) => {
      if (!this.root || !(event.target instanceof Node)) {
        return;
      }
      if (!this.root.contains(event.target)) {
        this.closeMenu();
      }
    };
    // Defer so the opening tap does not immediately close the menu.
    window.setTimeout(() => {
      if (this.outsideClickListener) {
        document.addEventListener('pointerdown', this.outsideClickListener, true);
      }
    }, 0);
  }

  private removeOutsideClickListener(): void {
    if (this.outsideClickListener) {
      document.removeEventListener('pointerdown', this.outsideClickListener, true);
      this.outsideClickListener = null;
    }
  }

  private render(): void {
    if (!this.isActiveInstance()) {
      return;
    }

    if (!this.isOverlayVisible()) {
      this.removeOutsideClickListener();
      this.removeAllOverlayRoots();
      this.root = null;
      return;
    }

    if (this.root?.isConnected) {
      for (const node of document.querySelectorAll(`#${ROOT_ID}`)) {
        if (node !== this.root) {
          node.remove();
        }
      }
      this.patchRoot(this.presentation!);
      this.applyPosition();
      return;
    }

    this.removeAllOverlayRoots();
    this.root = this.buildRoot(this.presentation!);
    document.documentElement.appendChild(this.root);
    this.applyPosition();
  }

  private patchRoot(presentation: CatPresentation): void {
    const root = this.root;
    if (!root) {
      return;
    }

    root.className = `tabby-root tabby-root--${presentation.stage}`;
    if (this.menuOpen) {
      root.classList.add('tabby-root--menu-open');
    }
    if (this.isIntroActive()) {
      root.classList.add('tabby-root--intro');
    }

    const catImage = root.querySelector('.tabby-cat');
    if (catImage instanceof HTMLImageElement) {
      if (catImage.dataset.sprite !== presentation.sprite) {
        catImage.dataset.sprite = presentation.sprite;
        catImage.src = publicAssetUrl(presentation.sprite);
      }
    }

    for (const menu of root.querySelectorAll('.tabby-menu-area')) {
      menu.remove();
    }

    if (!this.menuOpen) {
      delete root.dataset.menuPlacement;
      return;
    }

    const panel = root.querySelector('.tabby-panel');
    if (!(panel instanceof HTMLElement)) {
      return;
    }

    panel.appendChild(
      this.isIntroActive()
        ? this.buildIntroMenuArea()
        : this.buildCareMenuArea(presentation),
    );
  }

  private buildRoot(presentation: CatPresentation): HTMLElement {
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = `tabby-root tabby-root--${presentation.stage}`;
    if (this.menuOpen) {
      root.classList.add('tabby-root--menu-open');
    }
    if (this.isIntroActive()) {
      root.classList.add('tabby-root--intro');
    }

    const panel = document.createElement('div');
    panel.className = 'tabby-panel';

    const catSurface = document.createElement('div');
    catSurface.className = 'tabby-cat-surface';

    const catImage = document.createElement('img');
    catImage.className = 'tabby-cat';
    catImage.alt = 'Tabby';
    catImage.dataset.sprite = presentation.sprite;
    catImage.src = publicAssetUrl(presentation.sprite);
    catImage.draggable = false;
    catImage.addEventListener('error', () => {
      console.error('[Tabby] Failed to load sprite:', catImage.src);
    });

    catSurface.appendChild(catImage);
    panel.appendChild(catSurface);

    if (this.menuOpen) {
      panel.appendChild(
        this.isIntroActive()
          ? this.buildIntroMenuArea()
          : this.buildCareMenuArea(presentation),
      );
    }

    this.attachDragAndTapHandlers(root, catSurface, () => {
      if (this.isIntroActive()) {
        return;
      }
      if (this.menuOpen) {
        this.closeMenu();
      } else {
        this.openMenu();
      }
    });

    root.appendChild(panel);
    return root;
  }

  private buildIntroMenuArea(): HTMLElement {
    const menuArea = document.createElement('div');
    menuArea.className = 'tabby-menu-area tabby-menu-area--top';

    const step = this.introStep ?? 0;

    const controls = document.createElement('div');
    controls.className = 'tabby-card tabby-card--actions tabby-card--intro';

    const footer = document.createElement('div');
    footer.className = 'tabby-intro-footer';

    const progress = document.createElement('span');
    progress.className = 'tabby-intro-step';
    progress.textContent = `${step + 1} / ${introStepCount()}`;
    footer.appendChild(progress);

    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'tabby-btn tabby-btn--suggested';
    nextButton.textContent = introNextLabel(step);
    nextButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.advanceIntro();
    });
    footer.appendChild(nextButton);

    const skipButton = document.createElement('button');
    skipButton.type = 'button';
    skipButton.className = 'tabby-btn tabby-btn--link';
    skipButton.textContent = INTRO_SKIP_LABEL;
    skipButton.addEventListener('click', (event) => {
      event.stopPropagation();
      void this.completeIntro();
    });
    footer.appendChild(skipButton);

    controls.appendChild(footer);
    menuArea.appendChild(controls);
    menuArea.appendChild(this.buildSpeechBubble(introStepText(step)));

    return menuArea;
  }

  private buildCareMenuArea(presentation: CatPresentation): HTMLElement {
    const menuArea = document.createElement('div');
    menuArea.className = 'tabby-menu-area tabby-menu-area--top';

    const card = document.createElement('div');
    card.className = 'tabby-card tabby-card--actions';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'tabby-card-close';
    closeButton.title = 'Close menu';
    closeButton.setAttribute('aria-label', 'Close menu');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.closeMenu();
    });
    card.appendChild(closeButton);

    const actions = document.createElement('div');
    actions.className = 'tabby-actions';

    for (const option of presentation.interactions) {
      actions.appendChild(this.createActionButton(option));
    }

    const secondary = presentation.secondaryInteractions ?? [];
    if (secondary.length > 0) {
      const moreButton = document.createElement('button');
      moreButton.type = 'button';
      moreButton.className = 'tabby-btn tabby-btn--ghost';
      moreButton.setAttribute('aria-expanded', this.moreOpen ? 'true' : 'false');
      moreButton.textContent = this.moreOpen ? 'Less' : 'More';
      moreButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.moreOpen = !this.moreOpen;
        this.render();
        if (this.menuOpen) {
          this.bindOutsideClickListener();
        }
      });
      actions.appendChild(moreButton);

      if (this.moreOpen) {
        const secondaryActions = document.createElement('div');
        secondaryActions.className = 'tabby-actions-secondary';

        for (const option of secondary) {
          secondaryActions.appendChild(
            this.createActionButton(option, { secondary: true }),
          );
        }

        actions.appendChild(secondaryActions);
      }
    }

    card.appendChild(actions);
    menuArea.appendChild(card);

    if (presentation.speech) {
      menuArea.appendChild(this.buildSpeechBubble(presentation.speech));
    }

    return menuArea;
  }

  private buildSpeechBubble(text: string): HTMLElement {
    const bubble = document.createElement('div');
    bubble.className = 'tabby-speech-bubble';

    const bubbleText = document.createElement('p');
    bubbleText.className = 'tabby-speech-bubble-text';
    bubbleText.textContent = text;

    bubble.appendChild(bubbleText);
    return bubble;
  }

  private createActionButton(
    option: {
      action: InteractionAction;
      label: string;
      enabled: boolean;
      primary?: boolean;
    },
    options: { secondary?: boolean } = {},
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tabby-btn';
    button.dataset.action = option.action;

    const isPending = this.pendingAction === option.action;
    const isActive =
      !isPending && this.presentation?.lastCareAction === option.action;

    if (option.primary && !isActive && !isPending) {
      button.classList.add('tabby-btn--suggested');
    }
    if (options.secondary) {
      button.classList.add('tabby-btn--danger');
    }
    if (isPending) {
      button.classList.add('tabby-btn--pending');
      button.setAttribute('aria-busy', 'true');
    }
    if (isActive) {
      button.classList.add('tabby-btn--active');
      button.setAttribute('aria-current', 'true');
    }

    button.textContent = isPending ? `${option.label}…` : option.label;
    button.disabled = !option.enabled || isPending;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      void this.handleInteraction(option.action);
    });
    return button;
  }

  private attachDragAndTapHandlers(
    root: HTMLElement,
    surface: HTMLElement,
    onTap: () => void,
  ): void {
    let dragging = false;
    let didDrag = false;
    let offsetX = 0;
    let offsetY = 0;
    let downX = 0;
    let downY = 0;
    let pointerId: number | null = null;

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging || event.pointerId !== pointerId) {
        return;
      }

      if (
        !didDrag &&
        Math.abs(event.clientX - downX) < DRAG_THRESHOLD_PX &&
        Math.abs(event.clientY - downY) < DRAG_THRESHOLD_PX
      ) {
        return;
      }

      didDrag = true;
      root.classList.add('tabby-root--dragging');

      const catSize = this.presentation
        ? CAT_DISPLAY_SIZE[this.presentation.stage]
        : CAT_DISPLAY_SIZE.playful;

      const next = clampOverlayPosition(
        {
          x: event.clientX - offsetX,
          y: event.clientY - offsetY,
        },
        window.innerWidth,
        window.innerHeight,
        catSize,
        catSize,
      );

      this.position = next;
      this.applyPosition();
      event.preventDefault();
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (!dragging || event.pointerId !== pointerId) {
        return;
      }

      dragging = false;
      pointerId = null;
      root.classList.remove('tabby-root--dragging');
      surface.releasePointerCapture(event.pointerId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (didDrag) {
        void this.savePosition();
        return;
      }

      onTap();
    };

    surface.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      dragging = true;
      didDrag = false;
      pointerId = event.pointerId;
      downX = event.clientX;
      downY = event.clientY;

      const rect = surface.getBoundingClientRect();
      this.position = { x: rect.left, y: rect.top };
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;

      surface.setPointerCapture(event.pointerId);
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  }

  private applyPosition(): void {
    if (!this.root || !this.presentation) {
      return;
    }

    const catSize = CAT_DISPLAY_SIZE[this.presentation.stage];

    const resolved = isDefaultOverlayPosition(this.position)
      ? resolveAnchoredPosition(
          this.position,
          window.innerWidth,
          window.innerHeight,
          catSize,
          catSize,
        )
      : clampOverlayPosition(
          this.position,
          window.innerWidth,
          window.innerHeight,
          catSize,
          catSize,
        );

    this.root.style.left = `${resolved.x}px`;
    this.root.style.top = `${resolved.y}px`;

    if (!isDefaultOverlayPosition(this.position)) {
      this.position = resolved;
    }

    this.applyMenuPlacement(resolved, catSize);
  }

  private applyMenuPlacement(catPosition: OverlayPosition, catSize: number): void {
    if (!this.root || !this.menuOpen) {
      return;
    }

    const menuArea = this.root.querySelector('.tabby-menu-area');
    if (!(menuArea instanceof HTMLElement)) {
      return;
    }

    const menuWidth = menuArea.offsetWidth || 220;
    const menuHeight = menuArea.offsetHeight || 180;
    const layout = resolveMenuLayout({
      catX: catPosition.x,
      catY: catPosition.y,
      catWidth: catSize,
      catHeight: catSize,
      menuWidth,
      menuHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });

    menuArea.className = `tabby-menu-area tabby-menu-area--${layout.placement}`;
    menuArea.style.setProperty('--tabby-menu-width', `${layout.width}px`);
    menuArea.style.setProperty('--tabby-menu-offset-x', `${layout.offsetX}px`);
    this.root.dataset.menuPlacement = layout.placement;
  }

  private async handleInteraction(action: InteractionAction): Promise<void> {
    if (this.pendingAction) {
      return;
    }

    this.pendingAction = action;
    this.render();

    try {
      const careAction = mapInteractionToCareAction(action);
      const next = await requestCareAction(careAction);
      this.presentation = next;

      if (action === 'dismiss') {
        this.menuOpen = false;
        this.moreOpen = false;
        this.removeOutsideClickListener();
      }
    } finally {
      this.pendingAction = null;
      this.render();

      if (this.menuOpen && action !== 'dismiss') {
        this.bindOutsideClickListener();
      }
    }
  }
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

    const globalWindow = window as unknown as Record<string, TabbyOverlay | undefined>;
    const existing = globalWindow[GLOBAL_KEY];
    if (existing) {
      existing.destroy();
      delete globalWindow[GLOBAL_KEY];
    }

    const overlay = new TabbyOverlay();
    globalWindow[GLOBAL_KEY] = overlay;
    void overlay.initialize();
  },
});
