import type { SiteRule } from './types';

export const ARMENIA_NEWS_RULES: readonly SiteRule[] = [
  {
    hosts: [
      'news.am',
      'armenpress.am',
      'hetq.am',
      'panorama.am',
      'arka.am',
      '168.am',
      'tert.am',
      'lragir.am',
      'civilnet.am',
      'factor.am',
      'mediamax.am',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
  },
];
