import type { BrowseCategory } from './types';
import { matchSiteRule } from './site-registry';
import { classifyYouTube, isYouTubeHost } from './youtube-classifier';

const INTERNAL_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'devtools://',
];

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
  'stackoverflow',
  'kubernetes',
  'aws',
  'azure',
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
  'for you',
  'trending',
  'explore',
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
}

export type ClassificationSource = 'registry' | 'youtube' | 'keywords' | 'default';

export interface ClassificationResult {
  category: BrowseCategory;
  confidence: number;
  topic: string | null;
  source: ClassificationSource;
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

function parsePath(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
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

function deriveTopic(text: string, hostname: string, hint?: string | null): string | null {
  if (hint) {
    return hint;
  }

  const topicHints: Array<[string, string[]]> = [
    ['Kubernetes', ['kubernetes', 'k8s', 'helm']],
    ['Rust', ['rust', 'cargo']],
    ['Python', ['python', 'django', 'flask']],
    ['JavaScript', ['javascript', 'typescript', 'react', 'node']],
    ['AI', ['machine learning', 'llm', 'gpt', 'neural', 'transformer']],
    ['Japan', ['japan', 'tokyo', 'kyoto']],
    ['Design', ['figma', 'design system', 'ui', 'ux']],
    ['Git', ['github', 'gitlab', 'pull request']],
    ['AWS', ['aws', 'amazon web services', 'ec2', 's3']],
    ['Azure', ['azure', 'microsoft cloud']],
  ];

  for (const [topic, hints] of topicHints) {
    if (hints.some((token) => text.includes(token) || hostname.includes(token))) {
      return topic;
    }
  }

  return null;
}

/** Classify a tab from title and URL only — fully local heuristics. */
export function classifyTab(input: ClassificationInput): ClassificationResult {
  const hostname = parseHostname(input.url);
  const path = parsePath(input.url);
  const combinedText = normalizeText([input.title, hostname, path]);

  const siteRule = matchSiteRule(hostname, path);
  if (siteRule && siteRule.category !== 'neutral') {
    return {
      category: siteRule.category,
      confidence: 0.88,
      topic: deriveTopic(combinedText, hostname, siteRule.topic),
      source: 'registry',
    };
  }

  if (isYouTubeHost(hostname)) {
    const youtube = classifyYouTube(input.title, path);
    return {
      ...youtube,
      topic: deriveTopic(combinedText, hostname, 'Video'),
      source: 'youtube',
    };
  }

  if (siteRule?.category === 'neutral') {
    const nourishingHits = countKeywordHits(combinedText, NOURISHING_KEYWORDS);
    const drainingHits = countKeywordHits(combinedText, DRAINING_KEYWORDS);

    if (drainingHits >= 1 && drainingHits > nourishingHits) {
      return {
        category: 'draining',
        confidence: 0.65,
        topic: deriveTopic(combinedText, hostname, siteRule.topic),
        source: 'keywords',
      };
    }
    if (nourishingHits >= 1) {
      return {
        category: 'nourishing',
        confidence: 0.65,
        topic: deriveTopic(combinedText, hostname, siteRule.topic),
        source: 'keywords',
      };
    }

    return {
      category: 'neutral',
      confidence: 0.62,
      topic: deriveTopic(combinedText, hostname, siteRule.topic),
      source: 'registry',
    };
  }

  const nourishingHits = countKeywordHits(combinedText, NOURISHING_KEYWORDS);
  const drainingHits = countKeywordHits(combinedText, DRAINING_KEYWORDS);
  const neutralHits = countKeywordHits(combinedText, NEUTRAL_KEYWORDS);

  if (drainingHits >= 2 && drainingHits > nourishingHits) {
    return {
      category: 'draining',
      confidence: Math.min(0.9, 0.55 + drainingHits * 0.1),
      topic: deriveTopic(combinedText, hostname),
      source: 'keywords',
    };
  }

  if (nourishingHits >= 1 && nourishingHits >= drainingHits) {
    return {
      category: 'nourishing',
      confidence: Math.min(0.9, 0.5 + nourishingHits * 0.12),
      topic: deriveTopic(combinedText, hostname),
      source: 'keywords',
    };
  }

  if (neutralHits >= 1) {
    return {
      category: 'neutral',
      confidence: 0.6,
      topic: deriveTopic(combinedText, hostname),
      source: 'keywords',
    };
  }

  return {
    category: 'neutral',
    confidence: 0.4,
    topic: deriveTopic(combinedText, hostname),
    source: 'default',
  };
}
