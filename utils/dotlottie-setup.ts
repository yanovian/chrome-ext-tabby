import { DotLottie } from '@lottiefiles/dotlottie-web';
import { publicAssetUrl } from './runtime-client';

const WASM_ASSET = 'dotlottie-player.wasm';

let wasmReady: Promise<void> | null = null;

/** Point dotLottie at the bundled WASM file (required for extension CSP). */
export async function ensureDotlottieWasm(): Promise<void> {
  if (!wasmReady) {
    const url = publicAssetUrl(WASM_ASSET);
    DotLottie.setWasmUrl(url);
    wasmReady = fetch(url)
      .then(() => undefined)
      .catch(() => undefined);
  }
  await wasmReady;
}

/** @internal Test hook */
export function resetDotlottieWasmForTests(): void {
  wasmReady = null;
}
