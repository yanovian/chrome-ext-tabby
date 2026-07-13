import type { Page } from '@playwright/test';
import { resolvePeekLayout, type PeekEdge } from './overlay-layout';

const CAT_SIZE = 192;

export function peekHarnessHtml(edge: PeekEdge): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: #2b2b2b; }
    #tabby-companion-root {
      position: fixed;
      overflow: hidden;
      box-sizing: border-box;
      background: rgba(255, 0, 0, 0.08);
    }
    .tabby-panel {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .tabby-cat-surface {
      position: absolute;
      overflow: visible;
    }
    .tabby-cat {
      display: block;
      width: ${CAT_SIZE}px;
      height: ${CAT_SIZE}px;
      background: linear-gradient(135deg, #ff9a3c 55%, #ffd56a 55%);
      border-radius: 12px;
    }
  </style>
</head>
<body>
  <div id="tabby-companion-root" class="tabby-root tabby-root--mood-peek tabby-root--peek-edge-${edge}">
    <div class="tabby-panel">
      <div class="tabby-cat-surface" id="surface">
        <div class="tabby-cat" id="cat"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function mountPeekHarness(page: Page, edge: PeekEdge): Promise<void> {
  const layout = resolvePeekLayout(
    { edge, inset: 16, corner: 'left' },
    1280,
    800,
    CAT_SIZE,
  );

  await page.setContent(peekHarnessHtml(edge), { waitUntil: 'domcontentloaded' });
  await page.evaluate((cfg) => {
    const root = document.getElementById('tabby-companion-root');
    const surface = document.getElementById('surface');
    if (!root || !surface) {
      throw new Error('peek harness nodes missing');
    }
    root.style.left = `${cfg.position.x}px`;
    root.style.top = `${cfg.position.y}px`;
    root.style.width = `${cfg.dimensions.width}px`;
    root.style.height = `${cfg.dimensions.height}px`;
    surface.style.width = `${cfg.surface.width}px`;
    surface.style.height = `${cfg.surface.height}px`;
    surface.style.left = cfg.surface.left;
    surface.style.right = cfg.surface.right;
    surface.style.top = cfg.surface.top;
    surface.style.bottom = cfg.surface.bottom;
    surface.style.transformOrigin = cfg.surface.transformOrigin;
    surface.style.transform = cfg.surface.transform;
  }, layout);
}

export async function measurePeekVisibility(page: Page): Promise<{
  rootArea: number;
  visibleCatPixels: number;
  centerHitsCat: boolean;
  onScreen: boolean;
}> {
  return page.evaluate(() => {
    const root = document.getElementById('tabby-companion-root');
    const cat = document.getElementById('cat');
    if (!root || !cat) {
      return { rootArea: 0, visibleCatPixels: 0, centerHitsCat: false, onScreen: false };
    }

    const rootRect = root.getBoundingClientRect();
    const catRect = cat.getBoundingClientRect();
    const onScreen =
      rootRect.right > 0 &&
      rootRect.bottom > 0 &&
      rootRect.left < window.innerWidth &&
      rootRect.top < window.innerHeight;

    const cx = rootRect.left + rootRect.width / 2;
    const cy = rootRect.top + rootRect.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const centerHitsCat =
      hit === cat || hit === document.getElementById('surface') || cat.contains(hit);

    const ix0 = Math.max(rootRect.left, catRect.left);
    const ix1 = Math.min(rootRect.right, catRect.right);
    const iy0 = Math.max(rootRect.top, catRect.top);
    const iy1 = Math.min(rootRect.bottom, catRect.bottom);
    const visibleCatPixels = Math.max(0, ix1 - ix0) * Math.max(0, iy1 - iy0);

    return {
      rootArea: rootRect.width * rootRect.height,
      visibleCatPixels,
      centerHitsCat,
      onScreen,
    };
  });
}
