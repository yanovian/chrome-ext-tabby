import { describe, expect, it } from 'vitest';
import {
  isOverlayHostExcluded,
  looksLikeBankingHost,
  overlayExcludeMatchPatterns,
} from '../utils/overlay-excluded-hosts';

describe('isOverlayHostExcluded', () => {
  it('excludes GitHub and subdomains', () => {
    expect(isOverlayHostExcluded('github.com')).toBe(true);
    expect(isOverlayHostExcluded('gist.github.com')).toBe(true);
  });

  it('excludes Gmail and Outlook mail hosts', () => {
    expect(isOverlayHostExcluded('mail.google.com')).toBe(true);
    expect(isOverlayHostExcluded('gmail.com')).toBe(true);
    expect(isOverlayHostExcluded('outlook.live.com')).toBe(true);
  });

  it('excludes listed major banks', () => {
    expect(isOverlayHostExcluded('chase.com')).toBe(true);
    expect(isOverlayHostExcluded('secure.chase.com')).toBe(true);
    expect(isOverlayHostExcluded('bankofamerica.com')).toBe(true);
  });

  it('allows ordinary browsing sites', () => {
    expect(isOverlayHostExcluded('developer.mozilla.org')).toBe(false);
    expect(isOverlayHostExcluded('news.ycombinator.com')).toBe(false);
    expect(isOverlayHostExcluded('example.com')).toBe(false);
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
  it('includes sensitive hosts but not the Chrome Web Store', () => {
    const patterns = overlayExcludeMatchPatterns();
    expect(patterns).not.toContain('*://chrome.google.com/webstore/*');
    expect(patterns).not.toContain('*://chromewebstore.google.com/*');
    expect(patterns).toContain('*://github.com/*');
    expect(patterns).toContain('*://*.github.com/*');
  });

  it('does not treat the Chrome Web Store as an excluded host', () => {
    expect(isOverlayHostExcluded('chromewebstore.google.com')).toBe(false);
    expect(isOverlayHostExcluded('chrome.google.com')).toBe(false);
  });
});
