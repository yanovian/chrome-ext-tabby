import type { SiteRule } from './types';

export const AFRICA_NEWS_RULES: readonly SiteRule[] = [
  {
    hosts: [
      'news24.com',
      'dailymaverick.co.za',
      'nation.africa',
      'punchng.com',
      'premiumtimesng.com',
      'alahram.org.eg',
      'youm7.com',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
  },
];
