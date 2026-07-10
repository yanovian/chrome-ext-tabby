import type { BrowseCategory } from './types';

/** Title phrases that suggest learning, depth, calm focus, or wholesome reading. */
export const NOURISHING_TITLE_HINTS = [
  'tutorial',
  'course',
  'lecture',
  'documentary',
  'how to',
  'explained',
  'learn',
  'learning',
  'programming',
  'coding',
  'kubernetes',
  'aws',
  'science',
  'research',
  'guide',
  'walkthrough',
  'deep dive',
  'documentation',
  'docs',
  'developer',
  'api',
  'reference',
  'build',
  'project',
  'paper',
  'algorithm',
  'design',
  'creative',
  'art',
  'writing',
  'educational',
  'history',
  'nature',
  'wildlife',
  'masterclass',
  'lesson',
  'book',
  'ebook',
  'e-book',
  'audiobook',
  'chapter',
  'novel',
  'reading',
  'kindle',
  'goodreads',
  'library',
] as const;

/** Title phrases that suggest gossip, outrage, or short-form scroll video. */
export const DRAINING_TITLE_HINTS = [
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
  'tiktok',
  'reels',
  'tiktok compilation',
  'prank',
  'roast',
  'celebrity',
  'feud',
  'scandal',
  'viral',
  'breakup',
  'hot take',
  'meme',
  'meme compilation',
  'best moments',
  'highlights',
  'trash talk',
] as const;

export interface TitleHintScore {
  nourishingHits: number;
  drainingHits: number;
}

export function scoreTitleHints(title: string): TitleHintScore {
  const normalized = title.toLowerCase();
  const nourishingHits = NOURISHING_TITLE_HINTS.filter((hint) => normalized.includes(hint)).length;
  const drainingHits = DRAINING_TITLE_HINTS.filter((hint) => normalized.includes(hint)).length;
  return { nourishingHits, drainingHits };
}

export interface TitleClassification {
  category: BrowseCategory;
  confidence: number;
}

/**
 * Guess category from tab title on neutral or unknown hosts.
 * Returns null when the title gives no clear signal.
 */
export function classifyFromTitleHints(
  title: string,
  options?: { minDrainingHits?: number; minNourishingHits?: number },
): TitleClassification | null {
  const { nourishingHits, drainingHits } = scoreTitleHints(title);
  const minDraining = options?.minDrainingHits ?? 1;
  const minNourishing = options?.minNourishingHits ?? 1;

  if (drainingHits >= minDraining && drainingHits >= nourishingHits) {
    return {
      category: 'draining',
      confidence: Math.min(0.9, 0.6 + drainingHits * 0.1),
    };
  }

  if (nourishingHits >= minNourishing) {
    return {
      category: 'nourishing',
      confidence: Math.min(0.9, 0.55 + nourishingHits * 0.12),
    };
  }

  return null;
}
