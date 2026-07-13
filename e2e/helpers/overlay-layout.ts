/**
 * Self-contained peek layout for Playwright (mirrors utils/overlay-position.ts).
 * Do not import from utils/: that chain pulls locales/en.json and breaks Playwright.
 */

export type PeekEdge = 'bottom' | 'left' | 'right';

const PEEK_VISIBLE_RATIO = 0.5;
const VIEWPORT_MARGIN = 16;

export function peekVisibleSize(catSize: number): number {
  return Math.round(catSize * PEEK_VISIBLE_RATIO);
}

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
  if (edge === 'bottom') {
    return {
      width: catSize,
      height: catSize,
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
      // Pivot on the surface's own center: a corner pivot only rotates a
      // quarter of the sprite into the clip window instead of a full half.
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

export function peekSurfaceUsesRotation(edge: PeekEdge): boolean {
  return edge === 'left' || edge === 'right';
}

function effectivePeekInset(inset: number): number {
  return Math.max(inset, VIEWPORT_MARGIN);
}

function clampOverlayPosition(
  position: { x: number; y: number },
  viewportWidth: number,
  viewportHeight: number,
  overlayWidth: number,
  overlayHeight: number,
): { x: number; y: number } {
  const maxX = Math.max(0, viewportWidth - overlayWidth);
  const maxY = Math.max(0, viewportHeight - overlayHeight);
  return {
    x: Math.max(0, Math.min(maxX, position.x)),
    y: Math.max(0, Math.min(maxY, position.y)),
  };
}

function resolvePeekPlacementPosition(
  placement: { edge: PeekEdge; inset: number; corner: 'left' | 'right' },
  viewportWidth: number,
  viewportHeight: number,
  catSize: number,
): { x: number; y: number } {
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
    return { x: 0, y };
  }

  return {
    x: Math.max(0, viewportWidth - visible),
    y,
  };
}

export function resolvePeekLayout(
  placement: { edge: PeekEdge; inset: number; corner: 'left' | 'right' },
  viewportWidth: number,
  viewportHeight: number,
  catSize: number,
): {
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  surface: ReturnType<typeof peekCatSurfaceLayout>;
} {
  const dimensions = peekRootDimensions(placement.edge, catSize);
  const position = clampOverlayPosition(
    resolvePeekPlacementPosition(placement, viewportWidth, viewportHeight, catSize),
    viewportWidth,
    viewportHeight,
    dimensions.width,
    dimensions.height,
  );
  return {
    position,
    dimensions,
    surface: peekCatSurfaceLayout(placement.edge, catSize),
  };
}
