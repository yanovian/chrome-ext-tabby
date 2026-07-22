import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { warmCompanionGifCache } from '../utils/companion-gif-preload';

describe('warmCompanionGifCache', () => {
  beforeEach(() => {
    vi.stubGlobal('browser', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test${path}`,
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.stubEnv('DEV', false);
    vi.stubEnv('MODE', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('preloads every shipped companion GIF path', async () => {
    await warmCompanionGifCache();
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls.length).toBe(42);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('gif/adult/idle.gif'))).toBe(
      true,
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('peek_duck.gif'))).toBe(true);
  });
});
