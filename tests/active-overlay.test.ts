import { describe, expect, it } from 'vitest';
import { resolveActiveOverlayTabId } from '../utils/active-overlay';

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
