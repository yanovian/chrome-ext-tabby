import type {
  CareAction,
  CatPresentation,
  ExtensionSettings,
  PageOverlayState,
  RuntimeMessage,
  RuntimeResponse,
} from './types';

async function sendMessage<T>(message: RuntimeMessage): Promise<T> {
  const response = (await browser.runtime.sendMessage(message)) as RuntimeResponse<T>;

  if (!response || response.ok !== true) {
    throw new Error(
      response && 'error' in response
        ? response.error
        : 'Tabby is unavailable. Try reloading the extension.',
    );
  }

  return response.data as T;
}

export function requestPresentation(): Promise<CatPresentation> {
  return sendMessage<CatPresentation>({ type: 'getPresentation' });
}

export function requestSettings(): Promise<ExtensionSettings> {
  return sendMessage<ExtensionSettings>({ type: 'getSettings' });
}

export function requestSaveSettings(
  settings: Partial<ExtensionSettings>,
): Promise<ExtensionSettings> {
  return sendMessage<ExtensionSettings>({ type: 'saveSettings', settings });
}

export function requestCareAction(
  action: CareAction,
  url?: string,
): Promise<CatPresentation> {
  return sendMessage<CatPresentation>({ type: 'careAction', action, url });
}

export function requestResetIntro(): Promise<void> {
  return sendMessage<void>({ type: 'resetIntro' });
}

export function requestPageOverlayState(url?: string): Promise<PageOverlayState> {
  return sendMessage<PageOverlayState>({ type: 'getPageOverlayState', url });
}

export function requestShowOverlayOnPage(url?: string, title?: string): Promise<CatPresentation> {
  return sendMessage<CatPresentation>({ type: 'showOverlay', url, title });
}

export function requestHideOverlayOnPage(url?: string): Promise<CatPresentation> {
  return sendMessage<CatPresentation>({ type: 'hideOverlay', url });
}

export function requestSyncActiveOverlay(): Promise<void> {
  return sendMessage<void>({ type: 'syncActiveOverlay' });
}

export function requestIsActiveOverlayTab(): Promise<{ active: boolean }> {
  return sendMessage<{ active: boolean }>({ type: 'isActiveOverlayTab' });
}

export async function pingBackground(): Promise<void> {
  try {
    await browser.runtime.sendMessage({ type: 'ping' } satisfies RuntimeMessage);
  } catch {
    // Background may be asleep.
  }
}

/** Resolve a packaged public asset path to a runtime URL. */
export function publicAssetUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return (browser.runtime.getURL as (assetPath: string) => string)(normalized);
}
