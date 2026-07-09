import { describe, expect, it } from 'vitest';
import { canShowOverlayOnUrl } from '../utils/overlay-inject';

describe('canShowOverlayOnUrl', () => {
  it('allows the Chrome Web Store where users install Tabby', () => {
    expect(
      canShowOverlayOnUrl('https://chromewebstore.google.com/detail/tabby/abc'),
    ).toBe(true);
    expect(
      canShowOverlayOnUrl('https://chrome.google.com/webstore/detail/tabby/abc'),
    ).toBe(true);
  });

  it('blocks internal browser pages', () => {
    expect(canShowOverlayOnUrl('chrome://extensions')).toBe(false);
    expect(canShowOverlayOnUrl('chrome-extension://id/popup.html')).toBe(false);
  });
});
