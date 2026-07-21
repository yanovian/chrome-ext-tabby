import { CompanionGifPlayer } from '../../../utils/gif-companion';
import { peekDuckAnimationPath } from '../../../utils/companion-animation';
import { preloadCompanionSprite } from '../../../utils/overlay-entrance';
import {
  CAT_MOOD_IN_CLASS,
  CAT_MOOD_OUT_CLASS,
  CAT_REACT_CLASS,
  COMPANION_MOOD_IN_ANIMATION,
  COMPANION_MOOD_IN_MS,
  COMPANION_MOOD_OUT_ANIMATION,
  COMPANION_MOOD_OUT_MS,
  COMPANION_REACT_MS,
  waitForOverlayAnimation,
} from '../../../utils/overlay-entrance';
import { publicAnimationAssetUrl } from '../../../utils/runtime-client';
import type { CatPresentation } from '../../../utils/types';

export const PEEK_DUCK_EXIT_MS = 540;

/**
 * Owns the cat's GIF player and every animation that plays on it: initial sprite load, the
 * mood-change cross-fade, the reaction bounce, and the peek "duck away" exit. Nothing outside
 * this file touches the player directly — everyone else just asks for the image element.
 */
export class OverlayTransitions {
  private catPlayer: CompanionGifPlayer | null = null;
  private moodTransitionToken = 0;

  getCatElement(): HTMLImageElement | null {
    return this.catPlayer?.image ?? null;
  }

  hasPlayer(): boolean {
    return this.catPlayer !== null;
  }

  /** Create the player and mount its image into the given surface. Called once per fresh
   * DOM mount (see buildRoot). */
  async createPlayer(catSurface: HTMLElement, spritePath: string): Promise<void> {
    this.catPlayer = new CompanionGifPlayer();
    catSurface.appendChild(this.catPlayer.image);
    await this.catPlayer.load(publicAnimationAssetUrl, spritePath);
  }

  destroyPlayer(): void {
    this.catPlayer?.destroyPlayer();
    this.catPlayer = null;
  }

  /** Plays the peek "duck away" animation used when exiting from peek mode, waiting for it
   * to finish. Returns false if there's no player or presentation isn't in peek mood, so the
   * caller knows to fall back to the regular overlay exit animation instead. */
  async playPeekDuckExit(presentation: CatPresentation | null): Promise<boolean> {
    if (presentation?.mood !== 'peek' || !this.catPlayer) {
      return false;
    }
    const duckPath = peekDuckAnimationPath(presentation.stage);
    await this.catPlayer.load(publicAnimationAssetUrl, duckPath);
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, PEEK_DUCK_EXIT_MS);
    });
    return true;
  }

  animateCatReaction(): void {
    const cat = this.getCatElement();
    if (!cat) {
      return;
    }

    cat.classList.remove(CAT_REACT_CLASS);
    void cat.offsetWidth;
    cat.classList.add(CAT_REACT_CLASS);
    window.setTimeout(() => {
      cat.classList.remove(CAT_REACT_CLASS);
    }, COMPANION_REACT_MS);
  }

  updateCatAnimation(
    presentation: CatPresentation,
    options: { animateMood?: boolean; reactToTrigger?: boolean } = {},
  ): void {
    const cat = this.getCatElement();
    if (!cat || !this.catPlayer) {
      return;
    }

    if (cat.dataset.sprite === presentation.sprite) {
      if (options.reactToTrigger) {
        this.animateCatReaction();
      }
      return;
    }

    if (options.animateMood) {
      void this.transitionCatAnimation(presentation.sprite);
      if (options.reactToTrigger) {
        this.animateCatReaction();
      }
      return;
    }

    void this.catPlayer.load(publicAnimationAssetUrl, presentation.sprite);
    if (options.reactToTrigger) {
      this.animateCatReaction();
    }
  }

  private async transitionCatAnimation(assetPath: string): Promise<void> {
    const cat = this.getCatElement();
    if (!cat || !this.catPlayer) {
      return;
    }

    const token = ++this.moodTransitionToken;

    await preloadCompanionSprite(publicAnimationAssetUrl, assetPath);
    if (token !== this.moodTransitionToken || !cat.isConnected) {
      return;
    }

    cat.classList.remove(CAT_MOOD_IN_CLASS, CAT_MOOD_OUT_CLASS);
    cat.classList.add(CAT_MOOD_OUT_CLASS);
    await waitForOverlayAnimation(cat, COMPANION_MOOD_OUT_ANIMATION, COMPANION_MOOD_OUT_MS);

    if (token !== this.moodTransitionToken || !cat.isConnected || !this.catPlayer) {
      return;
    }

    await this.catPlayer.load(publicAnimationAssetUrl, assetPath);
    cat.classList.remove(CAT_MOOD_OUT_CLASS);
    cat.classList.add(CAT_MOOD_IN_CLASS);
    void cat.offsetWidth;
    await waitForOverlayAnimation(cat, COMPANION_MOOD_IN_ANIMATION, COMPANION_MOOD_IN_MS);

    if (token !== this.moodTransitionToken || !cat.isConnected) {
      return;
    }

    cat.classList.remove(CAT_MOOD_IN_CLASS);
  }
}
