import type { OverlayPosition } from '../types';
import { PEEK_VISIBLE_HEIGHT_RATIO } from '../companion-animation';
import type { PeekEdge, PeekPlacement } from '../ambient-presence';
import { clampOverlayPosition, effectivePeekInset } from './basic';

export const PEEK_VISIBLE_WIDTH_RATIO = PEEK_VISIBLE_HEIGHT_RATIO;

/** Visible peek strip size in px for a cat display box. */
export function peekVisibleSize(catSize: number): number {
  return Math.round(catSize * PEEK_VISIBLE_WIDTH_RATIO);
}

/** Root size for the peek clip window (top-left anchor). */
export function peekRootDimensions(
  edge: PeekEdge,
  catSize: number,
): { width: number; height: number } {
  const visible = peekVisibleSize(catSize);
  if (edge === 'bottom') {
    return { width: catSize, height: visible };
  }
  return { width: visible, height: catSize };
}

/** Sprite layout inside the peek clip window. */
export function peekCatSurfaceLayout(
  edge: PeekEdge,
  catSize: number,
): {
  width: number;
  height: number;
  left: string;
  right: string;
  top: string;
  bottom: string;
  transform: string;
  transformOrigin: string;
} {
  const visible = peekVisibleSize(catSize);
  const shift = visible - catSize;
  const base = {
    width: catSize,
    height: catSize,
    top: 'auto',
    bottom: '0',
  };
  if (edge === 'bottom') {
    return {
      ...base,
      left: '0',
      right: 'auto',
      top: '0',
      bottom: 'auto',
      transformOrigin: 'left top',
      transform: `translateY(${shift}px)`,
    };
  }
  if (edge === 'left') {
    return {
      width: catSize,
      height: catSize,
      left: '0',
      right: 'auto',
      top: 'auto',
      bottom: '0',
      // Pivot on the surface's own center. A corner pivot (the old
      // approach) only rotates a quarter of the sprite into the clip
      // window instead of a full half, which clips most of the cat.
      transformOrigin: 'center center',
      transform: 'rotate(90deg)',
    };
  }
  return {
    width: catSize,
    height: catSize,
    left: 'auto',
    right: '0',
    top: 'auto',
    bottom: '0',
    transformOrigin: 'center center',
    transform: 'rotate(-90deg)',
  };
}

export interface PeekLayout {
  position: OverlayPosition;
  dimensions: { width: number; height: number };
  surface: ReturnType<typeof peekCatSurfaceLayout>;
}

/** Resolve peek root position, size, and sprite layout together. */
export function resolvePeekLayout(
  placement: Pick<PeekPlacement, 'edge' | 'inset' | 'corner'>,
  viewportWidth: number,
  viewportHeight: number,
  catSize: number,
): PeekLayout {
  const edge = placement.edge;
  const dimensions = peekRootDimensions(edge, catSize);
  const position = clampPeekRootPosition(
    resolvePeekPlacementPosition(placement, viewportWidth, viewportHeight, catSize),
    dimensions,
    viewportWidth,
    viewportHeight,
  );
  return {
    position,
    dimensions,
    surface: peekCatSurfaceLayout(edge, catSize),
  };
}

/** Clamp peek root so the entire clip window stays inside the viewport. */
export function clampPeekRootPosition(
  position: OverlayPosition,
  dimensions: { width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
): OverlayPosition {
  return clampOverlayPosition(
    position,
    viewportWidth,
    viewportHeight,
    dimensions.width,
    dimensions.height,
  );
}

/** Anchor Tabby at a screen edge for peek mood. */
export function resolvePeekPlacementPosition(
  placement: Pick<PeekPlacement, 'edge' | 'inset' | 'corner'>,
  viewportWidth: number,
  viewportHeight: number,
  catSize: number,
): OverlayPosition {
  const margin = effectivePeekInset(placement.inset);
  const visible = peekVisibleSize(catSize);

  if (placement.edge === 'bottom') {
    const x =
      placement.corner === 'right'
        ? Math.max(0, viewportWidth - catSize - margin)
        : margin;
    return {
      x,
      y: Math.max(0, viewportHeight - visible),
    };
  }

  const y =
    placement.corner === 'right'
      ? margin
      : Math.max(0, viewportHeight - catSize - margin);

  if (placement.edge === 'left') {
    return {
      x: 0,
      y,
    };
  }

  return {
    x: Math.max(0, viewportWidth - visible),
    y,
  };
}

/** True when the peek clip window fits entirely inside the viewport. */
export function peekLayoutFitsViewport(
  placement: Pick<PeekPlacement, 'edge' | 'inset' | 'corner'>,
  viewportWidth: number,
  viewportHeight: number,
  catSize: number,
): boolean {
  const { position, dimensions } = resolvePeekLayout(
    placement,
    viewportWidth,
    viewportHeight,
    catSize,
  );
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x + dimensions.width <= viewportWidth &&
    position.y + dimensions.height <= viewportHeight
  );
}
