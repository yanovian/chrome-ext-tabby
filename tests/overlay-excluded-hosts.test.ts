import { describe, expect, it } from 'vitest';
import {
  isOverlayHostExcluded,
  looksLikeBankingHost,
  overlayExcludeMatchPatterns,
  OVERLAY_EXCLUDED_HOST_ROOTS,
} from '../utils/overlay-excluded-hosts';

describe('isOverlayHostExcluded', () => {
  it('allows GitHub and other dev platforms', () => {
    expect(isOverlayHostExcluded('github.com')).toBe(false);
    expect(isOverlayHostExcluded('gist.github.com')).toBe(false);
    expect(isOverlayHostExcluded('gitlab.com')).toBe(false);
  });

  it('allows email and account sign-in hosts', () => {
    expect(isOverlayHostExcluded('mail.google.com')).toBe(false);
    expect(isOverlayHostExcluded('gmail.com')).toBe(false);
    expect(isOverlayHostExcluded('outlook.live.com')).toBe(false);
    expect(isOverlayHostExcluded('accounts.google.com')).toBe(false);
    expect(isOverlayHostExcluded('proton.me')).toBe(false);
  });

  it('excludes listed major banks', () => {
    expect(isOverlayHostExcluded('chase.com')).toBe(true);
    expect(isOverlayHostExcluded('secure.chase.com')).toBe(true);
    expect(isOverlayHostExcluded('bankofamerica.com')).toBe(true);
    expect(isOverlayHostExcluded('deutsche-bank.de')).toBe(true);
    expect(isOverlayHostExcluded('hdfcbank.com')).toBe(true);
    expect(isOverlayHostExcluded('bb.com.br')).toBe(true);
    expect(isOverlayHostExcluded('ameriabank.am')).toBe(true);
    expect(isOverlayHostExcluded('sberbank.ru')).toBe(true);
    expect(isOverlayHostExcluded('tbcbank.ge')).toBe(true);
    expect(isOverlayHostExcluded('ziraatbank.com.tr')).toBe(true);
    expect(isOverlayHostExcluded('kaspi.kz')).toBe(true);
    expect(isOverlayHostExcluded('bankmellat.ir')).toBe(true);
  });

  it('excludes major video streaming services so Tabby stays out of the way', () => {
    expect(isOverlayHostExcluded('netflix.com')).toBe(true);
    expect(isOverlayHostExcluded('www.netflix.com')).toBe(true);
    expect(isOverlayHostExcluded('max.com')).toBe(true);
    expect(isOverlayHostExcluded('kinopoisk.ru')).toBe(true);
    expect(isOverlayHostExcluded('ivi.ru')).toBe(true);
  });

  it('still allows music streaming and general video sites', () => {
    expect(isOverlayHostExcluded('spotify.com')).toBe(false);
    expect(isOverlayHostExcluded('music.youtube.com')).toBe(false);
    expect(isOverlayHostExcluded('youtube.com')).toBe(false);
    expect(isOverlayHostExcluded('www.youtube.com')).toBe(false);
  });

  it('excludes payment and password manager hosts', () => {
    expect(isOverlayHostExcluded('paypal.com')).toBe(true);
    expect(isOverlayHostExcluded('stripe.com')).toBe(true);
    expect(isOverlayHostExcluded('1password.com')).toBe(true);
    expect(isOverlayHostExcluded('bitwarden.com')).toBe(true);
  });

  it('allows ordinary browsing sites', () => {
    expect(isOverlayHostExcluded('developer.mozilla.org')).toBe(false);
    expect(isOverlayHostExcluded('news.ycombinator.com')).toBe(false);
    expect(isOverlayHostExcluded('example.com')).toBe(false);
    expect(isOverlayHostExcluded('apple.com')).toBe(false);
  });

  it('catches unknown bank domains by hostname hint', () => {
    expect(isOverlayHostExcluded('online.myregionalbank.com')).toBe(true);
    expect(isOverlayHostExcluded('members.firstcreditunion.org')).toBe(true);
    expect(isOverlayHostExcluded('foodbank.org')).toBe(false);
  });
});

describe('looksLikeBankingHost', () => {
  it('matches .bank TLD hosts', () => {
    expect(looksLikeBankingHost('secure.example.bank')).toBe(true);
  });
});

describe('overlayExcludeMatchPatterns', () => {
  it('includes payment hosts but not the Chrome Web Store', () => {
    const patterns = overlayExcludeMatchPatterns();
    expect(patterns).not.toContain('*://chrome.google.com/webstore/*');
    expect(patterns).not.toContain('*://chromewebstore.google.com/*');
    expect(patterns).not.toContain('*://github.com/*');
    expect(patterns).toContain('*://paypal.com/*');
    expect(patterns).toContain('*://*.netflix.com/*');
  });

  it('does not treat the Chrome Web Store as an excluded host', () => {
    expect(isOverlayHostExcluded('chromewebstore.google.com')).toBe(false);
    expect(isOverlayHostExcluded('chrome.google.com')).toBe(false);
  });
});

describe('OVERLAY_EXCLUDED_HOST_ROOTS', () => {
  it('keeps regional bank lists organized without duplicate roots', () => {
    const unique = new Set(OVERLAY_EXCLUDED_HOST_ROOTS);
    expect(unique.size).toBe(OVERLAY_EXCLUDED_HOST_ROOTS.length);
    expect(OVERLAY_EXCLUDED_HOST_ROOTS.length).toBeGreaterThan(100);
  });
});
