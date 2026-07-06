import type {
  CareAction,
  CatPresentation,
  DoNotDisturbDuration,
  DoNotDisturbStatus,
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

export function requestDoNotDisturbStatus(): Promise<DoNotDisturbStatus> {
  return sendMessage<DoNotDisturbStatus>({ type: 'getDoNotDisturb' });
}

export function requestCancelDoNotDisturb(): Promise<CatPresentation> {
  return sendMessage<CatPresentation>({ type: 'cancelDoNotDisturb' });
}

export function requestSetDoNotDisturb(
  duration: DoNotDisturbDuration,
): Promise<CatPresentation> {
  return sendMessage<CatPresentation>({ type: 'setDoNotDisturb', duration });
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

/** True when running an unpacked dev build (WXT serve). */
export function isDevBuild(): boolean {
  return import.meta.env.DEV === true || import.meta.env.MODE === 'development';
}

/** Append a dev-only cache-bust query (for tests and animation URLs). */
export function appendAnimationCacheBust(url: string, rand: string | null): string {
  if (!rand) {
    return url;
  }
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}rand=${rand}`;
}

/** Resolve companion Lottie JSON. In dev, adds `?rand=…` on every load so JSON is not cached. */
export function publicAnimationAssetUrl(path: string): string {
  const url = publicAssetUrl(path);
  if (!isDevBuild()) {
    return url;
  }
  const rand = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return appendAnimationCacheBust(url, rand);
}
