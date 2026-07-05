import { describe, expect, it } from 'vitest';
import {
  clampOverlayPosition,
  defaultOverlayPosition,
  isDefaultOverlayPosition,
  MENU_WIDTH_MAX,
  resolveAnchoredPosition,
  resolveMenuLayout,
  resolveMenuPlacement,
  resolveVerticalMenuGeometry,
} from '../utils/overlay-position';

describe('overlay-position', () => {
  it('anchors the cat to the bottom-right corner by default', () => {
    const resolved = resolveAnchoredPosition(
      defaultOverlayPosition(),
      1200,
      800,
      112,
      112,
    );

    expect(resolved.x).toBe(1068);
    expect(resolved.y).toBe(668);
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

  it('opens above the default bottom-right cat instead of forcing sideways', () => {
    expect(
      resolveMenuPlacement({
        ...base,
        catX: 1068,
        catY: 668,
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
      catX: 1068,
      catY: 668,
      catWidth: 112,
      catHeight: 112,
      menuWidth: 220,
      menuHeight: 260,
      viewportWidth: 1200,
      viewportHeight: 800,
    });

    expect(geometry?.width).toBe(MENU_WIDTH_MAX);
    expect(geometry?.offsetX).toBeLessThan(0);
  });
});
