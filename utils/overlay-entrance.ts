export const COMPANION_ENTER_MS = 360;
export const COMPANION_EXIT_MS = 240;
export const COMPANION_MENU_ENTER_MS = 280;
export const COMPANION_REACT_MS = 280;
export const COMPANION_MENU_STAGGER_MS = 100;
export const COMPANION_MOOD_OUT_MS = 140;
export const COMPANION_MOOD_IN_MS = 180;

export const OVERLAY_ENTER_CLASS = 'tabby-root--enter';
export const OVERLAY_EXIT_CLASS = 'tabby-root--exiting';
export const MENU_ENTER_CLASS = 'tabby-menu-area--enter';
export const CAT_REACT_CLASS = 'tabby-cat--react';
export const CAT_MOOD_OUT_CLASS = 'tabby-cat--mood-out';
export const CAT_MOOD_IN_CLASS = 'tabby-cat--mood-in';

export const COMPANION_ENTER_ANIMATION = 'tabby-cat-enter';
export const COMPANION_EXIT_ANIMATION = 'tabby-cat-exit';
export const COMPANION_MOOD_OUT_ANIMATION = 'tabby-mood-out';
export const COMPANION_MOOD_IN_ANIMATION = 'tabby-mood-in';

/** Warm up the companion animation before the overlay mounts. */
export async function preloadCompanionSprite(
  resolveUrl: (path: string) => string,
  assetPath: string,
  timeoutMs = 2500,
): Promise<void> {
  const { preloadCompanionAnimation } = await import('./lottie-companion');
  await preloadCompanionAnimation(resolveUrl, assetPath, timeoutMs);
}

export function waitForOverlayAnimation(
  element: HTMLElement,
  animationName: string,
  fallbackMs: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;

    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      element.removeEventListener('animationend', onAnimationEnd);
      globalThis.clearTimeout(timer);
      resolve();
    };

    const onAnimationEnd = (event: AnimationEvent): void => {
      if (event.animationName === animationName) {
        finish();
      }
    };

    const timer = globalThis.setTimeout(finish, fallbackMs + 50);
    element.addEventListener('animationend', onAnimationEnd);
  });
}

/** Whether a speech trigger should play the attention animation on an existing cat. */
export function shouldReactToSpeechTrigger(input: {
  previousSpeech: string | null;
  nextSpeech: string | null;
  triggerKind: string | null;
}): boolean {
  return Boolean(
    input.triggerKind &&
      input.nextSpeech &&
      input.nextSpeech !== input.previousSpeech,
  );
}

/** Whether the sprite should crossfade instead of swapping instantly. */
export function shouldAnimateMoodTransition(input: {
  previousSprite: string | null;
  nextSprite: string;
  hasVisibleOverlay: boolean;
}): boolean {
  return Boolean(
    input.hasVisibleOverlay &&
      input.previousSprite &&
      input.previousSprite !== input.nextSprite,
  );
}
