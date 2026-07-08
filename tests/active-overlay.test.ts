import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyOverlayActivate, resolveActiveOverlayTabId } from '../utils/active-overlay';

describe('resolveActiveOverlayTabId', () => {
  it('returns the tab id when overlay is enabled on a normal page', () => {
    expect(
      resolveActiveOverlayTabId(
        { id: 42, url: 'https://example.com/article' },
        true,
      ),
    ).toBe(42);
  });

  it('returns null when the global overlay toggle is off', () => {
    expect(
      resolveActiveOverlayTabId(
        { id: 42, url: 'https://example.com/article' },
        false,
      ),
    ).toBeNull();
  });

  it('returns null on internal browser pages', () => {
    expect(
      resolveActiveOverlayTabId({ id: 7, url: 'chrome://settings' }, true),
    ).toBeNull();
  });

  it('returns null when the tab has no id', () => {
    expect(
      resolveActiveOverlayTabId({ url: 'https://example.com' }, true),
    ).toBeNull();
  });
});

describe('notifyOverlayActivate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('browser', {
      tabs: {
        sendMessage: vi
          .fn()
          .mockRejectedValueOnce(new Error('Could not establish connection'))
          .mockResolvedValueOnce(undefined),
      },
    });
  });

  it('retries when the content script is not ready yet', async () => {
    const promise = notifyOverlayActivate(42);
    await vi.runAllTimersAsync();
    await promise;

    expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
