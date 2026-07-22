import type { SiteRule } from './types';

/** Movies, TV, and music streaming — positive entertainment that refreshes mood
 * rather than draining it. */
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
  {
    hosts: [
      'last.fm',
      'spotify.com',
      'open.spotify.com',
      'music.apple.com',
      'music.youtube.com',
      'soundcloud.com',
      'deezer.com',
      'tidal.com',
      'pandora.com',
      'bandcamp.com',
    ],
    category: 'nourishing',
    topic: 'Music',
  },
];
