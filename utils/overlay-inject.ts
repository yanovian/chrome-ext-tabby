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

const OVERLAY_CONTENT_SCRIPT = {
  id: OVERLAY_SCRIPT_ID,
  matches: ['http://*/*', 'https://*/*', 'file://*/*'],
  excludeMatches: [
    '*://chrome.google.com/webstore/*',
    '*://chromewebstore.google.com/*',
  ],
  js: [CONTENT_SCRIPT_JS],
  css: [CONTENT_SCRIPT_CSS],
  runAt: 'document_idle' as const,
};

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

function isDuplicateScriptError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Duplicate script ID');
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

  const registered = await browser.scripting.getRegisteredContentScripts();
  if (registered.some((script) => script.id === OVERLAY_SCRIPT_ID)) {
    if (browser.scripting.updateContentScripts) {
      try {
        await browser.scripting.updateContentScripts([OVERLAY_CONTENT_SCRIPT]);
      } catch {
        // Existing registration is good enough.
      }
    }
    return;
  }

  try {
    await browser.scripting.registerContentScripts([OVERLAY_CONTENT_SCRIPT]);
  } catch (error) {
    if (isDuplicateScriptError(error)) {
      return;
    }
    throw error;
  }
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
