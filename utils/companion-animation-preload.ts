/** Warm up an animation JSON before showing the overlay. */
export async function preloadCompanionAnimation(
  resolveUrl: (path: string) => string,
  assetPath: string,
  timeoutMs = 2500,
): Promise<void> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(resolveUrl(assetPath), { signal: controller.signal });
  } catch {
    // Best-effort preload.
  } finally {
    globalThis.clearTimeout(timer);
  }
}
