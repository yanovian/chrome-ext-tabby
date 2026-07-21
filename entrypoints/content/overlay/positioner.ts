import {
  CAT_DISPLAY_SIZE,
  clampOverlayPosition,
  defaultOverlayPosition,
  isDefaultOverlayPosition,
  peekCatSurfaceLayout,
  resolveCompanionLayoutPosition,
  resolveMenuLayout,
  resolvePeekLayout,
} from '../../../utils/overlay-position';
import { readViewportBox } from '../../../utils/viewport-box';
import type { CatPresentation, OverlayPosition } from '../../../utils/types';
import { STORAGE_KEYS } from '../../../utils/types';
import { isPeeking, peekPlacement } from './peek-state';

const DRAG_THRESHOLD_PX = 4;

/**
 * Owns where the overlay sits on screen: the saved drag position, the peek-mode
 * corner/position math, and the menu's placement relative to the cat. Nothing outside this
 * file needs to know she has a "position" at all — everything else just asks it to apply
 * itself to a root element given the current presentation.
 */
export class OverlayPositioner {
  private position: OverlayPosition = defaultOverlayPosition();
  private peekRestorePosition: OverlayPosition | null = null;
  private wasPeeking = false;

  getPosition(): OverlayPosition {
    return this.position;
  }

  /** Forces the next apply() to treat this as a fresh entry into peek (re-capturing the
   * restore position) even if it was already peeking, since a dev-forced mood jump doesn't
   * go through the normal not-peeking-to-peeking transition apply() detects on its own. */
  resetPeekTransition(isPeek: boolean): void {
    if (isPeek) {
      this.wasPeeking = false;
    }
  }

  /** Pre-marks the peek transition based on an actual mood change (previous vs next), so
   * apply() reflects it correctly even if it doesn't get called until several state changes
   * later (e.g. suppressed by a speech bubble or an in-progress intro). */
  syncPeekTransition(previousMood: string | null | undefined, nextMood: string): void {
    if (previousMood !== 'peek' && nextMood === 'peek') {
      this.wasPeeking = false;
    }
    if (previousMood === 'peek' && nextMood !== 'peek') {
      this.wasPeeking = true;
    }
  }

  async load(): Promise<void> {
    const stored = await browser.storage.local.get([
      STORAGE_KEYS.overlayPosition,
      STORAGE_KEYS.peekRestorePosition,
    ]);
    const saved = stored[STORAGE_KEYS.overlayPosition] as OverlayPosition | undefined;
    this.position = saved ?? defaultOverlayPosition();
    this.peekRestorePosition =
      (stored[STORAGE_KEYS.peekRestorePosition] as OverlayPosition | undefined) ?? null;
  }

  async save(): Promise<void> {
    await browser.storage.local.set({
      [STORAGE_KEYS.overlayPosition]: this.position,
    });
  }

  /** Restore the pre-peek position before revealing, so the reveal doesn't render one frame
   * at the peek-edge position first. */
  async restorePeekSavedPosition(): Promise<void> {
    const stored = await browser.storage.local.get(STORAGE_KEYS.peekRestorePosition);
    const restore =
      (stored[STORAGE_KEYS.peekRestorePosition] as OverlayPosition | undefined) ??
      this.peekRestorePosition;
    if (!restore) {
      return;
    }

    this.position = restore;
    this.peekRestorePosition = restore;
    await browser.storage.local.set({
      [STORAGE_KEYS.overlayPosition]: restore,
    });
    await browser.storage.local.remove(STORAGE_KEYS.peekRestorePosition);
  }

  applyPeekSurfaceLayout(
    surface: ReturnType<typeof peekCatSurfaceLayout> | null,
    root: HTMLElement | null,
  ): void {
    const catSurface = root?.querySelector('.tabby-cat-surface');
    if (!(catSurface instanceof HTMLElement)) {
      return;
    }

    if (!surface) {
      catSurface.style.removeProperty('width');
      catSurface.style.removeProperty('height');
      catSurface.style.removeProperty('left');
      catSurface.style.removeProperty('right');
      catSurface.style.removeProperty('top');
      catSurface.style.removeProperty('bottom');
      catSurface.style.removeProperty('transform');
      catSurface.style.removeProperty('transform-origin');
      return;
    }
    catSurface.style.width = `${surface.width}px`;
    catSurface.style.height = `${surface.height}px`;
    catSurface.style.setProperty('left', surface.left, 'important');
    catSurface.style.setProperty('right', surface.right, 'important');
    catSurface.style.setProperty('top', surface.top, 'important');
    catSurface.style.setProperty('bottom', surface.bottom, 'important');
    catSurface.style.setProperty('transform', surface.transform, 'important');
    catSurface.style.setProperty('transform-origin', surface.transformOrigin, 'important');
  }

  /** Position the root element (and its peek surface/menu) for the current presentation. */
  apply(root: HTMLElement, presentation: CatPresentation, hasOverlayChrome: boolean): void {
    const viewport = readViewportBox();
    const catSize = CAT_DISPLAY_SIZE[presentation.stage];
    const peeking = isPeeking(presentation);

    if (peeking && !this.wasPeeking) {
      this.peekRestorePosition = resolveCompanionLayoutPosition(
        this.position,
        viewport.width,
        viewport.height,
        catSize,
      );
      void browser.storage.local.set({
        [STORAGE_KEYS.peekRestorePosition]: this.peekRestorePosition,
      });
    }

    if (!peeking && this.wasPeeking && this.peekRestorePosition) {
      this.position = this.peekRestorePosition;
      void browser.storage.local.set({
        [STORAGE_KEYS.overlayPosition]: this.peekRestorePosition,
      });
      void browser.storage.local.remove(STORAGE_KEYS.peekRestorePosition);
      this.peekRestorePosition = null;
    }

    const resolved = peeking
      ? resolvePeekLayout(peekPlacement(presentation), viewport.width, viewport.height, catSize)
      : {
          position: resolveCompanionLayoutPosition(
            this.position,
            viewport.width,
            viewport.height,
            catSize,
          ),
          dimensions: { width: catSize, height: catSize },
          surface: null,
        };

    root.style.left = `${Math.round(resolved.position.x + viewport.offsetX)}px`;
    root.style.top = `${Math.round(resolved.position.y + viewport.offsetY)}px`;

    if (peeking) {
      root.style.width = `${resolved.dimensions.width}px`;
      root.style.height = `${resolved.dimensions.height}px`;
      root.style.maxWidth = `${resolved.dimensions.width}px`;
      root.style.maxHeight = `${resolved.dimensions.height}px`;
      if (resolved.surface) {
        this.applyPeekSurfaceLayout(resolved.surface, root);
      }
    } else {
      root.style.removeProperty('width');
      root.style.removeProperty('height');
      root.style.removeProperty('max-width');
      root.style.removeProperty('max-height');
      this.applyPeekSurfaceLayout(null, root);
    }

    if (!peeking && !isDefaultOverlayPosition(this.position)) {
      this.position = resolved.position;
    }

    this.wasPeeking = peeking;
    this.applyMenuPlacement(root, resolved.position, catSize, viewport, presentation, hasOverlayChrome);
  }

  private applyMenuPlacement(
    root: HTMLElement,
    catPosition: OverlayPosition,
    catSize: number,
    viewport: ReturnType<typeof readViewportBox>,
    presentation: CatPresentation,
    hasOverlayChrome: boolean,
  ): void {
    if (!hasOverlayChrome) {
      return;
    }

    const menuArea = root.querySelector('.tabby-menu-area');
    if (!(menuArea instanceof HTMLElement)) {
      return;
    }

    const menuWidth = menuArea.offsetWidth || 220;
    const menuHeight = menuArea.offsetHeight || 180;
    const isPeek = presentation.mood === 'peek';
    const peekLayout = isPeek
      ? resolvePeekLayout(peekPlacement(presentation), viewport.width, viewport.height, catSize)
      : null;
    const layoutCatWidth = peekLayout?.dimensions.width ?? catSize;
    const layoutCatHeight = peekLayout?.dimensions.height ?? catSize;

    const layout = resolveMenuLayout({
      catX: catPosition.x,
      catY: catPosition.y,
      catWidth: layoutCatWidth,
      catHeight: layoutCatHeight,
      menuWidth,
      menuHeight,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    });

    menuArea.className = `tabby-menu-area tabby-menu-area--${layout.placement}`;
    menuArea.style.setProperty('--tabby-menu-width', `${layout.width}px`);
    menuArea.style.setProperty('--tabby-menu-offset-x', `${layout.offsetX}px`);
    root.dataset.menuPlacement = layout.placement;
  }

  /** Wires up drag-to-move and tap-vs-drag detection on the cat surface. onTap fires for a
   * genuine tap (no meaningful movement); a real drag updates and saves the position itself.
   * Takes a getter (not a snapshot) because this is attached once per DOM mount but must react
   * to whatever the presentation has become by the time a drag/tap actually happens. */
  attachDragAndTapHandlers(
    root: HTMLElement,
    surface: HTMLElement,
    getPresentation: () => CatPresentation | null,
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

      const presentation = getPresentation();
      const catSize = presentation ? CAT_DISPLAY_SIZE[presentation.stage] : CAT_DISPLAY_SIZE.playful;
      const viewport = readViewportBox();

      const next = clampOverlayPosition(
        {
          x: event.clientX - offsetX - viewport.offsetX,
          y: event.clientY - offsetY - viewport.offsetY,
        },
        viewport.width,
        viewport.height,
        catSize,
        catSize,
      );

      this.position = next;
      if (presentation) {
        this.apply(root, presentation, root.classList.contains('tabby-root--menu-open'));
      }
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
        void this.save();
        return;
      }

      onTap();
    };

    surface.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }

      if (isPeeking(getPresentation())) {
        event.preventDefault();
        event.stopPropagation();
        const peekPointerId = event.pointerId;
        const onPeekUp = (upEvent: PointerEvent): void => {
          if (upEvent.pointerId !== peekPointerId) {
            return;
          }
          window.removeEventListener('pointerup', onPeekUp);
          window.removeEventListener('pointercancel', onPeekUp);
          onTap();
        };
        window.addEventListener('pointerup', onPeekUp);
        window.addEventListener('pointercancel', onPeekUp);
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
}
