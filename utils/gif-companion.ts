import { preloadCompanionAnimation } from './companion-animation-preload';

const LOAD_TIMEOUT_MS = 4000;

/** Renders Tabby with a packaged GIF in the overlay. */
export class CompanionGifPlayer {
  readonly image: HTMLImageElement;
  private loadedAsset: string | null = null;
  private loadToken = 0;

  constructor() {
    this.image = document.createElement('img');
    this.image.className = 'tabby-cat';
    this.image.setAttribute('role', 'img');
    this.image.setAttribute('alt', 'Tabby');
    this.image.draggable = false;
    this.image.dataset.sprite = '';
  }

  async load(
    resolveUrl: (path: string) => string,
    assetPath: string,
  ): Promise<void> {
    if (this.loadedAsset === assetPath && this.image.complete && this.image.naturalWidth > 0) {
      return;
    }

    const token = ++this.loadToken;
    const src = resolveUrl(assetPath);
    await preloadCompanionAnimation(resolveUrl, assetPath, LOAD_TIMEOUT_MS);
    if (token !== this.loadToken) {
      return;
    }

    this.image.src = src;
    this.loadedAsset = assetPath;
    this.image.dataset.sprite = assetPath;
    this.image.dataset.animationSrc = src;
  }

  destroyPlayer(): void {
    this.image.removeAttribute('src');
    this.loadedAsset = null;
  }
}
