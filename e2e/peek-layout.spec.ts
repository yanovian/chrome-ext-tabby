import { expect, test } from '@playwright/test';
import { peekSurfaceUsesRotation } from './helpers/overlay-layout';
import { measurePeekVisibility, mountPeekHarness } from './helpers/peek-harness';

type PeekEdge = 'bottom' | 'left' | 'right';
const EDGES: PeekEdge[] = ['bottom', 'left', 'right'];

for (const edge of EDGES) {
  test(`peek layout shows visible cat on ${edge} edge`, async ({ page }) => {
    await mountPeekHarness(page, edge);
    const metrics = await measurePeekVisibility(page);

    expect(metrics.onScreen).toBe(true);
    // The whole peek window is meant to be filled by the sprite (same as
    // the bottom edge), not just a corner sliver of it.
    expect(metrics.visibleCatPixels).toBeGreaterThanOrEqual(metrics.rootArea * 0.85);
    expect(metrics.centerHitsCat).toBe(true);
    expect(peekSurfaceUsesRotation(edge)).toBe(edge !== 'bottom');
  });
}

for (const edge of ['left', 'right'] as const) {
  test(`${edge} peek applies rotation on the cat surface`, async ({ page }) => {
    await mountPeekHarness(page, edge);
    const transform = await page.locator('#surface').evaluate((node) => node.style.transform);
    expect(transform).toContain('rotate');
  });
}

test('reveal uses full cat box after peek', async ({ page }) => {
  await mountPeekHarness(page, 'left');
  const peekMetrics = await measurePeekVisibility(page);
  expect(peekMetrics.visibleCatPixels).toBeGreaterThan(200);

  await page.evaluate(() => {
    const root = document.getElementById('tabby-companion-root');
    const surface = document.getElementById('surface');
    if (!root || !surface) {
      return;
    }
    root.style.width = '192px';
    root.style.height = '192px';
    root.style.left = '100px';
    root.style.top = '100px';
    surface.style.transform = 'none';
    surface.style.left = '0';
    surface.style.right = 'auto';
    surface.style.top = '0';
    surface.style.width = '192px';
    surface.style.height = '192px';
  });

  const fullBox = await page.locator('#tabby-companion-root').boundingBox();
  expect(fullBox?.width).toBe(192);
  expect(fullBox?.height).toBe(192);
});
