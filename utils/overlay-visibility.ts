import type { CatPresentation } from './types';

/** Whether the floating cat should render on the current page. */
export function isCompanionOverlayVisible(input: {
  showOverlayEnabled: boolean;
  presentation: CatPresentation | null;
  pageOverlayHidden: boolean;
}): boolean {
  return (
    input.showOverlayEnabled &&
    input.presentation !== null &&
    !input.pageOverlayHidden
  );
}
