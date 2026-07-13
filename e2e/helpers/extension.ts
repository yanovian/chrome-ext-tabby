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
  },
): Promise<void> {
  const worker = context.serviceWorkers()[0];
  if (!worker) {
    throw new Error('Extension service worker not available');
  }

  await worker.evaluate(
    async ({ settings, presentation, storageKeys }) => {
      const now = Date.now();
      const dayKey = new Date(now).toISOString().slice(0, 10);
      const adoptedAt = now - 30 * 24 * 60 * 60 * 1000;

      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('tabby', 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains('cat')) {
            database.createObjectStore('cat', { keyPath: 'name' });
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
      await chrome.storage.local.set({
        [storageKeys.settings]: { ...baseSettings, ...settings },
        [storageKeys.introCompleted]: true,
        [storageKeys.presentation]: { ...basePresentation, ...presentation },
      });

      const stored = await chrome.storage.local.get([storageKeys.introCompleted]);
      if (stored[storageKeys.introCompleted] !== true) {
        throw new Error('introCompleted seed failed');
      }

      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'getPresentation' }, () => resolve());
      });
    },
    {
      settings: input.settings ?? {},
      presentation: input.presentation ?? {},
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
