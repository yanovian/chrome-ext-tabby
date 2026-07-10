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
];
