import { beforeEach, describe, expect, it, vi } from 'vitest';

const setWasmUrl = vi.fn();

vi.mock('@lottiefiles/dotlottie-web', () => ({
  DotLottie: { setWasmUrl },
}));

vi.mock('../utils/runtime-client', () => ({
  publicAssetUrl: (path: string) => `chrome-extension://test/${path}`,
}));

describe('ensureDotlottieWasm', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const mod = await import('../utils/dotlottie-setup');
    mod.resetDotlottieWasmForTests();
  });

  it('points dotLottie at the bundled wasm file once', async () => {
    const { ensureDotlottieWasm } = await import('../utils/dotlottie-setup');

    await ensureDotlottieWasm();
    await ensureDotlottieWasm();

    expect(setWasmUrl).toHaveBeenCalledTimes(1);
    expect(setWasmUrl).toHaveBeenCalledWith('chrome-extension://test/dotlottie-player.wasm');
    expect(fetch).toHaveBeenCalledWith('chrome-extension://test/dotlottie-player.wasm');
  });
});
