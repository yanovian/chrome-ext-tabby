import type { OverlayPosition } from './types';
import { COMPANION_DISPLAY_SIZE, PEEK_VISIBLE_HEIGHT_RATIO } from './companion-animation';
import type { PeekEdge, PeekPlacement } from './ambient-presence';

export const PEEK_VISIBLE_WIDTH_RATIO = PEEK_VISIBLE_HEIGHT_RATIO;

export type MenuPlacement = 'top' | 'bottom' | 'left' | 'right';

/** Cat size on screen (px). Kept as alias for overlay layout code. */
export const CAT_DISPLAY_SIZE = COMPANION_DISPLAY_SIZE;

/** Minimum inset from the viewport edge when placing the menu. */
export const VIEWPORT_MARGIN = 16;

/** Peek windows never sit closer than this to a viewport edge. */
export function effectivePeekInset(inset: number): number {
  return Math.max(inset, VIEWPORT_MARGIN);
}

export const MENU_GAP = 10;
export const MENU_WIDTH_MIN = 180;
export const MENU_WIDTH_MAX = 240;

export function defaultOverlayPosition(): OverlayPosition {
  return { x: -1, y: -1 };
}

/** -1 means anchor to bottom-left until the user drags. */
export function isDefaultOverlayPosition(position: OverlayPosition): boolean {
  return position.x < 0 || position.y < 0;
}

export function clampOverlayPosition(
  position: OverlayPosition,
  viewportWidth: number,
  viewportHeight: number,
  overlayWidth: number,
  overlayHeight: number,
): OverlayPosition {
  const maxX = Math.max(0, viewportWidth - overlayWidth);
  const maxY = Math.max(0, viewportHeight - overlayHeight);

  return {
    x: Math.max(0, Math.min(maxX, position.x)),
    y: Math.max(0, Math.min(maxY, position.y)),
  };
}

/** Position the cat sprite — stored overlay coordinates are the cat's top-left corner. */
export function resolveAnchoredPosition(
  position: OverlayPosition,
  viewportWidth: number,
  viewportHeight: number,
  catWidth: number,
  catHeight: number,
): OverlayPosition {
  if (!isDefaultOverlayPosition(position)) {
    return clampOverlayPosition(
      position,
      viewportWidth,
      viewportHeight,
      catWidth,
      catHeight,
    );
  }

  return {
    x: VIEWPORT_MARGIN,
    y: Math.max(0, viewportHeight - catHeight - VIEWPORT_MARGIN),
  };
}

/** Non-peek overlay position from saved drag coordinates. */
export function resolveCompanionLayoutPosition(
  position: OverlayPosition,
  viewportWidth: number,
  viewportHeight: number,
  catSize: number,
): OverlayPosition {
  return isDefaultOverlayPosition(position)
    ? resolveAnchoredPosition(position, viewportWidth, viewportHeight, catSize, catSize)
    : clampOverlayPosition(position, viewportWidth, viewportHeight, catSize, catSize);
}

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

/** Clip path only used for bottom (side edges use a narrow root). */
export function peekRootClipPath(_edge: PeekEdge, _catSize: number): string | null {
  return null;
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

type Point = readonly [number, number];

type Affine = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

function affineIdentity(): Affine {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

function multiplyAffine(left: Affine, right: Affine): Affine {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

function translateAffine(x: number, y: number): Affine {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
}

function rotateAffine(deg: number): Affine {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
}

function applyAffine(matrix: Affine, x: number, y: number): Point {
  return [
    matrix.a * x + matrix.c * y + matrix.e,
    matrix.b * x + matrix.d * y + matrix.f,
  ];
}

function buildSurfaceTransformMatrix(transform: string): Affine {
  let matrix = affineIdentity();
  for (const step of parseTransformSteps(transform)) {
    if (step.kind === 'translateX') {
      matrix = multiplyAffine(matrix, translateAffine(step.value, 0));
      continue;
    }
    if (step.kind === 'translateY') {
      matrix = multiplyAffine(matrix, translateAffine(0, step.value));
      continue;
    }
    if (step.kind === 'rotate') {
      matrix = multiplyAffine(matrix, rotateAffine(step.deg));
    }
  }
  return matrix;
}

function transformPoint(
  point: Point,
  width: number,
  height: number,
  transform: string,
  transformOrigin: string,
): Point {
  const [ox, oy] = parseTransformOrigin(transformOrigin, width, height);
  const surfaceMatrix = buildSurfaceTransformMatrix(transform);
  const matrix = multiplyAffine(
    translateAffine(ox, oy),
    multiplyAffine(surfaceMatrix, translateAffine(-ox, -oy)),
  );
  return applyAffine(matrix, point[0], point[1]);
}

function parseTransformSteps(
  transform: string,
): Array<{ kind: 'translateX' | 'translateY'; value: number } | { kind: 'rotate'; deg: number }> {
  const steps: Array<
    { kind: 'translateX' | 'translateY'; value: number } | { kind: 'rotate'; deg: number }
  > = [];
  const pattern = /(translateX\(([-\d.]+)px\)|translateY\(([-\d.]+)px\)|rotate\((-?\d+)deg\))/g;
  for (const match of transform.matchAll(pattern)) {
    const token = match[1] ?? '';
    if (token.startsWith('translateX')) {
      steps.push({ kind: 'translateX', value: Number(match[2]) });
      continue;
    }
    if (token.startsWith('translateY')) {
      steps.push({ kind: 'translateY', value: Number(match[3]) });
      continue;
    }
    if (token.startsWith('rotate')) {
      steps.push({ kind: 'rotate', deg: Number(match[4]) });
    }
  }
  return steps;
}

function parseTransformOrigin(
  transformOrigin: string,
  width: number,
  height: number,
): Point {
  const [xToken, yToken] = transformOrigin.trim().split(/\s+/);
  const parseAxis = (token: string, size: number): number => {
    if (token.endsWith('%')) {
      return (Number(token.slice(0, -1)) / 100) * size;
    }
    if (token.endsWith('px')) {
      return Number(token.slice(0, -2));
    }
    if (token === 'left' || token === 'top') {
      return 0;
    }
    if (token === 'right' || token === 'bottom') {
      return size;
    }
    if (token === 'center') {
      return size / 2;
    }
    return Number(token);
  };
  return [parseAxis(xToken ?? '0', width), parseAxis(yToken ?? '0', height)];
}

/** Whether the rotated sprite fills the peek clip window enough to read as a peek. */
export function peekSurfaceFillsClipWindow(edge: PeekEdge, catSize: number): boolean {
  const layout = peekCatSurfaceLayout(edge, catSize);
  const overlap = measurePeekSurfaceOverlap(edge, layout, catSize);
  if (edge === 'bottom') {
    return overlap.coverage > 0.25;
  }
  // Side peeks must fill the FULL container height (not just half of it):
  // the whole clip window is meant to be covered by sprite, same as bottom.
  const { width, height } = peekRootDimensions(edge, catSize);
  return (
    overlap.overlapWidth >= width * 0.85 &&
    overlap.overlapHeight >= height * 0.85 &&
    layout.transform.includes('rotate')
  );
}

/** Visible overlap bounds inside the peek clip window (for tests). */
export function measurePeekSurfaceOverlap(
  edge: PeekEdge,
  layout: Pick<ReturnType<typeof peekCatSurfaceLayout>, 'transform' | 'transformOrigin'>,
  catSize = 192,
): {
  overlapWidth: number;
  overlapHeight: number;
  coverage: number;
} {
  const { width, height } = peekRootDimensions(edge, catSize);
  const step = Math.max(8, Math.round(catSize / 12));
  let inside = 0;
  let total = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y <= catSize; y += step) {
    for (let x = 0; x <= catSize; x += step) {
      const [tx, ty] = transformPoint(
        [x, y],
        catSize,
        catSize,
        layout.transform,
        layout.transformOrigin,
      );
      total += 1;
      if (tx >= 0 && tx <= width && ty >= 0 && ty <= height) {
        inside += 1;
        minX = Math.min(minX, tx);
        maxX = Math.max(maxX, tx);
        minY = Math.min(minY, ty);
        maxY = Math.max(maxY, ty);
      }
    }
  }
  const overlapWidth = Number.isFinite(minX) ? Math.max(0, maxX - minX) : 0;
  const overlapHeight = Number.isFinite(minY) ? Math.max(0, maxY - minY) : 0;
  return {
    overlapWidth,
    overlapHeight,
    coverage: total > 0 ? inside / total : 0,
  };
}

export interface PeekLayout {
  position: OverlayPosition;
  dimensions: { width: number; height: number };
  surface: ReturnType<typeof peekCatSurfaceLayout>;
  clipPath: string | null;
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
    clipPath: peekRootClipPath(edge, catSize),
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

export interface MenuPlacementInput {
  catX: number;
  catY: number;
  catWidth: number;
  catHeight: number;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
  margin?: number;
}

export interface MenuLayoutResult {
  placement: MenuPlacement;
  width: number;
  offsetX: number;
}

interface SideSpaces {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function computeSideSpaces(
  input: MenuPlacementInput,
  margin: number,
  gap: number,
): SideSpaces {
  return {
    top: input.catY - gap - margin,
    bottom:
      input.viewportHeight - (input.catY + input.catHeight) - gap - margin,
    left: input.catX - gap - margin,
    right: input.viewportWidth - (input.catX + input.catWidth) - gap - margin,
  };
}

/** Lay out a top/bottom menu using free space beside the cat, not just centered width. */
export function resolveVerticalMenuGeometry(
  input: MenuPlacementInput,
  margin = VIEWPORT_MARGIN,
): { width: number; offsetX: number } | null {
  const catLeft = input.catX;
  const catRight = input.catX + input.catWidth;
  const catCenterX = catLeft + input.catWidth / 2;

  const widthGrowLeft = catRight - margin;
  const widthGrowRight = input.viewportWidth - margin - catLeft;
  const widthCentered =
    2 *
    Math.min(
      catCenterX - margin,
      input.viewportWidth - margin - catCenterX,
    );

  const maxWidth = Math.min(
    MENU_WIDTH_MAX,
    Math.max(widthGrowLeft, widthGrowRight, widthCentered),
  );

  if (maxWidth < MENU_WIDTH_MIN) {
    return null;
  }

  const width = Math.max(MENU_WIDTH_MIN, maxWidth);
  const roomLeft = catLeft - margin;
  const roomRight = input.viewportWidth - margin - catRight;

  let menuLeft: number;
  if (roomLeft >= roomRight) {
    menuLeft = Math.max(margin, catRight - width);
  } else {
    menuLeft = catLeft;
    if (menuLeft + width > input.viewportWidth - margin) {
      menuLeft = input.viewportWidth - margin - width;
    }
  }

  menuLeft = Math.max(
    margin,
    Math.min(menuLeft, input.viewportWidth - margin - width),
  );

  return {
    width: Math.round(width),
    offsetX: Math.round(menuLeft + width / 2 - catCenterX),
  };
}

function verticalPlacementFits(
  placement: 'top' | 'bottom',
  input: MenuPlacementInput,
  spaces: SideSpaces,
  margin: number,
): boolean {
  const verticalSpace = placement === 'top' ? spaces.top : spaces.bottom;
  if (verticalSpace < input.menuHeight) {
    return false;
  }
  return resolveVerticalMenuGeometry(input, margin) !== null;
}

function horizontalPlacementFits(
  placement: 'left' | 'right',
  input: MenuPlacementInput,
  spaces: SideSpaces,
  margin: number,
): boolean {
  const horizontalSpace = placement === 'left' ? spaces.left : spaces.right;
  if (horizontalSpace < input.menuWidth) {
    return false;
  }

  const catCenterY = input.catY + input.catHeight / 2;
  const verticalHalf = input.menuHeight / 2;
  return (
    catCenterY - verticalHalf >= margin &&
    catCenterY + verticalHalf <= input.viewportHeight - margin
  );
}

const PLACEMENT_PREFERENCE: Record<MenuPlacement, number> = {
  top: 4,
  bottom: 3,
  left: 2,
  right: 1,
};

function rankFittingPlacements(
  input: MenuPlacementInput,
  spaces: SideSpaces,
  margin: number,
): MenuPlacement[] {
  const candidates: Array<{ placement: MenuPlacement; score: number }> = [];

  for (const placement of ['top', 'bottom', 'left', 'right'] as const) {
    let fits = false;
    let surplus = 0;

    if (placement === 'top' || placement === 'bottom') {
      fits = verticalPlacementFits(placement, input, spaces, margin);
      surplus =
        (placement === 'top' ? spaces.top : spaces.bottom) - input.menuHeight;
    } else {
      fits = horizontalPlacementFits(placement, input, spaces, margin);
      surplus =
        (placement === 'left' ? spaces.left : spaces.right) - input.menuWidth;
    }

    if (!fits) {
      continue;
    }

    candidates.push({
      placement,
      score: PLACEMENT_PREFERENCE[placement] * 1000 + surplus,
    });
  }

  return candidates
    .sort((left, right) => right.score - left.score)
    .map((candidate) => candidate.placement);
}

/** Pick placement and width based on menu size vs remaining viewport space. */
export function resolveMenuLayout(input: MenuPlacementInput): MenuLayoutResult {
  const margin = input.margin ?? VIEWPORT_MARGIN;
  const gap = input.gap ?? MENU_GAP;
  const spaces = computeSideSpaces(input, margin, gap);
  const ranked = rankFittingPlacements(input, spaces, margin);

  if (ranked.length > 0) {
    const placement = ranked[0]!;
    if (placement === 'top' || placement === 'bottom') {
      const geometry = resolveVerticalMenuGeometry(input, margin)!;
      return {
        placement,
        width: geometry.width,
        offsetX: geometry.offsetX,
      };
    }
    return { placement, width: input.menuWidth, offsetX: 0 };
  }

  const fallback = (['top', 'bottom', 'left', 'right'] as const)
    .map((placement) => ({
      placement,
      space: spaces[placement],
    }))
    .sort((left, right) => right.space - left.space)[0]!.placement;

  if (fallback === 'top' || fallback === 'bottom') {
    const geometry = resolveVerticalMenuGeometry(input, margin) ?? {
      width: Math.min(MENU_WIDTH_MAX, Math.max(MENU_WIDTH_MIN, input.menuWidth)),
      offsetX: 0,
    };
    return { placement: fallback, ...geometry };
  }

  return { placement: fallback, width: input.menuWidth, offsetX: 0 };
}

/** Pick where the menu opens relative to the cat based on available viewport space. */
export function resolveMenuPlacement(input: MenuPlacementInput): MenuPlacement {
  return resolveMenuLayout(input).placement;
}
