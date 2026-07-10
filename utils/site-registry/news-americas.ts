import type { SiteRule } from './types';

export const AMERICAS_NEWS_RULES: readonly SiteRule[] = [
  {
    hosts: [
      'globo.com',
      'infobae.com',
      'clarin.com',
      'lanacion.com.ar',
      'folha.uol.com.br',
      'uol.com.br',
      'eluniversal.com.mx',
      'reforma.com',
      'elespectador.com',
      'semana.com',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
  },
];
