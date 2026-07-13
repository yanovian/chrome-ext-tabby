import { describe, expect, it } from 'vitest';
import {
  clampOverlayPosition,
  clampPeekRootPosition,
  defaultOverlayPosition,
  isDefaultOverlayPosition,
  MENU_WIDTH_MAX,
  peekCatSurfaceLayout,
  peekLayoutFitsViewport,
  peekRootClipPath,
  peekRootDimensions,
  peekSurfaceFillsClipWindow,
  resolveAnchoredPosition,
  resolvePeekLayout,
  resolvePeekPlacementPosition,
  peekVisibleSize,
  resolveMenuLayout,
  resolveMenuPlacement,
  resolveVerticalMenuGeometry,
} from '../utils/overlay-position';
import { pickPeekPlacement } from '../utils/ambient-presence';

describe('overlay-position', () => {
  it('anchors the cat to the bottom-left corner by default', () => {
    const resolved = resolveAnchoredPosition(
      defaultOverlayPosition(),
      1200,
      800,
      132,
      132,
    );

    expect(resolved.x).toBe(16);
    expect(resolved.y).toBe(652);
  });

  it('clamps dragged cat positions inside the viewport', () => {
    const clamped = clampOverlayPosition(
      { x: 5000, y: -100 },
      1200,
      800,
      112,
      112,
    );

    expect(clamped.x).toBe(1088);
    expect(clamped.y).toBe(0);
  });

  it('detects when the user has not moved Tabby yet', () => {
    expect(isDefaultOverlayPosition(defaultOverlayPosition())).toBe(true);
    expect(isDefaultOverlayPosition({ x: 120, y: 300 })).toBe(false);
  });

  it('anchors peek mood at screen edges with insets', () => {
    const catSize = 192;
    const visible = peekVisibleSize(catSize);
    const bottomLeft = resolvePeekPlacementPosition(
      { edge: 'bottom', inset: 12, corner: 'left' },
      1200,
      800,
      catSize,
    );
    const bottomRight = resolvePeekPlacementPosition(
      { edge: 'bottom', inset: 32, corner: 'right' },
      1200,
      800,
      catSize,
    );
    const leftLow = resolvePeekPlacementPosition(
      { edge: 'left', inset: 32, corner: 'left' },
      1200,
      800,
      catSize,
    );
    const leftHigh = resolvePeekPlacementPosition(
      { edge: 'left', inset: 8, corner: 'right' },
      1200,
      800,
      catSize,
    );
    const rightLow = resolvePeekPlacementPosition(
      { edge: 'right', inset: 32, corner: 'left' },
      1200,
      800,
      catSize,
    );
    const rightHigh = resolvePeekPlacementPosition(
      { edge: 'right', inset: 8, corner: 'right' },
      1200,
      800,
      catSize,
    );

    expect(bottomLeft.x).toBe(16);
    expect(bottomLeft.y).toBe(800 - visible);
    expect(bottomRight.x).toBe(1200 - catSize - 32);
    expect(bottomRight.y).toBe(800 - visible);
    expect(leftLow.x).toBe(0);
    expect(leftLow.y).toBe(800 - catSize - 32);
    expect(leftHigh.x).toBe(0);
    expect(leftHigh.y).toBe(16);
    expect(rightLow.x).toBe(1200 - visible);
    expect(rightLow.y).toBe(800 - catSize - 32);
    expect(rightHigh.x).toBe(1200 - visible);
    expect(rightHigh.y).toBe(16);
  });

  it('keeps every peek placement fully inside the viewport after clamping', () => {
    const placements = [
      { edge: 'bottom' as const, inset: 8, corner: 'left' as const },
      { edge: 'bottom' as const, inset: 32, corner: 'right' as const },
      { edge: 'left' as const, inset: 8, corner: 'right' as const },
      { edge: 'left' as const, inset: 32, corner: 'left' as const },
      { edge: 'right' as const, inset: 8, corner: 'right' as const },
      { edge: 'right' as const, inset: 32, corner: 'left' as const },
    ];

    for (const catSize of [132, 162, 192]) {
      for (const viewport of [
        { width: 1200, height: 800 },
        { width: 360, height: 640 },
        { width: 2560, height: 1440 },
      ]) {
        for (const placement of placements) {
          expect(
            peekLayoutFitsViewport(
              placement,
              viewport.width,
              viewport.height,
              catSize,
            ),
          ).toBe(true);
        }
      }
    }
  });

  it('clamps peek roots inside the viewport', () => {
    const catSize = 192;
    const clamped = clampPeekRootPosition(
      { x: 5000, y: -40 },
      peekRootDimensions('bottom', catSize),
      220,
      300,
    );

    expect(clamped.x).toBe(28);
    expect(clamped.y).toBe(0);
  });

  it('rotates left and right peeks about their own center, bottom translates', () => {
    const catSize = 192;
    const visible = peekVisibleSize(catSize);
    const shift = visible - catSize;
    expect(peekCatSurfaceLayout('bottom', catSize)).toMatchObject({
      transformOrigin: 'left top',
      transform: `translateY(${shift}px)`,
    });
    // A corner pivot (the old approach) only rotated a quarter of the
    // sprite into the clip window instead of a full half; pivoting on the
    // surface's own center (no translate needed) fills the whole window.
    expect(peekCatSurfaceLayout('left', catSize)).toMatchObject({
      left: '0',
      right: 'auto',
      bottom: '0',
      transformOrigin: 'center center',
      transform: 'rotate(90deg)',
    });
    expect(peekCatSurfaceLayout('right', catSize)).toMatchObject({
      left: 'auto',
      right: '0',
      bottom: '0',
      transformOrigin: 'center center',
      transform: 'rotate(-90deg)',
    });
  });

  it('keeps rotated side peeks filling the clip window', () => {
    const catSize = 192;
    for (const edge of ['left', 'right', 'bottom'] as const) {
      expect(peekSurfaceFillsClipWindow(edge, catSize)).toBe(true);
      if (edge === 'bottom') {
        expect(peekCatSurfaceLayout(edge, catSize).transform).toMatch(/translate/);
      } else {
        expect(peekCatSurfaceLayout(edge, catSize).transform).toMatch(/rotate/);
        expect(peekCatSurfaceLayout(edge, catSize).transform).not.toMatch(/translate/);
      }
    }
  });

  it('keeps peek roots on screen for repeated placements', () => {
    const catSize = 192;
    const viewportWidth = 1280;
    const viewportHeight = 800;
    for (let seed = 0; seed < 12; seed += 1) {
      const placement = pickPeekPlacement(seed);
      expect(
        peekLayoutFitsViewport(
          placement,
          viewportWidth,
          viewportHeight,
          catSize,
        ),
      ).toBe(true);
      const layout = resolvePeekLayout(
        placement,
        viewportWidth,
        viewportHeight,
        catSize,
      );
      expect(layout.position.x).toBeGreaterThanOrEqual(0);
      expect(layout.position.y).toBeGreaterThanOrEqual(0);
      expect(layout.position.x + layout.dimensions.width).toBeLessThanOrEqual(
        viewportWidth,
      );
      expect(layout.position.y + layout.dimensions.height).toBeLessThanOrEqual(
        viewportHeight,
      );
    }
  });

  it('uses a narrow on-screen strip for side peeks', () => {
    const catSize = 192;
    const visible = peekVisibleSize(catSize);
    expect(peekRootDimensions('left', catSize)).toEqual({
      width: visible,
      height: catSize,
    });
    expect(peekRootDimensions('right', catSize)).toEqual({
      width: visible,
      height: catSize,
    });
    expect(peekRootClipPath('left', catSize)).toBeNull();
    expect(peekRootClipPath('right', catSize)).toBeNull();
    expect(peekRootClipPath('bottom', catSize)).toBeNull();
  });
});

describe('resolveMenuPlacement', () => {
  const base = {
    catWidth: 112,
    catHeight: 112,
    menuWidth: 220,
    menuHeight: 260,
    viewportWidth: 1200,
    viewportHeight: 800,
    gap: 10,
  };

  it('prefers opening above the cat when there is room', () => {
    expect(
      resolveMenuPlacement({
        ...base,
        catX: 600,
        catY: 500,
      }),
    ).toBe('top');
  });

  it('opens above the default bottom-left cat instead of forcing sideways', () => {
    expect(
      resolveMenuPlacement({
        ...base,
        catX: 16,
        catY: 652,
        catWidth: 132,
        catHeight: 132,
      }),
    ).toBe('top');
  });

  it('opens below when the cat is near the top edge', () => {
    expect(
      resolveMenuPlacement({
        ...base,
        catX: 600,
        catY: 40,
      }),
    ).toBe('bottom');
  });

  it('opens below when the cat is in the top-right corner', () => {
    expect(
      resolveMenuPlacement({
        ...base,
        catX: 1050,
        catY: 40,
      }),
    ).toBe('bottom');
  });

  it('opens above on a large screen when the cat sits in the bottom-right', () => {
    expect(
      resolveMenuPlacement({
        ...base,
        catX: 2410,
        catY: 1868,
        viewportWidth: 2560,
        viewportHeight: 2000,
      }),
    ).toBe('top');
  });
});

describe('resolveMenuLayout', () => {
  const base = {
    catWidth: 112,
    catHeight: 112,
    menuWidth: 220,
    menuHeight: 260,
    viewportWidth: 2560,
    viewportHeight: 1440,
    gap: 10,
  };

  it('uses a wider menu above the cat on large screens', () => {
    const layout = resolveMenuLayout({
      ...base,
      catX: 2410,
      catY: 1308,
    });

    expect(layout.placement).toBe('top');
    expect(layout.width).toBe(MENU_WIDTH_MAX);
    expect(layout.width).toBeLessThanOrEqual(240);
    expect(layout.offsetX).toBeLessThan(0);
  });
});

describe('resolveVerticalMenuGeometry', () => {
  it('grows the menu leftward when the cat is on the right edge', () => {
    const geometry = resolveVerticalMenuGeometry({
      catX: 1048,
      catY: 648,
      catWidth: 132,
      catHeight: 132,
      menuWidth: 220,
      menuHeight: 260,
      viewportWidth: 1200,
      viewportHeight: 800,
    });

    expect(geometry?.width).toBe(MENU_WIDTH_MAX);
    expect(geometry?.offsetX).toBeLessThan(0);
  });
});
