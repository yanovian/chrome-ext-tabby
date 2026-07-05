import { isTrackableUrl } from './classifier';
import { STORAGE_KEYS } from './types';

/** Stable key for per-page overlay visibility (hostname + pathname). */
export function pageOverlayKey(url: string | undefined): string | null {
  if (!isTrackableUrl(url)) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');
    const pathname = parsed.pathname.replace(/\/$/, '') || '/';
    return `${hostname}${pathname}`;
  } catch {
    return null;
  }
}

async function readHiddenPageKeys(): Promise<string[]> {
  const result = await browser.storage.local.get([STORAGE_KEYS.hiddenPageKeys]);
  const raw = result[STORAGE_KEYS.hiddenPageKeys];
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === 'string') : [];
}

export async function isPageOverlayHidden(url: string | undefined): Promise<boolean> {
  const key = pageOverlayKey(url);
  if (!key) {
    return true;
  }
  const hidden = await readHiddenPageKeys();
  return hidden.includes(key);
}

export async function hidePageOverlay(url: string | undefined): Promise<boolean> {
  const key = pageOverlayKey(url);
  if (!key) {
    return false;
  }
  const hidden = await readHiddenPageKeys();
  if (hidden.includes(key)) {
    return true;
  }
  await browser.storage.local.set({
    [STORAGE_KEYS.hiddenPageKeys]: [...hidden, key],
  });
  return true;
}

export async function showPageOverlay(url: string | undefined): Promise<boolean> {
  const key = pageOverlayKey(url);
  if (!key) {
    return false;
  }
  const hidden = await readHiddenPageKeys();
  if (!hidden.includes(key)) {
    return true;
  }
  await browser.storage.local.set({
    [STORAGE_KEYS.hiddenPageKeys]: hidden.filter((entry) => entry !== key),
  });
  return true;
}

export async function clearAllPageOverlayHides(): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEYS.hiddenPageKeys]: [],
  });
}
