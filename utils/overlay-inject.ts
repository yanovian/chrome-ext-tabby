const LEGACY_OVERLAY_SCRIPT_ID = 'tabby-page-overlay';

const CONTENT_SCRIPT_JS = '/content-scripts/content.js' as const;
const CONTENT_SCRIPT_CSS = '/content-scripts/content.css' as const;

const BLOCKED_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'devtools://',
  'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com',
];

/** Pages where Tabby can appear as a floating companion. */
export function canShowOverlayOnUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  if (url === 'about:blank') {
    return true;
  }
  return !BLOCKED_PREFIXES.some((prefix) => url.startsWith(prefix));
}

/**
 * Remove the old runtime content-script registration so WXT dev hot reload
 * can manage content scripts without duplicate injections.
 */
export async function unregisterLegacyPageOverlayScript(): Promise<void> {
  if (!browser.scripting?.unregisterContentScripts) {
    return;
  }

  try {
    await browser.scripting.unregisterContentScripts({
      ids: [LEGACY_OVERLAY_SCRIPT_ID],
    });
  } catch {
    // Nothing to clean up.
  }
}

/** Inject into tabs that manifest content scripts skip (e.g. about:blank). Safe to call repeatedly. */
export async function injectPageOverlay(tabId: number): Promise<void> {
  if (!browser.scripting?.insertCSS || !browser.scripting?.executeScript) {
    return;
  }

  try {
    await browser.scripting.insertCSS({
      target: { tabId },
      files: [CONTENT_SCRIPT_CSS],
    });
    await browser.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_JS],
    });
  } catch {
    // Tab cannot be scripted (Web Store, etc.) or script is already present.
  }
}

export async function ensureOverlayOnTab(
  tab: { id?: number; url?: string },
): Promise<void> {
  if (!tab.id || !canShowOverlayOnUrl(tab.url)) {
    return;
  }

  if (tab.url === 'about:blank') {
    await injectPageOverlay(tab.id);
  }
}

export async function ensureOverlayOnAllTabs(): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map((tab) => ensureOverlayOnTab(tab)));
}
