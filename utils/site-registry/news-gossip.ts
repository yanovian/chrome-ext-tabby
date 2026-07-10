import type { SiteRule } from './types';

export const GOSSIP_NEWS_RULES: readonly SiteRule[] = [
  {
    hosts: ['news.yahoo.com', 'tmz.com', 'dailymail.co.uk', 'buzzfeed.com', 'pagesix.com'],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News & gossip',
  },
];

export const WESTERN_NEWS_RULES: readonly SiteRule[] = [
  {
    hosts: [
      'cnn.com',
      'bbc.com',
      'bbc.co.uk',
      'bbcpersian.com',
      'nytimes.com',
      'washingtonpost.com',
      'theguardian.com',
      'foxnews.com',
      'nbcnews.com',
      'reuters.com',
      'apnews.com',
      'news.google.com',
      'sky.com',
      'news.sky.com',
      'euronews.com',
      'cbc.ca',
      'globalnews.ca',
      'abcnews.go.com',
      'cbsnews.com',
      'bloomberg.com',
      'forbes.com',
      'huffpost.com',
      'npr.org',
      'usatoday.com',
      'latimes.com',
      'independent.co.uk',
      'telegraph.co.uk',
      'mirror.co.uk',
      'thesun.co.uk',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
  },
];

export const INTERNATIONAL_BROADCASTER_RULES: readonly SiteRule[] = [
  {
    hosts: [
      'voanews.com',
      'rferl.org',
      'radiofarda.com',
      'azatutyun.am',
      'rfa.org',
      'dw.com',
      'france24.com',
      'aljazeera.com',
      'aljazeera.net',
      'trtworld.com',
      'press.tv',
      'presstv.com',
      'presstv.ir',
      'rt.com',
      'sputniknews.com',
      'swissinfo.ch',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
  },
];
