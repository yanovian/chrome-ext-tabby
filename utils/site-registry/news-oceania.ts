import type { SiteRule } from './types';

export const OCEANIA_NEWS_RULES: readonly SiteRule[] = [
  {
    hosts: [
      'abc.net.au',
      'smh.com.au',
      'theage.com.au',
      'news.com.au',
      'stuff.co.nz',
      'nzherald.co.nz',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
  },
];
