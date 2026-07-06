import type { BrowseCategory } from './types';

export interface SiteRule {
  hosts: readonly string[];
  category: BrowseCategory;
  /** Path fragments that reinforce the category (e.g. /explore on social). */
  drainingPaths?: readonly string[];
  nourishingPaths?: readonly string[];
  topic?: string;
}

/** Known sites — checked before generic title/URL keywords. */
export const SITE_RULES: readonly SiteRule[] = [
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
    ],
    category: 'draining',
    drainingPaths: ['/explore', '/trending', '/feed', '/fyp', '/for-you', '/popular', '/reels'],
    topic: 'Social',
  },
  {
    hosts: ['reddit.com', 'news.yahoo.com', 'tmz.com', 'dailymail.co.uk', 'buzzfeed.com'],
    category: 'draining',
    drainingPaths: ['/r/popular', '/r/all', '/hot', '/rising', '/trending'],
    topic: 'News & gossip',
  },
  {
    hosts: ['youtube.com', 'youtu.be', 'm.youtube.com'],
    category: 'neutral',
    topic: 'Video',
  },
  {
    hosts: [
      'github.com',
      'gitlab.com',
      'stackoverflow.com',
      'stackexchange.com',
      'developer.mozilla.org',
      'kubernetes.io',
      'docs.python.org',
      'readthedocs.io',
      'npmjs.com',
      'pypi.org',
      'crates.io',
    ],
    category: 'nourishing',
    nourishingPaths: ['/docs', '/documentation', '/learn', '/tutorial', '/guide', '/book'],
    topic: 'Development',
  },
  {
    hosts: [
      'aws.amazon.com',
      'azure.microsoft.com',
      'cloud.google.com',
      'learn.microsoft.com',
      'docs.microsoft.com',
      'portal.azure.com',
    ],
    category: 'nourishing',
    topic: 'Cloud',
  },
  {
    hosts: ['arxiv.org', 'scholar.google.com', 'researchgate.net', 'nature.com', 'sciencedirect.com'],
    category: 'nourishing',
    topic: 'Research',
  },
  {
    hosts: ['coursera.org', 'udemy.com', 'khanacademy.org', 'edx.org', 'pluralsight.com'],
    category: 'nourishing',
    topic: 'Learning',
  },
  {
    hosts: ['wikipedia.org', 'wikimedia.org'],
    category: 'nourishing',
    topic: 'Reference',
  },
  {
    hosts: ['medium.com', 'dev.to', 'hashnode.com', 'substack.com'],
    category: 'neutral',
    topic: 'Writing',
  },
  {
    hosts: [
      'chase.com',
      'bankofamerica.com',
      'wellsfargo.com',
      'paypal.com',
      'stripe.com',
      'mail.google.com',
      'outlook.live.com',
      'outlook.office.com',
    ],
    category: 'neutral',
    topic: 'Errands',
  },
  {
    hosts: ['amazon.com', 'amazon.co.uk', 'ebay.com', 'etsy.com', 'shopify.com'],
    category: 'neutral',
    topic: 'Shopping',
  },
  {
    hosts: ['netflix.com', 'hulu.com', 'disneyplus.com', 'max.com', 'primevideo.com'],
    category: 'neutral',
    topic: 'Streaming',
  },
];

export function matchSiteRule(hostname: string, path: string): SiteRule | null {
  const normalizedHost = hostname.replace(/^www\./, '').toLowerCase();
  const normalizedPath = path.toLowerCase();

  for (const rule of SITE_RULES) {
    const hostMatch = rule.hosts.some(
      (host) => normalizedHost === host || normalizedHost.endsWith(`.${host}`),
    );
    if (!hostMatch) {
      continue;
    }

    if (rule.drainingPaths?.some((hint) => normalizedPath.includes(hint))) {
      return { ...rule, category: 'draining' };
    }
    if (rule.nourishingPaths?.some((hint) => normalizedPath.includes(hint))) {
      return { ...rule, category: 'nourishing' };
    }

    return rule;
  }

  return null;
}
