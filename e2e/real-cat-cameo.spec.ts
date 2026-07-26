import { expect, test } from '@playwright/test';
import { DEFAULT_REAL_CAT_HOLD_MS } from '../utils/real-cats';
import { launchExtensionContext, openOverlayPage, readStoredSettings, seedExtensionStorage } from './helpers/extension';

test.describe.configure({ mode: 'serial' });

test('dev-forced real cat photo previews immediately, without waiting for a shoo', async () => {
  test.setTimeout(DEFAULT_REAL_CAT_HOLD_MS + 30_000);
  const { context } = await launchExtensionContext();
  try {
    await seedExtensionStorage(context, {
      settings: {
        devModeEnabled: true,
        devForceMood: 'auto',
        devForceRealCat: 'auto',
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
      },
    });

    const page = await openOverlayPage(context);
    // Wait for the overlay to actually finish mounting (and bind its storage listener) before
    // firing the settings change below — otherwise the change can race ahead of
    // initialize()/sync.bind() and never reach a listener that isn't attached yet.
    await expect(page.locator('#tabby-companion-root')).toBeVisible({ timeout: 20_000 });

    // The dev select only previews on an actual live settings change (mirrors how devForceMood
    // previews) — seeding devForceRealCat directly wouldn't exercise that reaction at all, since
    // the content script's storage listener isn't bound yet when the initial seed lands. This
    // simulates picking a photo from the dev panel after the overlay is already up.
    const worker = context.serviceWorkers()[0]!;
    await worker.evaluate(async () => {
      const { settings } = await chrome.storage.local.get(['settings']);
      await chrome.storage.local.set({
        settings: { ...settings, devForceRealCat: 'funny-cat-bl-1.png' },
      });
    });

    const root = page.locator('#tabby-companion-root');
    const cameo = page.locator('#tabby-real-cat-cameo');
    await expect(cameo).toBeVisible({ timeout: 20_000 });
    await expect(cameo).toHaveAttribute('src', /funny-cat-bl-1\.png$/);

    // Regression: she was still fully on screen (companionVisible: true) when this preview
    // fired — she and the cameo must never both be visible, so her own root has to be hidden
    // for as long as the cameo is up, not just when a natural shoo already ducked her away.
    // Checked via the class itself (not toBeVisible()/toBeHidden()) since devModeEnabled's
    // sped-up ambient timers can otherwise legitimately tear the whole root down mid-test for
    // reasons unrelated to the cameo, which would make a plain visibility assertion flaky.
    await expect(root).toHaveClass(/tabby-root--cameo-active/);

    // Slid fully into place (translate(0, 0), not still off-screen at its enter transform).
    await expect
      .poll(
        async () =>
          cameo.evaluate((node) => getComputedStyle(node).transform),
        { timeout: 5_000 },
      )
      .toMatch(/^(matrix\(1, 0, 0, 1, 0, 0\)|none)$/);

    // Holds (bl-1 has no holdMs override, so DEFAULT_REAL_CAT_HOLD_MS) then slides back out
    // (500ms) — the hide class comes off once it's gone. Read via evaluate rather than a
    // locator assertion: devModeEnabled's sped-up ambient timers can legitimately tear the
    // whole root down for unrelated reasons during this wait, and that's fine here — either
    // the class is gone or the root is, both mean the cameo's restore isn't stuck leaving her
    // wrongly hidden.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document
                .getElementById('tabby-companion-root')
                ?.classList.contains('tabby-root--cameo-active') ?? false,
          ),
        { timeout: DEFAULT_REAL_CAT_HOLD_MS + 5_000 },
      )
      .toBe(false);
  } finally {
    await context.close();
  }
});

test('shoo sends her into a duck gap, then a real cat cameo slides in and back out', async () => {
  // A fresh --load-extension run's install bootstrap can occupy the background's task queue
  // for several seconds (see the similar overrides in extension-peek.spec.ts) — this test
  // runs right after another full extension launch in the same serial run, so give it the
  // same headroom rather than risk the default 60s budget on a slower machine.
  test.setTimeout(90_000);
  const { context } = await launchExtensionContext();
  try {
    // Seeded as a visible shoo-peek first, then flipped into the duck gap via a live storage
    // write below — the cameo trigger (isEnteringShooDuckGap) is an edge detector on a real
    // visible→hidden transition, so it needs a genuine "before" presentation to compare
    // against, not just a duck-gap state seeded as the very first thing the overlay ever sees.
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
        ambientPeekUntil: Date.now() + 60_000,
        peekEdge: 'bottom',
        peekInset: 16,
        peekCorner: 'left',
        lastCareAction: 'shoo',
        stayVisibleUntil: null,
      },
    });

    const page = await openOverlayPage(context);
    const root = page.locator('#tabby-companion-root');
    await expect(root).toHaveClass(/tabby-root--mood-peek/, { timeout: 20_000 });

    const worker = context.serviceWorkers()[0]!;
    await worker.evaluate(async () => {
      const { presentation } = await chrome.storage.local.get(['presentation']);
      await chrome.storage.local.set({
        presentation: {
          ...presentation,
          sprite: 'gif/adult/peek_duck.gif',
          companionVisible: false,
          // Short enough to land well inside this test's timeout, long enough that the cameo
          // is unambiguously scheduled rather than already overdue when it lands.
          ambientPeekUntil: Date.now() + 2_000,
        },
      });
    });

    const cameo = page.locator('#tabby-real-cat-cameo');
    // Not shown yet — still mid-duck-gap.
    await expect(cameo).toHaveCount(0);

    // The duck gap ends ~2s after the write above; the cameo should slide in shortly after.
    await expect(cameo).toBeVisible({ timeout: 10_000 });
    await expect(cameo).toHaveAttribute('src', /real-cats\/funny-cat-/);

    // Holds, then slides back out and removes itself (HOLD_MS=6000 + exit transition).
    await expect(cameo).toHaveCount(0, { timeout: 10_000 });
  } finally {
    await context.close();
  }
});

test('an ordinary ambient duck gap (never shooed) never shows a cameo', async () => {
  const { context } = await launchExtensionContext();
  try {
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
        ambientPeekUntil: Date.now() + 60_000,
        peekEdge: 'bottom',
        peekInset: 16,
        peekCorner: 'left',
        lastCareAction: null,
        stayVisibleUntil: null,
      },
    });

    const page = await openOverlayPage(context);
    const root = page.locator('#tabby-companion-root');
    await expect(root).toHaveClass(/tabby-root--mood-peek/, { timeout: 20_000 });

    const worker = context.serviceWorkers()[0]!;
    await worker.evaluate(async () => {
      const { presentation } = await chrome.storage.local.get(['presentation']);
      await chrome.storage.local.set({
        presentation: {
          ...presentation,
          sprite: 'gif/adult/peek_duck.gif',
          companionVisible: false,
          ambientPeekUntil: Date.now() + 2_000,
        },
      });
    });

    await page.waitForTimeout(4_000);

    await expect(page.locator('#tabby-real-cat-cameo')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('picking a specific real cat in the dev panel also forces peek pose, and still previews', async () => {
  // Lets you compare her own peek corner against the cameo's corner without shooing her
  // separately first. Started from 'auto' (not already 'peek') deliberately: forcing peek and
  // picking the photo land in the very same settings write, and that mood transition must not
  // swallow the cameo-preview trigger the way an earlier version of this logic did.
  test.setTimeout(90_000);
  const { context, extensionId } = await launchExtensionContext();
  try {
    await seedExtensionStorage(context, {
      settings: {
        devModeEnabled: true,
        devForceMood: 'auto',
        devForceRealCat: 'auto',
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
      },
    });

    const overlay = await openOverlayPage(context);
    await expect(overlay.locator('#tabby-companion-root')).toBeVisible({ timeout: 20_000 });

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'load' });
    await expect(popup.locator('#dev-force-mood')).toHaveValue('auto', { timeout: 10_000 });

    await popup.locator('#dev-force-real-cat').selectOption('funny-cat-b-2.png');

    await expect(popup.locator('#dev-force-mood')).toHaveValue('peek', { timeout: 10_000 });

    const worker = context.serviceWorkers()[0]!;
    await expect
      .poll(
        async () => {
          const { settings } = await worker.evaluate(() => chrome.storage.local.get(['settings']));
          return settings.devForceMood;
        },
        { timeout: 10_000 },
      )
      .toBe('peek');

    // The cameo itself must still actually preview, not just the mood forcing.
    await expect(overlay.locator('#tabby-real-cat-cameo')).toBeVisible({ timeout: 20_000 });
  } finally {
    await context.close();
  }
});

test('clicking the real cat cameo dismisses it and reveals her, same as tapping a peek', async () => {
  const { context, extensionId } = await launchExtensionContext();
  try {
    await seedExtensionStorage(context, {
      settings: {
        devModeEnabled: true,
        devForceMood: 'auto',
        devForceRealCat: 'auto',
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
      },
    });

    const page = await openOverlayPage(context);
    await expect(page.locator('#tabby-companion-root')).toBeVisible({ timeout: 20_000 });

    const worker = context.serviceWorkers()[0]!;
    await worker.evaluate(async () => {
      const { settings } = await chrome.storage.local.get(['settings']);
      // funny-cat-bl-1.png has no holdMs override (30s default) — clicking has to be what ends
      // this, not a coincidental natural timeout landing in the same window.
      await chrome.storage.local.set({
        settings: { ...settings, devForceRealCat: 'funny-cat-bl-1.png' },
      });
    });

    const root = page.locator('#tabby-companion-root');
    const cameo = page.locator('#tabby-real-cat-cameo');
    await expect(cameo).toBeVisible({ timeout: 20_000 });
    await expect(root).toHaveClass(/tabby-root--cameo-active/);

    await cameo.click();

    await expect(cameo).toHaveCount(0, { timeout: 5_000 });
    await expect(root).not.toHaveClass(/tabby-root--cameo-active/, { timeout: 5_000 });

    // The dev panel's photo picker must not keep forcing the same photo forever after its
    // one-shot preview is over — both in storage and, since the popup listens for exactly this,
    // in the dropdown itself (opened fresh here specifically to prove it reads the post-reset
    // value, not just that a stale popup instance happened to already be showing it).
    await expect
      .poll(async () => (await readStoredSettings(context)).devForceRealCat)
      .toBe('auto');

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'load' });
    await expect(popup.locator('#dev-force-real-cat')).toHaveValue('auto', { timeout: 10_000 });
  } finally {
    await context.close();
  }
});

test('once a preview cameo naturally finishes, her sprite is left visible again (not stuck hidden)', async () => {
  // Regression: the cameo's own natural-end timer only used to toggle the hide class, with
  // nothing forcing a re-render afterward — fine when nothing else needed to change, but if her
  // root was still the very same one this controller hid (as it is here: she was fully visible
  // when the preview started, so nothing else tears her root down in between), toggling the
  // class was the only thing standing between her and staying invisible. This forces exactly
  // that shape: preview while visible, let it run all the way to its own natural end untouched.
  test.setTimeout(60_000);
  const { context } = await launchExtensionContext();
  try {
    await seedExtensionStorage(context, {
      settings: {
        devModeEnabled: true,
        devForceMood: 'auto',
        devForceRealCat: 'auto',
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
      },
    });

    const page = await openOverlayPage(context);
    await expect(page.locator('#tabby-companion-root')).toBeVisible({ timeout: 20_000 });

    const worker = context.serviceWorkers()[0]!;
    await worker.evaluate(async () => {
      const { settings } = await chrome.storage.local.get(['settings']);
      // funny-cat-b-5-fast.png: holdMs 2_000 — short enough to let this run to its natural end
      // rather than dismissing it, without ballooning the test's runtime.
      await chrome.storage.local.set({
        settings: { ...settings, devForceRealCat: 'funny-cat-b-5-fast.png' },
      });
    });

    const root = page.locator('#tabby-companion-root');
    const cameo = page.locator('#tabby-real-cat-cameo');
    await expect(cameo).toBeVisible({ timeout: 20_000 });
    await expect(root).toHaveClass(/tabby-root--cameo-active/);

    // Let it run all the way out on its own — no click, no other storage write.
    await expect(cameo).toHaveCount(0, { timeout: 10_000 });
    // Not a plain toBeVisible(): devModeEnabled's sped-up ambient timers can legitimately duck
    // her away again for reasons unrelated to the cameo during this wait, tearing the root down
    // entirely — that's fine. What isn't fine is the cameo-active hide class surviving on a
    // root that's still there, which is the one shape that means the fix didn't work.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .getElementById('tabby-companion-root')
              ?.classList.contains('tabby-root--cameo-active') ?? false,
        ),
      )
      .toBe(false);

    // Un-forcing devForceRealCat isn't just a click-time thing — letting the preview run out on
    // its own has to un-force it too, or the dev panel forces the same photo forever the next
    // time devForceRealCat happens to matter.
    await expect
      .poll(async () => (await readStoredSettings(context)).devForceRealCat)
      .toBe('auto');
  } finally {
    await context.close();
  }
});
