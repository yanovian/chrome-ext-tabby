import type { SiteRule } from './types';

export const MIDDLE_EAST_NEWS_RULES: readonly SiteRule[] = [
  {
    hosts: [
      'timesofisrael.com',
      'haaretz.com',
      'jpost.com',
      'gulfnews.com',
      'khaleejtimes.com',
      'arabnews.com',
      'lbcgroup.tv',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
  },
];
