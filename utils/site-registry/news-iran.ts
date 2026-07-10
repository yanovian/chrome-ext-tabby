import type { SiteRule } from './types';

export const IRAN_NEWS_RULES: readonly SiteRule[] = [
  {
    hosts: [
      'irna.ir',
      'tasnimnews.com',
      'farsnews.ir',
      'farsnews.com',
      'tehrantimes.com',
      'mehrnews.com',
      'isna.ir',
      'tabnak.ir',
      'entekhab.ir',
      'borna.news',
      'iqna.ir',
      'khabaronline.ir',
      'yjc.ir',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
  },
  {
    hosts: [
      'iranintl.com',
      'iranintl.news',
      'intlplus.com',
      'manototv.com',
      'manoto.tv',
      'iranwire.com',
      'kayhan.london',
      'kayhanlife.com',
      'radiozamaneh.com',
      'smallmedia.org.uk',
      'rouydadiran.com',
      'iranhumanrights.org',
      'en-hrana.org',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
  },
];
