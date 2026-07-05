export const COMPANION_ENTER_MS = 520;
export const COMPANION_EXIT_MS = 320;
export const COMPANION_MENU_ENTER_MS = 400;
export const COMPANION_REACT_MS = 480;
export const COMPANION_MENU_STAGGER_MS = 180;

export const OVERLAY_ENTER_CLASS = 'tabby-root--enter';
export const OVERLAY_EXIT_CLASS = 'tabby-root--exiting';
export const MENU_ENTER_CLASS = 'tabby-menu-area--enter';
export const CAT_REACT_CLASS = 'tabby-cat--react';

export const COMPANION_ENTER_ANIMATION = 'tabby-cat-enter';
export const COMPANION_EXIT_ANIMATION = 'tabby-cat-exit';

/** Warm up the sprite so the cat does not pop in after the overlay mounts. */
export async function preloadCompanionSprite(
  resolveUrl: (path: string) => string,
  spritePath: string,
  timeoutMs = 2500,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const image = new Image();
    let settled = false;

    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      globalThis.clearTimeout(timer);
      resolve();
    };

    const timer = globalThis.setTimeout(finish, timeoutMs);
    image.onload = finish;
    image.onerror = finish;
    image.src = resolveUrl(spritePath);
  });
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
