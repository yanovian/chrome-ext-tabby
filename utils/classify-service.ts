import { ensureOffscreenSpeechEngine } from './speech-service';

const CLASSIFY_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(new Error('Classification timed out'));
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

/** Ask the bundled local model to refine a low-confidence heuristic guess. */
export async function refineClassificationWithLocalAi(input: {
  title: string;
  url: string;
  enabled: boolean;
}): Promise<import('./types').BrowseCategory | null> {
  if (!input.enabled) {
    return null;
  }

  try {
    await ensureOffscreenSpeechEngine();
    const response = (await withTimeout(
      browser.runtime.sendMessage({
        type: 'classify:generate',
        title: input.title,
        url: input.url,
      }),
      CLASSIFY_TIMEOUT_MS,
    )) as { ok?: boolean; category?: import('./types').BrowseCategory; error?: string };

    if (response?.ok && response.category) {
      return response.category;
    }
  } catch (error) {
    console.warn('[Tabby] Local classification unavailable.', error);
  }

  return null;
}
