import type { SiteRule } from './types';

export const SOCIAL_SITE_RULES: readonly SiteRule[] = [
  {
    hosts: [
      'twitter.com',
      'x.com',
      'instagram.com',
      'tiktok.com',
      'facebook.com',
      'threads.net',
      'snapchat.com',
      'pinterest.com',
      'reddit.com',
    ],
    category: 'draining',
    drainingKind: 'social',
    topic: 'Social',
  },
  {
    hosts: [
      'linkedin.com',
      'discord.com',
      'discordapp.com',
      'whatsapp.com',
      'web.whatsapp.com',
      'telegram.org',
      't.me',
      'tumblr.com',
      'bsky.app',
      'weibo.com',
      'vk.com',
      'line.me',
      'nextdoor.com',
      'quora.com',
      'meetup.com',
      'kakao.com',
      'naver.com',
    ],
    category: 'draining',
    drainingKind: 'social',
    topic: 'Social',
  },
  {
    // Same doomscroll/outrage-feed shape as Twitter/X, Facebook, Reddit above:
    // an algorithmic or reverse-chronological feed built for high engagement.
    hosts: [
      'mastodon.social',
      'truthsocial.com',
      'gab.com',
      'parler.com',
      'gettr.com',
      'myspace.com',
      'bereal.com',
      'ok.ru',
      '4chan.org',
      '4channel.org',
    ],
    category: 'draining',
    drainingKind: 'social',
    topic: 'Social',
  },
  {
    // Documented for unpredictable, chaotic, and frequently toxic or
    // harassment-focused content, not just generic engagement. Encyclopedia
    // Dramatica is nominally a wiki but is specifically known for this, unlike
    // the generic wiki hosts kept neutral (see neutral.ts).
    hosts: ['8kun.top', 'kiwifarms.net', 'encyclopediadramatica.online'],
    category: 'draining',
    drainingKind: 'social',
    topic: 'Social',
  },
];
