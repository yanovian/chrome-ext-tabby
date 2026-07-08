import { DotLottie } from '@lottiefiles/dotlottie-web';
import { publicAssetUrl } from './runtime-client';

const WASM_ASSET = 'dotlottie-player.wasm';

let configured = false;

/** Point dotLottie at the bundled WASM file (required for extension CSP). */
export function ensureDotlottieWasm(): void {
  if (configured) {
    return;
  }
  DotLottie.setWasmUrl(publicAssetUrl(WASM_ASSET));
  configured = true;
}

/** @internal Test hook */
export function resetDotlottieWasmForTests(): void {
  configured = false;
}
