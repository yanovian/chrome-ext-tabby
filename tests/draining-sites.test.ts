import { describe, expect, it } from 'vitest';
import { matchDrainingSessionKind, matchSiteRule } from '../utils/site-registry';

describe('matchDrainingSessionKind', () => {
  it('detects major social hosts', () => {
    expect(matchDrainingSessionKind('Home / X', 'https://x.com/home')).toBe('social');
    expect(matchDrainingSessionKind('Instagram', 'https://www.instagram.com/')).toBe('social');
    expect(matchDrainingSessionKind('Feed', 'https://www.reddit.com/r/cats/')).toBe('social');
  });

  it('detects major news hosts', () => {
    expect(matchDrainingSessionKind('CNN', 'https://www.cnn.com/')).toBe('news');
    expect(matchDrainingSessionKind('BBC News', 'https://www.bbc.co.uk/news')).toBe('news');
    expect(matchDrainingSessionKind('TMZ', 'https://www.tmz.com/')).toBe('news');
  });

  it('detects BBC Persian and VOA Persian by host, not ambiguous path', () => {
    expect(
      matchDrainingSessionKind('BBC News فارسی', 'https://www.bbc.com/persian'),
    ).toBe('news');
    expect(
      matchDrainingSessionKind('صفحه اول', 'https://www.bbc.co.uk/persian'),
    ).toBe('news');
    expect(
      matchDrainingSessionKind('VOA فارسی', 'https://www.persian.voanews.com/'),
    ).toBe('news');
    expect(matchDrainingSessionKind('VOA', 'https://www.voanews.com/')).toBe('news');
  });

  it('does not treat ambiguous language paths on unknown hosts as news', () => {
    expect(
      matchDrainingSessionKind('Learn Farsi', 'https://example.com/farsi/lesson-1'),
    ).toBeNull();
    expect(
      matchDrainingSessionKind('Persian rugs', 'https://shop.example/persian/catalog'),
    ).toBeNull();
    expect(
      matchDrainingSessionKind('For you', 'https://example.com/for-you'),
    ).toBeNull();
    expect(
      matchDrainingSessionKind('Popular items', 'https://example.com/popular'),
    ).toBeNull();
  });

  it('still uses high-confidence news paths on unknown hosts', () => {
    expect(
      matchDrainingSessionKind('Local paper', 'https://example.com/news/today'),
    ).toBe('news');
    expect(
      matchDrainingSessionKind('Breaking', 'https://example.com/breaking/story'),
    ).toBe('news');
  });

  it('detects Armenian news sites', () => {
    expect(matchDrainingSessionKind('News', 'https://news.am/')).toBe('news');
    expect(matchDrainingSessionKind('Hetq', 'https://hetq.am/')).toBe('news');
    expect(matchDrainingSessionKind('Azatutyun', 'https://www.azatutyun.am/')).toBe('news');
    expect(matchDrainingSessionKind('Armenpress', 'https://armenpress.am/')).toBe('news');
  });

  it('detects Iranian news sites', () => {
    expect(matchDrainingSessionKind('IRNA', 'https://www.irna.ir/')).toBe('news');
    expect(matchDrainingSessionKind('Tasnim', 'https://www.tasnimnews.com/')).toBe('news');
    expect(matchDrainingSessionKind('Tehran Times', 'https://www.tehrantimes.com/')).toBe('news');
    expect(matchDrainingSessionKind('Iran Intl', 'https://www.iranintl.com/')).toBe('news');
    expect(matchDrainingSessionKind('Iran International', 'https://www.iranintl.com/en')).toBe('news');
    expect(
      matchDrainingSessionKind('ایران اینترنشنال', 'https://www.iranintl.com/fa'),
    ).toBe('news');
    expect(matchDrainingSessionKind('Home', 'https://www.iranintl.news/en/iran-en')).toBe('news');
    expect(matchDrainingSessionKind('Manoto TV', 'https://www.manototv.com/')).toBe('news');
    expect(matchDrainingSessionKind('IranWire', 'https://iranwire.com/fa')).toBe('news');
    expect(matchDrainingSessionKind('Kayhan London', 'https://kayhan.london/')).toBe('news');
  });

  it('detects Nordic news sites', () => {
    expect(matchDrainingSessionKind('DR', 'https://www.dr.dk/')).toBe('news');
    expect(matchDrainingSessionKind('Politiken', 'https://politiken.dk/')).toBe('news');
    expect(matchDrainingSessionKind('SVT', 'https://www.svt.se/')).toBe('news');
    expect(matchDrainingSessionKind('DN', 'https://www.dn.se/')).toBe('news');
    expect(matchDrainingSessionKind('Aftonbladet', 'https://www.aftonbladet.se/')).toBe('news');
  });

  it('detects added regional news sites', () => {
    expect(matchDrainingSessionKind('Nikkei', 'https://www.nikkei.com/')).toBe('news');
    expect(matchDrainingSessionKind('Hindu', 'https://www.thehindu.com/')).toBe('news');
    expect(matchDrainingSessionKind('ABC', 'https://www.abc.net.au/')).toBe('news');
    expect(matchDrainingSessionKind('Haaretz', 'https://www.haaretz.com/')).toBe('news');
    expect(matchDrainingSessionKind('News24', 'https://www.news24.com/')).toBe('news');
    expect(matchDrainingSessionKind('Le Monde', 'https://www.lemonde.fr/')).toBe('news');
  });

  it('returns null for ordinary pages', () => {
    expect(
      matchDrainingSessionKind('MDN', 'https://developer.mozilla.org/en-US/docs/Web'),
    ).toBeNull();
    expect(matchDrainingSessionKind('Example', 'https://example.com/')).toBeNull();
  });
});

describe('matchSiteRule', () => {
  it('matches subdomains of listed news hosts', () => {
    expect(matchSiteRule('persian.voanews.com', '/')?.drainingKind).toBe('news');
    expect(matchSiteRule('www.bbc.com', '/persian')?.drainingKind).toBe('news');
    expect(matchSiteRule('www.iranintl.com', '/fa')?.drainingKind).toBe('news');
    expect(matchSiteRule('www.manototv.com', '/')?.drainingKind).toBe('news');
  });
});
