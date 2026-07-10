import { describe, expect, it, vi } from 'vitest';
import { appendAnimationCacheBust, publicAnimationAssetUrl } from '../utils/runtime-client';

describe('appendAnimationCacheBust', () => {
  it('returns the URL unchanged when rand is null', () => {
    expect(appendAnimationCacheBust('chrome-extension://id/gif/adult/idle.gif', null)).toBe(
      'chrome-extension://id/gif/adult/idle.gif',
    );
  });

  it('appends ?rand= for a plain URL', () => {
    expect(
      appendAnimationCacheBust('chrome-extension://id/gif/adult/idle.gif', 'abc123'),
    ).toBe('chrome-extension://id/gif/adult/idle.gif?rand=abc123');
  });

  it('appends &rand= when the URL already has a query string', () => {
    expect(
      appendAnimationCacheBust('chrome-extension://id/gif/adult/idle.gif?foo=1', 'xyz'),
    ).toBe('chrome-extension://id/gif/adult/idle.gif?foo=1&rand=xyz');
  });
});

describe('publicAnimationAssetUrl', () => {
  it('adds rand in dev builds', () => {
    vi.stubGlobal('browser', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test${path}`,
      },
    });
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    const url = publicAnimationAssetUrl('gif/adult/idle.gif');
    expect(url).toMatch(/\/gif\/adult\/idle\.gif\?rand=[a-z0-9]+$/);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
