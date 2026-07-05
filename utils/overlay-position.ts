import type { OverlayPosition } from './types';

export type MenuPlacement = 'top' | 'bottom' | 'left' | 'right';

export const CAT_DISPLAY_SIZE = {
  newborn: 88,
  playful: 112,
  adult: 130,
} as const;

/** Minimum inset from the viewport edge when placing the menu. */
export const VIEWPORT_MARGIN = 16;

export const MENU_GAP = 10;
export const MENU_WIDTH_MIN = 180;
export const MENU_WIDTH_MAX = 240;

export function defaultOverlayPosition(): OverlayPosition {
  return { x: -1, y: -1 };
}

/** -1 means anchor to bottom-right until the user drags. */
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
    x: Math.max(0, viewportWidth - catWidth - 20),
    y: Math.max(0, viewportHeight - catHeight - 20),
  };
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
