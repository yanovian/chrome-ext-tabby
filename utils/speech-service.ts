import { fallbackSpeech } from './speech-fallback';
import type { SpeechContext } from './speech-types';
import { SPEECH_GENERATION_TIMEOUT_MS } from './speech-types';

const OFFSCREEN_PATH = 'offscreen.html';
const WARM_RETRY_ATTEMPTS = 5;
const WARM_RETRY_DELAY_MS = 250;

async function hasOffscreenDocument(): Promise<boolean> {
  if (!chrome.offscreen?.hasDocument) {
    return false;
  }
  return chrome.offscreen.hasDocument();
}

export async function ensureOffscreenSpeechEngine(): Promise<void> {
  if (!chrome.offscreen?.createDocument) {
    return;
  }

  if (await hasOffscreenDocument()) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL(OFFSCREEN_PATH),
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: 'Run Tabby’s bundled local speech model without network access.',
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(new Error('Speech generation timed out'));
    }, timeoutMs);

    promise
      .then((value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        globalThis.clearTimeout(timer);
        reject(error);
      });
  });
}

async function warmOffscreenSpeechEngine(): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < WARM_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await ensureOffscreenSpeechEngine();
      const response = (await browser.runtime.sendMessage({
        type: 'speech:warm',
      })) as { ok?: boolean; error?: string };

      if (response?.ok) {
        return;
      }

      lastError = new Error(response?.error ?? 'Offscreen warm-up failed');
    } catch (error) {
      lastError = error;
    }

    if (attempt < WARM_RETRY_ATTEMPTS - 1) {
      await sleep(WARM_RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Offscreen warm-up failed');
}

async function requestOffscreenSpeech(context: SpeechContext): Promise<string | null> {
  await warmOffscreenSpeechEngine();

  const response = (await browser.runtime.sendMessage({
    type: 'speech:generate',
    context,
  })) as { ok: boolean; text?: string | null; error?: string };

  if (!response?.ok) {
    throw new Error(response?.error ?? 'Offscreen speech failed');
  }

  return response.text ?? null;
}

/** Generate Tabby’s line locally, falling back to curated text if needed. */
export async function generateTabbySpeech(
  context: SpeechContext,
  options: {
    enabled?: boolean;
    fallback?: (context: SpeechContext) => string;
  } = {},
): Promise<string> {
  const resolveFallback = options.fallback ?? fallbackSpeech;

  if (options.enabled === false) {
    return resolveFallback(context);
  }

  try {
    const text = await withTimeout(
      requestOffscreenSpeech(context),
      SPEECH_GENERATION_TIMEOUT_MS,
    );
    if (text) {
      return text;
    }
  } catch (error) {
    console.warn('[Tabby] Local speech unavailable, using fallback.', error);
  }

  return resolveFallback(context);
}

export async function preloadSpeechEngine(): Promise<void> {
  try {
    await warmOffscreenSpeechEngine();
  } catch (error) {
    console.warn('[Tabby] Could not preload speech engine.', error);
  }
}
