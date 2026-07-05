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

/**
 * Register the overlay content script at runtime.
 *
 * WXT omits manifest content scripts in MV3 dev builds and normally re-injects
 * them over a dev-server WebSocket. That breaks when the service worker reloads
 * before the socket reconnects (or when loading unpacked manually). Runtime
 * registration keeps Tabby on the page through extension reloads.
 */
export async function registerPageOverlayScript(): Promise<void> {
  if (!browser.scripting?.registerContentScripts) {
    return;
  }

  try {
    await browser.scripting.unregisterContentScripts({
      ids: [OVERLAY_SCRIPT_ID],
    });
  } catch {
    // Nothing to clean up.
  }

  await browser.scripting.registerContentScripts([
    {
      id: OVERLAY_SCRIPT_ID,
      matches: ['http://*/*', 'https://*/*', 'file://*/*'],
      excludeMatches: [
        '*://chrome.google.com/webstore/*',
        '*://chromewebstore.google.com/*',
      ],
      js: [CONTENT_SCRIPT_JS],
      css: [CONTENT_SCRIPT_CSS],
      runAt: 'document_idle',
    },
  ]);
}

/** Inject into tabs that need a manual overlay (runtime dev registration, about:blank). */
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
  options: { injectIfNeeded?: boolean } = {},
): Promise<void> {
  if (!tab.id || !canShowOverlayOnUrl(tab.url)) {
    return;
  }

  if (options.injectIfNeeded || tab.url === 'about:blank') {
    await injectPageOverlay(tab.id);
  }
}

export async function ensureOverlayOnAllTabs(
  options: { injectIfNeeded?: boolean } = {},
): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map((tab) => ensureOverlayOnTab(tab, options)));
}
