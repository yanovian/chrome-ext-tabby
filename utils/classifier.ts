import type { BrowseCategory } from './types';

const INTERNAL_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'devtools://',
];

const DRAINING_HOSTS = new Set([
  'twitter.com',
  'x.com',
  'instagram.com',
  'tiktok.com',
  'facebook.com',
  'reddit.com',
  'news.yahoo.com',
  'tmz.com',
]);

const DRAINING_PATH_HINTS = [
  '/explore',
  '/trending',
  '/feed',
  '/fyp',
  '/for-you',
  '/popular',
  '/gossip',
];

const NOURISHING_HOSTS = new Set([
  'github.com',
  'stackoverflow.com',
  'developer.mozilla.org',
  'kubernetes.io',
  'docs.python.org',
  'arxiv.org',
  'coursera.org',
  'udemy.com',
  'khanacademy.org',
  'wikipedia.org',
  'medium.com',
]);

const NOURISHING_KEYWORDS = [
  'tutorial',
  'documentation',
  'docs',
  'guide',
  'learn',
  'learning',
  'course',
  'programming',
  'developer',
  'api',
  'reference',
  'how to',
  'build',
  'project',
  'research',
  'paper',
  'algorithm',
  'design',
  'creative',
  'art',
  'write',
  'writing',
];

const DRAINING_KEYWORDS = [
  'drama',
  'celebrity',
  'gossip',
  'outrage',
  'scandal',
  'clickbait',
  'viral',
  'feud',
  'breakup',
  'hot take',
  'doom',
  'rage',
  'politics fight',
  'exposed',
  'leaked',
  'meme',
  'cringe',
];

const NEUTRAL_KEYWORDS = [
  'login',
  'sign in',
  'checkout',
  'cart',
  'bank',
  'email',
  'inbox',
  'travel',
  'booking',
  'shop',
  'shopping',
  'account',
  'settings',
];

export interface ClassificationInput {
  title: string;
  url: string;
  pageTextSnippet?: string;
}

export interface ClassificationResult {
  category: BrowseCategory;
  confidence: number;
  topic: string | null;
}

export function isTrackableUrl(url: string | undefined): url is string {
  if (!url) {
    return false;
  }
  return !INTERNAL_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export function parseHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeText(parts: string[]): string {
  return parts
    .join(' ')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countKeywordHits(text: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => {
    return text.includes(keyword) ? count + 1 : count;
  }, 0);
}

function deriveTopic(text: string, hostname: string): string | null {
  const topicHints: Array<[string, string[]]> = [
    ['Kubernetes', ['kubernetes', 'k8s', 'helm']],
    ['Rust', ['rust', 'cargo']],
    ['Python', ['python', 'django', 'flask']],
    ['JavaScript', ['javascript', 'typescript', 'react', 'node']],
    ['AI', ['machine learning', 'llm', 'gpt', 'neural', 'transformer']],
    ['Japan', ['japan', 'tokyo', 'kyoto']],
    ['Design', ['figma', 'design system', 'ui', 'ux']],
    ['Git', ['github', 'gitlab', 'pull request']],
  ];

  for (const [topic, hints] of topicHints) {
    if (hints.some((hint) => text.includes(hint) || hostname.includes(hint))) {
      return topic;
    }
  }

  return null;
}

/** Classify a tab from title, URL, and optional page text — fully local heuristics. */
export function classifyTab(input: ClassificationInput): ClassificationResult {
  const hostname = parseHostname(input.url);
  const path = (() => {
    try {
      return new URL(input.url).pathname.toLowerCase();
    } catch {
      return '';
    }
  })();

  const combinedText = normalizeText([
    input.title,
    hostname,
    path,
    input.pageTextSnippet ?? '',
  ]);

  if (DRAINING_HOSTS.has(hostname)) {
    const pathLooksDraining = DRAINING_PATH_HINTS.some((hint) => path.includes(hint));
    if (pathLooksDraining || combinedText.includes('for you')) {
      return {
        category: 'draining',
        confidence: 0.9,
        topic: deriveTopic(combinedText, hostname),
      };
    }
  }

  if (NOURISHING_HOSTS.has(hostname)) {
    return {
      category: 'nourishing',
      confidence: 0.85,
      topic: deriveTopic(combinedText, hostname),
    };
  }

  const nourishingHits = countKeywordHits(combinedText, NOURISHING_KEYWORDS);
  const drainingHits = countKeywordHits(combinedText, DRAINING_KEYWORDS);
  const neutralHits = countKeywordHits(combinedText, NEUTRAL_KEYWORDS);

  if (drainingHits >= 2 && drainingHits > nourishingHits) {
    return {
      category: 'draining',
      confidence: Math.min(0.95, 0.55 + drainingHits * 0.1),
      topic: deriveTopic(combinedText, hostname),
    };
  }

  if (nourishingHits >= 1 && nourishingHits >= drainingHits) {
    return {
      category: 'nourishing',
      confidence: Math.min(0.95, 0.5 + nourishingHits * 0.12),
      topic: deriveTopic(combinedText, hostname),
    };
  }

  if (neutralHits >= 1) {
    return {
      category: 'neutral',
      confidence: 0.6,
      topic: deriveTopic(combinedText, hostname),
    };
  }

  return {
    category: 'neutral',
    confidence: 0.45,
    topic: deriveTopic(combinedText, hostname),
  };
}
