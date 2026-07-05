import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hidePageOverlay,
  isPageOverlayHidden,
  pageOverlayKey,
  showPageOverlay,
} from '../utils/page-overlay';
import { STORAGE_KEYS } from '../utils/types';

const store: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  vi.stubGlobal('browser', {
    storage: {
      local: {
        get: async (keys: string | string[] | Record<string, unknown>) => {
          if (typeof keys === 'string') {
            return { [keys]: store[keys] };
          }
          if (Array.isArray(keys)) {
            return Object.fromEntries(keys.map((key) => [key, store[key]]));
          }
          return { ...store };
        },
        set: async (items: Record<string, unknown>) => {
          Object.assign(store, items);
        },
      },
    },
  });
});

describe('pageOverlayKey', () => {
  it('normalizes hostname and trailing slashes', () => {
    expect(pageOverlayKey('https://www.example.com/docs/')).toBe('example.com/docs');
    expect(pageOverlayKey('https://example.com/')).toBe('example.com/');
  });

  it('returns null for internal browser pages', () => {
    expect(pageOverlayKey('chrome://settings')).toBeNull();
  });
});

describe('page overlay visibility', () => {
  it('tracks hide and show per page key', async () => {
    const url = 'https://example.com/article';
    const key = pageOverlayKey(url);
    expect(key).toBe('example.com/article');

    await browser.storage.local.set({ [STORAGE_KEYS.hiddenPageKeys]: [] });

    expect(await isPageOverlayHidden(url)).toBe(false);
    await hidePageOverlay(url);
    expect(await isPageOverlayHidden(url)).toBe(true);
    await showPageOverlay(url);
    expect(await isPageOverlayHidden(url)).toBe(false);
  });
});
