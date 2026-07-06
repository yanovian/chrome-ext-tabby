import type { BrowseCategory } from './types';

export interface ClassifyPromptInput {
  title: string;
  url: string;
}

function trimField(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/** Compact FLAN-T5 prompt — one-word category answer. */
export function buildClassifyPrompt(input: ClassifyPromptInput): string {
  const title = trimField(input.title, 120);
  const url = trimField(input.url, 160);

  return [
    'Task: Classify how this browser tab feels for a cat companion.',
    'Answer with exactly one word: nourishing, draining, or neutral.',
    'nourishing = learning, docs, creative work, calm reference.',
    'draining = outrage feeds, gossip, doomscroll, loud drama.',
    'neutral = banking, shopping, email, errands, generic browsing.',
    `Page title: ${title || '(untitled)'}.`,
    `Page URL: ${url}.`,
    'Category:',
  ].join(' ');
}

const VALID_CATEGORIES = new Set<BrowseCategory>(['nourishing', 'draining', 'neutral']);

/** Parse model output into a browse category. */
export function parseClassifyAnswer(raw: string): BrowseCategory | null {
  const normalized = raw
    .toLowerCase()
    .replace(/^category:\s*/i, '')
    .replace(/^answer:\s*/i, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();

  if (!normalized) {
    return null;
  }

  for (const category of VALID_CATEGORIES) {
    if (normalized.includes(category)) {
      return category;
    }
  }

  if (normalized.includes('nourish') || normalized.includes('learn')) {
    return 'nourishing';
  }
  if (normalized.includes('drain') || normalized.includes('stress')) {
    return 'draining';
  }
  if (normalized.includes('neutral') || normalized.includes('errand')) {
    return 'neutral';
  }

  return null;
}
