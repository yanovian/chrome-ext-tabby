import { describe, expect, it, vi } from 'vitest';
import { appendAnimationCacheBust, publicAnimationAssetUrl } from '../utils/runtime-client';

describe('appendAnimationCacheBust', () => {
  it('returns the URL unchanged when rand is null', () => {
    expect(appendAnimationCacheBust('chrome-extension://id/animations/adult/idle.json', null)).toBe(
      'chrome-extension://id/animations/adult/idle.json',
    );
  });

  it('appends ?rand= for a plain URL', () => {
    expect(
      appendAnimationCacheBust('chrome-extension://id/animations/adult/idle.json', 'abc123'),
    ).toBe('chrome-extension://id/animations/adult/idle.json?rand=abc123');
  });

  it('appends &rand= when the URL already has a query string', () => {
    expect(
      appendAnimationCacheBust('chrome-extension://id/animations/adult/idle.json?foo=1', 'xyz'),
    ).toBe('chrome-extension://id/animations/adult/idle.json?foo=1&rand=xyz');
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
    const url = publicAnimationAssetUrl('animations/adult/idle.json');
    expect(url).toMatch(/\/animations\/adult\/idle\.json\?rand=[a-z0-9]+$/);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
