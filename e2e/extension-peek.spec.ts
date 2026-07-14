import { expect, test } from '@playwright/test';
import {
  launchExtensionContext,
  openOverlayPage,
  seedExtensionStorage,
} from './helpers/extension';

test.describe.configure({ mode: 'serial' });

test('dev peek override beats stay-visible stickiness in storage', async () => {
  const { context } = await launchExtensionContext();
  try {
    const now = Date.now();
    await seedExtensionStorage(context, {
      settings: {
        devModeEnabled: true,
        devForceMood: 'peek',
        showOverlay: true,
      },
      presentation: {
        mood: 'happy',
        sprite: 'gif/adult/happy.gif',
        stayVisibleUntil: now + 120_000,
        companionVisible: true,
        peekEdge: null,
        ambientActivity: null,
      },
    });

    await openOverlayPage(context);

    const worker = context.serviceWorkers()[0]!;
    await expect
      .poll(
        async () => {
          const stored = await worker.evaluate(async () => {
            const result = await chrome.storage.local.get(['presentation']);
            return result.presentation;
          });
          return stored?.mood;
        },
        { timeout: 20_000 },
      )
      .toBe('peek');

    const stored = await worker.evaluate(async () => {
      const result = await chrome.storage.local.get(['presentation']);
      return result.presentation;
    });
    expect(stored?.stayVisibleUntil).toBeNull();
  } finally {
    await context.close();
  }
});

test('extension overlay renders dev-forced left peek with rotated surface', async () => {
  const { context } = await launchExtensionContext();
  try {
    await seedExtensionStorage(context, {
      settings: {
        devModeEnabled: true,
        devForceMood: 'peek',
        devForceLifeStage: 'adult',
        showOverlay: true,
      },
      presentation: {
        mood: 'peek',
        stage: 'adult',
        sprite: 'gif/adult/peek.gif',
        companionVisible: true,
        peekEdge: 'left',
        peekInset: 16,
        peekCorner: 'left',
        ambientActivity: null,
        ambientPeekUntil: null,
        stayVisibleUntil: null,
      },
    });

    const page = await openOverlayPage(context);
    const root = page.locator('#tabby-companion-root');
    await expect(root).toBeVisible({ timeout: 20_000 });
    await expect(root).toHaveClass(/tabby-root--peek-edge-left/, { timeout: 20_000 });

    const transform = await page.locator('.tabby-cat-surface').evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        transform: style.transform,
        inlineTransform: node.style.transform,
      };
    });
    expect(transform.transform).not.toBe('none');
    expect(transform.transform).toMatch(/matrix/);
    const matrix = transform.transform.match(/matrix\(([^)]+)\)/)?.[1];
    expect(matrix).toBeTruthy();
    const [ , b, c] = matrix!.split(',').map((part) => Number(part.trim()));
    expect(Math.abs(b) + Math.abs(c)).toBeGreaterThan(0.1);
  } finally {
    await context.close();
  }
});

test('clicking a peeking Tabby reveals her previous real mood', async () => {
  const { context } = await launchExtensionContext();
  try {
    const now = Date.now();
    await seedExtensionStorage(context, {
      settings: {
        devModeEnabled: false,
        devForceMood: 'auto',
        showOverlay: true,
      },
      presentation: {
        mood: 'peek',
        stage: 'adult',
        sprite: 'gif/adult/peek.gif',
        companionVisible: true,
        ambientActivity: 'peeking',
        ambientPeekUntil: now + 60_000,
        peekEdge: 'bottom',
        peekInset: 16,
        peekCorner: 'left',
        peekRestoreAmbientActivity: 'grooming',
        peekRestoreAmbientUntil: now + 120_000,
        stayVisibleUntil: null,
      },
    });

    const page = await openOverlayPage(context);
    const root = page.locator('#tabby-companion-root');
    await expect(root).toHaveClass(/tabby-root--mood-peek/, { timeout: 20_000 });

    await page.locator('.tabby-cat-surface').click();

    const worker = context.serviceWorkers()[0]!;
    await expect
      .poll(
        async () => {
          const stored = await worker.evaluate(async () => {
            const result = await chrome.storage.local.get(['presentation']);
            return result.presentation;
          });
          return stored?.mood;
        },
        { timeout: 20_000 },
      )
      .not.toBe('peek');

    const stored = await worker.evaluate(async () => {
      const result = await chrome.storage.local.get(['presentation']);
      return result.presentation;
    });
    expect(stored?.ambientActivity).toBe('grooming');
    expect(stored?.companionVisible).toBe(true);
    expect(stored?.peekEdge).toBeNull();
  } finally {
    await context.close();
  }
});

test('"Go play by yourself" sends Tabby into an edge peek', async () => {
  const { context } = await launchExtensionContext();
  try {
    await seedExtensionStorage(context, {
      settings: {
        devModeEnabled: false,
        devForceMood: 'auto',
        showOverlay: true,
      },
      presentation: {
        mood: 'content',
        stage: 'adult',
        sprite: 'gif/adult/idle.gif',
        companionVisible: true,
        ambientActivity: null,
        ambientPeekUntil: null,
        peekEdge: null,
        stayVisibleUntil: null,
        interactions: [
          { action: 'ask', label: "What's up?", enabled: true },
          { action: 'play', label: 'Play', enabled: true },
          { action: 'pet', label: 'Pet', enabled: true },
          { action: 'shoo', label: 'Go play by yourself', enabled: true },
        ],
      },
    });

    const page = await openOverlayPage(context);
    const root = page.locator('#tabby-companion-root');
    await expect(root).toBeVisible({ timeout: 20_000 });

    await page.locator('.tabby-cat-surface').click();
    const shooButton = page.locator('[data-action="shoo"]');
    await expect(shooButton).toBeVisible({ timeout: 20_000 });
    await shooButton.click();

    await expect(root).toHaveClass(/tabby-root--mood-peek/, { timeout: 20_000 });
    await expect(root).toHaveClass(/tabby-root--peek-edge-(bottom|left|right)/);

    const worker = context.serviceWorkers()[0]!;
    const stored = await worker.evaluate(async () => {
      const result = await chrome.storage.local.get(['presentation']);
      return result.presentation;
    });
    expect(stored?.mood).toBe('peek');
    expect(stored?.ambientActivity).toBe('peeking');
    expect(stored?.companionVisible).toBe(true);
    expect(stored?.lastCareAction).toBe('shoo');
  } finally {
    await context.close();
  }
});

test('extension overlay renders dev-forced peek on screen', async () => {
  const { context } = await launchExtensionContext();
  try {
    await seedExtensionStorage(context, {
      settings: {
        devModeEnabled: true,
        devForceMood: 'peek',
        devForceLifeStage: 'adult',
        showOverlay: true,
      },
      presentation: {
        mood: 'peek',
        stage: 'adult',
        sprite: 'gif/adult/peek.gif',
        companionVisible: true,
        peekEdge: 'bottom',
        peekInset: 16,
        peekCorner: 'left',
        ambientActivity: null,
        ambientPeekUntil: null,
        stayVisibleUntil: null,
      },
    });

    const page = await openOverlayPage(context);
    const root = page.locator('#tabby-companion-root');
    await expect(root).toBeVisible({ timeout: 20_000 });
    await expect(root).toHaveClass(/tabby-root--mood-peek/, { timeout: 20_000 });
    await expect(root).toHaveClass(/tabby-root--peek-edge-(bottom|left|right)/);

    const box = await root.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
    expect(box!.y + box!.height).toBeLessThanOrEqual(800);
  } finally {
    await context.close();
  }
});
