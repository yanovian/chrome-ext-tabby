const OVERLAY_SCRIPT_ID = 'tabby-page-overlay';

/** Paths relative to the extension root (Chrome scripting API). */
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

/** Inject into tabs that need a manual overlay (open tabs after extension reload). */
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

/** Inject the overlay into a tab when Tabby is allowed on that URL. */
export async function ensureOverlayOnTab(
  tab: { id?: number; url?: string },
): Promise<void> {
  if (!tab.id || !canShowOverlayOnUrl(tab.url)) {
    return;
  }

  await injectPageOverlay(tab.id);
}

export async function ensureOverlayOnAllTabs(): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map((tab) => ensureOverlayOnTab(tab)));
}

// Keep for tests / tooling that referenced the id.
export { OVERLAY_SCRIPT_ID };
