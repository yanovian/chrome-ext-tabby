/** Warm up a companion GIF before showing the overlay. */
export async function preloadCompanionAnimation(
  resolveUrl: (path: string) => string,
  assetPath: string,
  timeoutMs = 2500,
): Promise<void> {
  if (typeof Image === 'undefined') {
    return;
  }

  await new Promise<void>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      image.onload = null;
      image.onerror = null;
      globalThis.clearTimeout(timer);
      resolve();
    };

    const timer = globalThis.setTimeout(finish, timeoutMs);
    image.onload = finish;
    image.onerror = finish;
    image.src = resolveUrl(assetPath);
  });
}
