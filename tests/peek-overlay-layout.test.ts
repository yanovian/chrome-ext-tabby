import { describe, expect, it } from 'vitest';
import { pickPeekPlacement } from '../utils/ambient-presence';
import {
  measurePeekSurfaceOverlap,
  peekCatSurfaceLayout,
  peekLayoutFitsViewport,
  peekRootDimensions,
  peekSurfaceFillsClipWindow,
  resolvePeekLayout,
} from '../utils/overlay-position';
import { patchPresentationForDevForce, buildPresentation } from '../utils/presentation';
import { createInitialCat } from '../utils/cat-sim';
import { DEFAULT_SETTINGS } from '../utils/types';

const CAT_SIZE = 192;
const NOW = Date.parse('2026-07-05T14:00:00.000Z');

describe('peek overlay layout', () => {
  it('rotates left and right peeks into the page instead of upright slices', () => {
    expect(peekCatSurfaceLayout('left', CAT_SIZE).transform).toContain('rotate(90deg)');
    expect(peekCatSurfaceLayout('right', CAT_SIZE).transform).toContain('rotate(-90deg)');
    expect(peekCatSurfaceLayout('bottom', CAT_SIZE).transform).not.toContain('rotate');
  });

  it('fills the full height of the clip window on left/right, not just a corner', () => {
    // Regression: a corner-pivot rotation only exposed the sprite where the
    // narrow (half-width) window overlapped the narrow (half-height) sliver
    // of the box nearest that corner, showing a tiny triangle instead of a
    // proper half-cat silhouette (visible width was right, height was not).
    for (const edge of ['left', 'right'] as const) {
      const layout = peekCatSurfaceLayout(edge, CAT_SIZE);
      const overlap = measurePeekSurfaceOverlap(edge, layout, CAT_SIZE);
      const { width, height } = peekRootDimensions(edge, CAT_SIZE);
      expect(overlap.overlapHeight).toBeGreaterThan(height * 0.9);
      expect(overlap.overlapWidth).toBeGreaterThan(width * 0.9);
    }
  });

  it('keeps enough of the sprite visible after several peek placements', () => {
    for (let seed = 0; seed < 9; seed += 1) {
      const placement = pickPeekPlacement(seed + NOW);
      const layout = resolvePeekLayout(
        placement,
        1440,
        900,
        CAT_SIZE,
      );
      expect(peekSurfaceFillsClipWindow(placement.edge, CAT_SIZE)).toBe(true);
      expect(peekLayoutFitsViewport(placement, 1440, 900, CAT_SIZE)).toBe(true);
      expect(layout.dimensions).toEqual(peekRootDimensions(placement.edge, CAT_SIZE));
    }
  });

  it('dev peek beats stay-visible stickiness in overlay-side patching', () => {
    const cat = createInitialCat(NOW);
    const sticky = buildPresentation({
      cat,
      vitals: cat.vitals,
      settings: DEFAULT_SETTINGS,
      now: NOW,
      isUserIdle: false,
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      companionVisible: true,
      moodOverride: 'happy',
      stayVisibleUntil: NOW + 120_000,
    });
    const patched = patchPresentationForDevForce(sticky, {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      devForceMood: 'peek',
    }, NOW);

    expect(patched.mood).toBe('peek');
    expect(patched.stayVisibleUntil).toBeNull();
    expect(patched.peekEdge).toBeTruthy();
  });
});
