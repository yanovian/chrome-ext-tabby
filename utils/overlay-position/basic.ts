import type { OverlayPosition } from '../types';
import { COMPANION_DISPLAY_SIZE } from '../companion-animation';

/** Cat size on screen (px). Kept as alias for overlay layout code. */
export const CAT_DISPLAY_SIZE = COMPANION_DISPLAY_SIZE;

/** Minimum inset from the viewport edge when placing the menu. */
export const VIEWPORT_MARGIN = 16;

/** Peek windows never sit closer than this to a viewport edge. */
export function effectivePeekInset(inset: number): number {
  return Math.max(inset, VIEWPORT_MARGIN);
}

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
