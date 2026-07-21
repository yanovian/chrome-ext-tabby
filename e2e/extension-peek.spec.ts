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

    await page.locator('.tabby-cat-surface').click();
    await expect(root).not.toHaveClass(/tabby-root--mood-peek/, { timeout: 20_000 });
    await page.locator('.tabby-cat-surface').click();
    await expect(page.locator('[data-action="shoo"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-action="shoo"]')).not.toHaveClass(/tabby-btn--active/);
  } finally {
    await context.close();
  }
});

test('closing the menu clears the active button highlight', async () => {
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
        ],
      },
    });

    const page = await openOverlayPage(context);
    const root = page.locator('#tabby-companion-root');
    await expect(root).toBeVisible({ timeout: 20_000 });

    await page.locator('.tabby-cat-surface').click();
    const petButton = page.locator('[data-action="pet"]');
    await expect(petButton).toBeVisible({ timeout: 20_000 });
    await petButton.click();
    await expect(petButton).toHaveClass(/tabby-btn--active/, { timeout: 20_000 });

    await page.locator('.tabby-card-close').click();
    await page.locator('.tabby-cat-surface').click();
    await expect(page.locator('[data-action="pet"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-action="pet"]')).not.toHaveClass(/tabby-btn--active/);
  } finally {
    await context.close();
  }
});

test('an ambient peek transition waits until the care menu is closed', async () => {
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
        ],
      },
    });

    const page = await openOverlayPage(context);
    const root = page.locator('#tabby-companion-root');
    await expect(root).toBeVisible({ timeout: 20_000 });
    await page.locator('.tabby-cat-surface').click();
    await expect(page.locator('[data-action="pet"]')).toBeVisible({ timeout: 20_000 });

    const worker = context.serviceWorkers()[0]!;
    await worker.evaluate(async () => {
      const now = Date.now();
      const result = await chrome.storage.local.get(['presentation']);
      const current = result.presentation;
      await chrome.storage.local.set({
        presentation: {
          ...current,
          mood: 'peek',
          sprite: 'gif/adult/peek.gif',
          ambientActivity: 'peeking',
          ambientPeekUntil: now + 60_000,
          peekEdge: 'bottom',
          peekInset: 16,
          peekCorner: 'left',
        },
      });
    });

    await page.waitForTimeout(500);
    await expect(root).not.toHaveClass(/tabby-root--mood-peek/);
    await expect(page.locator('[data-action="pet"]')).toBeVisible();

    await page.locator('.tabby-card-close').click();
    await expect(root).toHaveClass(/tabby-root--mood-peek/, { timeout: 20_000 });
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

test('a real tab switch to an already-open tab does not cancel an active peek', async () => {
  // Unlike the other tests here, this drives a real browser tab switch
  // (page.bringToFront()) instead of the activateOverlayTab shortcut, so it
  // actually exercises background.ts's chrome.tabs.onActivated handler —
  // the one that recomputes presentation on every focus change. With
  // devModeEnabled on, that recompute passes forceDevSpeech: true, which
  // used to make resolveCompanionPresence's forced-visible branch drop the
  // in-progress peek the instant an already-open tab regained focus.
  const { context } = await launchExtensionContext();
  try {
    await seedExtensionStorage(context, {
      settings: {
        devModeEnabled: true,
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

    const pageA = await openOverlayPage(context);
    const pageB = await context.newPage();
    await pageB.goto('https://example.org/', { waitUntil: 'domcontentloaded' });
    await pageA.bringToFront();
    await pageA.waitForTimeout(300);

    await pageA.locator('.tabby-cat-surface').click();
    const shooButton = pageA.locator('[data-action="shoo"]');
    await expect(shooButton).toBeVisible({ timeout: 20_000 });
    await shooButton.click();

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

    // Switch focus to the already-open tab B — a real chrome.tabs.onActivated,
    // not the message-based shortcut the other tests use. The wait is generous
    // because a fresh --load-extension launch runs its own install bootstrap
    // (see seedExtensionStorage's comment) whose retryActiveOverlaySync loop
    // alone can occupy the background's task queue for several seconds; this
    // tab switch is queued behind it and won't run until that drains.
    await pageB.bringToFront();
    await pageB.waitForTimeout(8_000);

    const stored = await worker.evaluate(async () => {
      const result = await chrome.storage.local.get(['presentation']);
      return result.presentation;
    });
    expect(stored?.mood).toBe('peek');
    expect(stored?.ambientActivity).toBe('peeking');
  } finally {
    await context.close();
  }
});

test('a real tab switch does not force ambient speech when none is owed (devModeEnabled on)', async () => {
  // Regression: background.ts's refreshPresentationForActiveTab used to pass
  // forceDevSpeech: IS_DEV_BUILD && settings.devModeEnabled on every single
  // focus change, which bypassed the daily nudge cap/cooldown entirely and
  // made Tabby speak on every tab switch whenever the user's own dev-mode
  // toggle was on — regardless of whether she'd actually earned an ambient
  // line. nudgesToday is seeded past the cap so no legitimate trigger could
  // fire either; any speech appearing here can only be the forced bypass.
  const { context } = await launchExtensionContext();
  try {
    await seedExtensionStorage(context, {
      settings: {
        devModeEnabled: true,
        devForceMood: 'auto',
        showOverlay: true,
      },
      cat: {
        nudgesToday: 999,
      },
      presentation: {
        mood: 'content',
        stage: 'adult',
        sprite: 'gif/adult/idle.gif',
        companionVisible: true,
        speech: null,
        triggerKind: null,
        ambientActivity: null,
        ambientPeekUntil: null,
        peekEdge: null,
        stayVisibleUntil: null,
      },
    });

    const pageA = await openOverlayPage(context);
    const pageB = await context.newPage();
    await pageB.goto('https://example.org/', { waitUntil: 'domcontentloaded' });

    const worker = context.serviceWorkers()[0]!;

    await pageA.bringToFront();
    await pageA.waitForTimeout(8_000);
    await pageB.bringToFront();
    await pageB.waitForTimeout(8_000);

    const stored = await worker.evaluate(async () => {
      const result = await chrome.storage.local.get(['presentation']);
      return result.presentation;
    });
    expect(stored?.speech).toBeNull();
    expect(stored?.triggerKind).toBeNull();
  } finally {
    await context.close();
  }
});
