import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BUILD_DIRS = ['.output/chrome-mv3-dev', '.output/chrome-mv3'];

const STORAGE_KEYS = {
  settings: 'settings',
  presentation: 'presentation',
  introCompleted: 'introCompleted',
} as const;

export function resolveExtensionPath(): string {
  for (const dir of BUILD_DIRS) {
    const full = join(process.cwd(), dir);
    if (existsSync(join(full, 'manifest.json'))) {
      return full;
    }
  }
  throw new Error('Extension build not found. Run `pnpm build` first.');
}

export async function launchExtensionContext(): Promise<{
  context: BrowserContext;
  extensionId: string;
}> {
  const extensionPath = resolveExtensionPath();
  const userDataDir = mkdtempSync(join(tmpdir(), 'tabby-pw-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }

  const extensionId = new URL(serviceWorker.url()).host;
  return { context, extensionId };
}

export async function seedExtensionStorage(
  context: BrowserContext,
  input: {
    settings?: Record<string, unknown>;
    presentation?: Record<string, unknown>;
    cat?: Record<string, unknown>;
  },
): Promise<void> {
  const worker = context.serviceWorkers()[0];
  if (!worker) {
    throw new Error('Extension service worker not available');
  }

  await worker.evaluate(
    async ({ settings, presentation, cat, storageKeys }) => {
      const now = Date.now();
      const dayKey = new Date(now).toISOString().slice(0, 10);
      const adoptedAt = now - 30 * 24 * 60 * 60 * 1000;

      await new Promise<void>((resolve, reject) => {
        // Must match utils/types.ts DB (same name/version): opening at the
        // same version means the real extension code never gets its own
        // onupgradeneeded call, so any store missing here stays missing —
        // getMemories()/appendObservation() then throw NotFoundError.
        const request = indexedDB.open('tabby', 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains('cat')) {
            database.createObjectStore('cat', { keyPath: 'name' });
          }
          if (!database.objectStoreNames.contains('memories')) {
            database.createObjectStore('memories', { keyPath: 'id' });
          }
          if (!database.objectStoreNames.contains('observations')) {
            const observations = database.createObjectStore('observations', {
              keyPath: 'id',
            });
            observations.createIndex('observedAt', 'observedAt', { unique: false });
          }
        };
        request.onsuccess = () => {
          const database = request.result;
          const tx = database.transaction('cat', 'readwrite');
          tx.objectStore('cat').put({
            name: 'Tabby',
            adoptedAt,
            stage: 'adult',
            vitals: { hunger: 35, happiness: 70, stress: 15, energy: 80 },
            lastCareAt: now,
            satiatedUntil: 0,
            happyUntil: 0,
            lastSeenAt: now,
            lastSpeechAt: 0,
            nudgesToday: 0,
            nudgesDayKey: dayKey,
            mischiefCooldownAt: 0,
            lastAmbientAt: 0,
            ambientsToday: 0,
            ambientsDayKey: dayKey,
            ...cat,
          });
          tx.oncomplete = () => {
            database.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });

      const baseSettings = {
        locale: 'en',
        showOverlay: true,
        quietHoursStart: 22,
        quietHoursEnd: 7,
        maxAppearancesPerDay: 8,
        appearanceCooldownMinutes: 45,
        devModeEnabled: false,
        devMaxAppearancesPerDay: 50,
        devAppearanceCooldownMinutes: 1,
        devStatMultiplier: 5,
        devMinTabDurationMs: 1000,
        devForceLifeStage: 'adult',
        devForceMood: 'auto',
        devSimulatedDrainingMs: 0,
        devSimulatedRecoveryAwayMs: 0,
        devTemperScenario: 'on_feed',
      };
      const basePresentation = {
        mood: 'content',
        stage: 'adult',
        stageLabel: 'Adult',
        sprite: 'gif/adult/idle.gif',
        speech: null,
        triggerKind: null,
        overlayHidden: false,
        canPet: true,
        canTreat: false,
        canPlay: false,
        interactions: [],
        secondaryInteractions: [],
        lastCareAction: null,
        companionVisible: true,
        ambientActivity: null,
        ambientPeekUntil: null,
        peekEdge: null,
        peekInset: null,
        peekCorner: null,
        peekRestoreAmbientActivity: null,
        peekRestoreAmbientUntil: null,
        stayVisibleUntil: null,
        eatingUntil: null,
        playingUntil: null,
      };
      const seed = async () => {
        await chrome.storage.local.set({
          [storageKeys.settings]: { ...baseSettings, ...settings },
          [storageKeys.introCompleted]: true,
          [storageKeys.presentation]: { ...basePresentation, ...presentation },
        });
      };
      await seed();

      const stored = await chrome.storage.local.get([storageKeys.introCompleted]);
      if (stored[storageKeys.introCompleted] !== true) {
        throw new Error('introCompleted seed failed');
      }

      // A fresh --load-extension launch fires the real onInstalled bootstrap
      // (entrypoints/background.ts bootstrap()/bootstrapInstall()), which
      // independently computes and persists its own initial presentation —
      // unserialized against this seed. If it finishes after this point it
      // silently clobbers the state the test depends on, so re-seed once
      // more after giving it a moment to land.
      await new Promise((resolve) => setTimeout(resolve, 500));
      await seed();

      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'getPresentation' }, () => resolve());
      });
    },
    {
      settings: input.settings ?? {},
      presentation: input.presentation ?? {},
      cat: input.cat ?? {},
      storageKeys: STORAGE_KEYS,
    },
  );
}

export async function openOverlayPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
  await activateOverlayTab(context);
  return page;
}

async function activateOverlayTab(context: BrowserContext): Promise<void> {
  const worker = context.serviceWorkers()[0];
  if (!worker) {
    throw new Error('Extension service worker not available');
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const activated = await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id) {
        return false;
      }
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'overlayActivate' });
        return true;
      } catch {
        return false;
      }
    });
    if (activated) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Could not activate overlay tab');
}
