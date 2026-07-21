export {
  CAT_DISPLAY_SIZE,
  VIEWPORT_MARGIN,
  effectivePeekInset,
  defaultOverlayPosition,
  isDefaultOverlayPosition,
  clampOverlayPosition,
  resolveAnchoredPosition,
  resolveCompanionLayoutPosition,
} from './basic';

export {
  PEEK_VISIBLE_WIDTH_RATIO,
  peekVisibleSize,
  peekRootDimensions,
  peekCatSurfaceLayout,
  resolvePeekLayout,
  clampPeekRootPosition,
  resolvePeekPlacementPosition,
  peekLayoutFitsViewport,
  type PeekLayout,
} from './peek-geometry';

export {
  MENU_GAP,
  MENU_WIDTH_MIN,
  MENU_WIDTH_MAX,
  resolveVerticalMenuGeometry,
  resolveMenuLayout,
  resolveMenuPlacement,
  type MenuPlacement,
  type MenuPlacementInput,
  type MenuLayoutResult,
} from './menu-geometry';

export {
  peekSurfaceFillsClipWindow,
  measurePeekSurfaceOverlap,
} from './affine-transform';
