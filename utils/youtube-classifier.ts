import type { BrowseCategory } from './types';

const YOUTUBE_HOSTS = new Set(['youtube.com', 'youtu.be', 'm.youtube.com']);

const NOURISHING_TITLE_HINTS = [
  'tutorial',
  'course',
  'lecture',
  'documentary',
  'how to',
  'explained',
  'learn',
  'programming',
  'coding',
  'kubernetes',
  'aws',
  'science',
  'research',
  'guide',
  'walkthrough',
  'deep dive',
];

const DRAINING_TITLE_HINTS = [
  'drama',
  'reaction',
  'reacts',
  'cringe',
  'gossip',
  'exposed',
  'rant',
  'outrage',
  'clickbait',
  'shorts',
  'tiktok compilation',
  'prank',
  'roast',
  'celebrity',
  'feud',
];

export function isYouTubeHost(hostname: string): boolean {
  const normalized = hostname.replace(/^www\./, '').toLowerCase();
  return YOUTUBE_HOSTS.has(normalized) || normalized.endsWith('.youtube.com');
}

/** Guess YouTube video mood from URL path and tab title only — no page body. */
export function classifyYouTube(
  title: string,
  path: string,
): { category: BrowseCategory; confidence: number } {
  const normalizedTitle = title.toLowerCase();
  const normalizedPath = path.toLowerCase();

  if (normalizedPath.includes('/shorts')) {
    return { category: 'draining', confidence: 0.8 };
  }

  const nourishingHits = NOURISHING_TITLE_HINTS.filter((hint) =>
    normalizedTitle.includes(hint),
  ).length;
  const drainingHits = DRAINING_TITLE_HINTS.filter((hint) =>
    normalizedTitle.includes(hint),
  ).length;

  if (drainingHits >= 1 && drainingHits >= nourishingHits) {
    return {
      category: 'draining',
      confidence: Math.min(0.9, 0.6 + drainingHits * 0.1),
    };
  }

  if (nourishingHits >= 1) {
    return {
      category: 'nourishing',
      confidence: Math.min(0.9, 0.55 + nourishingHits * 0.12),
    };
  }

  if (normalizedPath.includes('/watch') || normalizedPath.includes('/live')) {
    return { category: 'neutral', confidence: 0.5 };
  }

  return { category: 'neutral', confidence: 0.45 };
}
