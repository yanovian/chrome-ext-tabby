import { DotLottie } from '@lottiefiles/dotlottie-web';
import {
  COMPANION_ANIMATION_SPEED,
  companionCanvasSizeFromPath,
} from './companion-animation';

const LOAD_TIMEOUT_MS = 4000;

/** Renders Tabby with dotLottie on a canvas in the overlay. */
export class CompanionLottiePlayer {
  readonly canvas: HTMLCanvasElement;
  private player: DotLottie | null = null;
  private loadedAsset: string | null = null;
  private loadToken = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tabby-cat';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Tabby');
    this.canvas.dataset.sprite = '';
  }

  async load(
    resolveUrl: (path: string) => string,
    assetPath: string,
    speed = COMPANION_ANIMATION_SPEED,
  ): Promise<void> {
    if (this.loadedAsset === assetPath && this.player) {
      this.player.setSpeed(speed);
      return;
    }

    const token = ++this.loadToken;
    this.destroyPlayer();

    const bufferSize = companionCanvasSizeFromPath(assetPath);
    this.syncCanvasBuffer(bufferSize);

    const src = resolveUrl(assetPath);

    const player = new DotLottie({
      canvas: this.canvas,
      src,
      loop: true,
      autoplay: true,
      speed,
      backgroundColor: 'transparent',
      layout: { fit: 'contain', align: [0.5, 0.5] },
      renderConfig: {
        autoResize: false,
        devicePixelRatio: 1,
        freezeOnOffscreen: false,
      },
    });

    await waitForLottieLoad(player, LOAD_TIMEOUT_MS);
    if (token !== this.loadToken) {
      player.destroy();
      return;
    }

    const { width, height } = player.animationSize();
    if (width > 0 && height > 0) {
      this.syncCanvasBuffer(width);
      player.resize();
    }

    this.player = player;
    this.loadedAsset = assetPath;
    this.canvas.dataset.sprite = assetPath;
    this.canvas.dataset.animationSrc = src;
  }

  destroyPlayer(): void {
    this.player?.destroy();
    this.player = null;
    this.loadedAsset = null;
  }

  /** Keep the WASM pixel buffer aligned with canvas backing-store dimensions. */
  private syncCanvasBuffer(size: number): void {
    const pixels = Math.max(1, Math.round(size));
    if (this.canvas.width !== pixels || this.canvas.height !== pixels) {
      this.canvas.width = pixels;
      this.canvas.height = pixels;
    }
  }
}

function waitForLottieLoad(player: DotLottie, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      player.removeEventListener('load', onLoad);
      player.removeEventListener('loadError', onError);
      globalThis.clearTimeout(timer);
      resolve();
    };
    const onLoad = (): void => finish();
    const onError = (): void => finish();
    const timer = globalThis.setTimeout(finish, timeoutMs);
    player.addEventListener('load', onLoad);
    player.addEventListener('loadError', onError);
  });
}

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
