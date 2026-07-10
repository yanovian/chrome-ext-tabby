import type { SiteRule } from './types';

/** Movies and TV series streaming — positive entertainment that refreshes mood. */
export const NOURISHING_STREAMING_RULES: readonly SiteRule[] = [
  {
    hosts: [
      'netflix.com',
      'hulu.com',
      'disneyplus.com',
      'max.com',
      'primevideo.com',
      'tv.apple.com',
      'play.google.com',
      'crunchyroll.com',
      'paramountplus.com',
      'peacocktv.com',
      'discoveryplus.com',
      'hotstar.com',
      'stan.com.au',
    ],
    category: 'nourishing',
    topic: 'Streaming',
  },
];
