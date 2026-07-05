import { describe, expect, it } from 'vitest';
import { isCompanionOverlayVisible } from '../utils/overlay-visibility';
import type { CatPresentation } from '../utils/types';

const presentation = {
  mood: 'content',
} as CatPresentation;

describe('isCompanionOverlayVisible', () => {
  it('hides the companion when the user dismissed it on this page', () => {
    expect(
      isCompanionOverlayVisible({
        showOverlayEnabled: true,
        presentation,
        pageOverlayHidden: true,
      }),
    ).toBe(false);
  });

  it('shows the companion when overlay is enabled and the page is not hidden', () => {
    expect(
      isCompanionOverlayVisible({
        showOverlayEnabled: true,
        presentation,
        pageOverlayHidden: false,
      }),
    ).toBe(true);
  });

  it('hides the companion when the global overlay toggle is off', () => {
    expect(
      isCompanionOverlayVisible({
        showOverlayEnabled: false,
        presentation,
        pageOverlayHidden: false,
      }),
    ).toBe(false);
  });
});
