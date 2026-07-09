import type { BrowseCategory, DrainingSessionKind } from './types';
import { parseHostname } from './classifier';

export interface SiteRule {
  hosts: readonly string[];
  category: BrowseCategory;
  /** Long-session overwhelmed tracking when set. */
  drainingKind?: 'social' | 'news';
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
      'reddit.com',
    ],
    category: 'draining',
    drainingKind: 'social',
    drainingPaths: ['/explore', '/trending', '/feed', '/fyp', '/for-you', '/popular', '/reels'],
    topic: 'Social',
  },
  {
    hosts: ['news.yahoo.com', 'tmz.com', 'dailymail.co.uk', 'buzzfeed.com', 'pagesix.com'],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News & gossip',
  },
  {
    hosts: [
      'cnn.com',
      'bbc.com',
      'bbc.co.uk',
      'bbcpersian.com',
      'nytimes.com',
      'washingtonpost.com',
      'theguardian.com',
      'foxnews.com',
      'nbcnews.com',
      'reuters.com',
      'apnews.com',
      'news.google.com',
      'sky.com',
      'news.sky.com',
      'euronews.com',
      'cbc.ca',
      'globalnews.ca',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
  },
  {
    hosts: [
      'voanews.com',
      'rferl.org',
      'radiofarda.com',
      'azatutyun.am',
      'rfa.org',
      'dw.com',
      'france24.com',
      'aljazeera.com',
      'aljazeera.net',
      'trtworld.com',
      'press.tv',
      'presstv.com',
      'presstv.ir',
      'rt.com',
      'sputniknews.com',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
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
    ],
    category: 'draining',
    drainingKind: 'social',
    topic: 'Social',
  },
  {
    hosts: [
      'abcnews.go.com',
      'cbsnews.com',
      'bloomberg.com',
      'forbes.com',
      'huffpost.com',
      'npr.org',
      'aljazeera.com',
      'france24.com',
      'usatoday.com',
      'latimes.com',
      'independent.co.uk',
      'telegraph.co.uk',
      'mirror.co.uk',
      'thesun.co.uk',
      'lemonde.fr',
      'spiegel.de',
      'zeit.de',
      'corriere.it',
      'elpais.com',
      'asahi.com',
      'nhk.or.jp',
      'scmp.com',
      'straitstimes.com',
      'indiatimes.com',
      'timesofindia.com',
      'hindustantimes.com',
      'globo.com',
      'infobae.com',
      'clarin.com',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
  },
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
    drainingPaths: ['/en', '/fa', '/ar', '/live', '/persian', '/farsi'],
    topic: 'News',
  },
  {
    hosts: [
      'dr.dk',
      'tv2.dk',
      'berlingske.dk',
      'politiken.dk',
      'jyllands-posten.dk',
      'ekstrabladet.dk',
      'bt.dk',
      'information.dk',
      'finans.dk',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
  },
  {
    hosts: [
      'svt.se',
      'dn.se',
      'aftonbladet.se',
      'expressen.se',
      'gp.se',
      'sydsvenskan.se',
      'di.se',
      'tv4.se',
      'sverigesradio.se',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
  },
  {
    hosts: [
      'nrk.no',
      'aftenposten.no',
      'vg.no',
      'dagbladet.no',
      'yle.fi',
      'hs.fi',
      'iltalehti.fi',
      'is.fi',
    ],
    category: 'draining',
    drainingKind: 'news',
    topic: 'News',
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

const NEWS_PATH_HINTS = [
  '/news',
  '/headlines',
  '/breaking',
  '/world',
  '/persian',
  '/farsi',
  '/arabic',
  '/noticias',
  '/nachrichten',
  '/actualites',
  '/nouvelles',
  '/nyheder',
  '/nyheter',
  '/uutiset',
] as const;

const NEWS_TITLE_HINTS = [
  'breaking news',
  'latest news',
  'headlines',
  'top stories',
  'iran international',
  'ایران اینترنشنال',
  'iranintl',
  'manoto',
  'من و تو',
  'iranwire',
  'kayhan london',
  'کیهان لندن',
] as const;

function parsePath(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return '';
  }
}

/** Classify the active tab for long-session overwhelmed tracking. */
export function matchDrainingSessionKind(
  title: string | undefined,
  url: string | undefined,
): DrainingSessionKind | null {
  if (!url) {
    return null;
  }

  const hostname = parseHostname(url);
  const path = parsePath(url);
  const siteRule = matchSiteRule(hostname, path);

  if (siteRule?.drainingKind) {
    return siteRule.drainingKind;
  }

  if (siteRule?.category === 'draining' && siteRule.topic === 'Social') {
    return 'social';
  }

  if (siteRule?.category === 'draining') {
    return 'news';
  }

  const combined = `${title ?? ''} ${path}`.toLowerCase();
  if (NEWS_PATH_HINTS.some((hint) => path.includes(hint))) {
    return 'news';
  }
  if (NEWS_TITLE_HINTS.some((hint) => combined.includes(hint))) {
    return 'news';
  }

  return null;
}
