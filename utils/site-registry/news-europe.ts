import type { SiteRule } from './types';

export const EUROPE_NEWS_RULES: readonly SiteRule[] = [
  {
    hosts: [
      'lemonde.fr',
      'spiegel.de',
      'zeit.de',
      'corriere.it',
      'elpais.com',
      'gazeta.pl',
      'onet.pl',
      'nos.nl',
      'nu.nl',
      'volkskrant.nl',
      'standaard.be',
      'lesoir.be',
      'derstandard.at',
      'diepresse.com',
      'nzz.ch',
      'publico.pt',
      'kathimerini.gr',
      'tass.com',
      'kommersant.ru',
      'rbc.ru',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
  },
];
