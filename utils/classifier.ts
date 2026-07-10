import type { BrowseCategory } from './types';
import { matchSiteRule } from './site-registry';
import { classifyFromTitleHints } from './title-keywords';
import { classifyVideoPlatform, isVideoPlatformHost } from './video-platform-classifier';

const INTERNAL_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'devtools://',
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

export type ClassificationSource = 'registry' | 'video' | 'keywords' | 'default';

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

function countKeywordHits(text: string, keywords: readonly string[]): number {
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
    ['Books', ['ebook', 'audiobook', 'kindle', 'chapter', 'novel']],
  ];

  for (const [topic, hints] of topicHints) {
    if (hints.some((token) => text.includes(token) || hostname.includes(token))) {
      return topic;
    }
  }

  return null;
}

function classifyByTitle(
  title: string,
  siteRule: { topic?: string } | null,
  combinedText: string,
  hostname: string,
): ClassificationResult | null {
  const fromTitle = classifyFromTitleHints(title);
  if (fromTitle) {
    return {
      ...fromTitle,
      topic: deriveTopic(combinedText, hostname, siteRule?.topic),
      source: 'keywords',
    };
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

  if (isVideoPlatformHost(hostname)) {
    const video = classifyVideoPlatform(input.title, path);
    return {
      ...video,
      topic: deriveTopic(combinedText, hostname, 'Video'),
      source: 'video',
    };
  }

  if (siteRule?.category === 'neutral') {
    const fromTitle = classifyByTitle(input.title, siteRule, combinedText, hostname);
    if (fromTitle) {
      return fromTitle;
    }

    return {
      category: 'neutral',
      confidence: 0.62,
      topic: deriveTopic(combinedText, hostname, siteRule.topic),
      source: 'registry',
    };
  }

  const fromTitle = classifyByTitle(input.title, null, combinedText, hostname);
  if (fromTitle) {
    return fromTitle;
  }

  const neutralHits = countKeywordHits(combinedText, NEUTRAL_KEYWORDS);
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
