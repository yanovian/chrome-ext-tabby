import { sanitizePageTitleHint } from './speech-quality';
import type { SpeechContext } from './speech-types';

const STAGE_LABEL: Record<SpeechContext['stage'], string> = {
  newborn: 'newborn kitten',
  playful: 'playful kitten',
  adult: 'adult cat',
};

function trimHint(value: string | undefined, max = 80): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/** One-line situation for the model — mood and need only, no open-ended story hooks. */
function requiredThemeLine(kind: SpeechContext['kind']): string {
  switch (kind) {
    case 'starving':
      return 'Required theme: Tabby is very hungry and needs something to read.';
    case 'hungry':
      return 'Required theme: Tabby feels hungry or peckish and wants a good page.';
    case 'stressed':
      return 'Required theme: Tabby feels stressed by loud or overwhelming tabs.';
    case 'lonely':
      return 'Required theme: Tabby feels lonely and wants company while browsing.';
    case 'happy':
      return 'Required theme: Tabby feels happy and cheerful.';
    case 'sleepy':
      return 'Required theme: Tabby feels sleepy or drowsy.';
    case 'curious':
      return 'Required theme: Tabby is curious about what the user is reading.';
    case 'memory':
      return 'Required theme: Tabby remembers visiting this topic before.';
    case 'milestone':
      return 'Required theme: Tabby celebrates time together with the user.';
    default:
      return '';
  }
}

function situationLine(context: SpeechContext): string {
  switch (context.kind) {
    case 'starving':
      return 'Tabby is very hungry for something interesting to read.';
    case 'hungry':
      return 'Tabby is a little hungry and wants a fun new page.';
    case 'stressed':
      return 'Tabby feels overwhelmed by loud, angry pages and wants calm.';
    case 'lonely':
      return 'Tabby misses company and quiet browsing together.';
    case 'happy':
      return 'Tabby is cheerful and content today.';
    case 'sleepy':
      return 'Tabby is drowsy but keeping watch nearby.';
    case 'curious':
      return 'Tabby is curious about what the user is reading.';
    case 'memory':
      return 'Tabby remembers visiting this topic with the user before.';
    case 'milestone':
      return 'Tabby celebrates another day together with the user.';
    case 'dev':
      return 'Tabby is testing a short dev speech line.';
    default:
      return 'Tabby wants to say something brief and cute.';
  }
}

function speechRules(context: SpeechContext): string {
  const rules = [
    'First person only (I / me / my).',
    'One short sentence, 6 to 16 words.',
    'Sweet browser cat — never insult or blame the user.',
    'No stories, facts, definitions, or third-person narration.',
  ];

  if (context.mood === 'stressed' || context.kind === 'stressed') {
    rules.push(
      'She may grumble about noisy pages with censored frustration like f*** — never at the user.',
    );
  } else {
    rules.push('No profanity.');
  }

  return rules.join(' ');
}

function includePageContext(kind: SpeechContext['kind']): boolean {
  return kind !== 'ask' && kind !== 'dismiss' && !kind.startsWith('care_');
}

/**
 * Compact FLAN-T5 prompt: task + situation + optional hints + completion prefix.
 * Small text-to-text models behave better with explicit rules and a fixed prefix.
 */
export function buildSpeechPrompt(context: SpeechContext): string {
  const parts = [
    'Task: Write Tabby\'s next speech bubble.',
    `Rules: ${speechRules(context)}`,
    `Tabby is a ${STAGE_LABEL[context.stage]}.`,
    situationLine(context),
    `Mood label: ${context.mood}.`,
  ];

  const themeLine = requiredThemeLine(context.kind);
  if (themeLine) {
    parts.push(themeLine);
  }

  if (includePageContext(context.kind)) {
    const pageTopic = trimHint(context.pageTopic, 40);
    const pageTitle = sanitizePageTitleHint(context.pageTitle);
    const memoryTopic = trimHint(context.memoryTopic, 40);

    if (pageTopic) {
      parts.push(`Browsing topic lately: ${pageTopic}.`);
    } else if (pageTitle) {
      parts.push(`Current page title: ${pageTitle}.`);
    }
    if (memoryTopic) {
      parts.push(`Remembered topic: ${memoryTopic}.`);
    }
  }

  if (context.milestoneDays) {
    parts.push(`Days together with user: ${context.milestoneDays}.`);
  }

  parts.push('Tabby says:');
  return parts.join(' ');
}

/** Clean up model output for the speech bubble. */
export function postProcessSpeech(raw: string, context?: SpeechContext): string | null {
  let text = raw
    .replace(/^[\s"'`]+|[\s"'`]+$/g, '')
    .replace(/^tabby:\s*/i, '')
    .replace(/^answer:\s*/i, '')
    .replace(/^tabby says:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return null;
  }

  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter(Boolean);
  if (sentences && sentences.length > 0) {
    text = sentences[0] ?? text;
  }

  if (text.length > 140) {
    text = `${text.slice(0, 137).trim()}…`;
  }

  if (context) {
    const normalized = normalizeSpeechProfanity(text, context);
    if (!normalized) {
      return null;
    }
    text = normalized;
  }

  return text;
}

const UNCENSORED_PROFANITY =
  /\b(fuck(?:ing|ed|er|s)?|shit(?:ty|s)?|bitch(?:es)?|asshole?s?|damn(?:ed)?|cunt|bastard)\b/i;

const CENSORED_FRUSTRATION = /\bf\*{2,}|\bs\*{2,}/i;

/** Censor or drop profanity based on mood. Stressed Tabby may use f*** about pages, not the user. */
export function normalizeSpeechProfanity(text: string, context: SpeechContext): string | null {
  const stressed = context.mood === 'stressed' || context.kind === 'stressed';

  if (UNCENSORED_PROFANITY.test(text)) {
    if (!stressed) {
      return null;
    }
    text = text
      .replace(/\bfuck(?:ing|ed|er|s)?\b/gi, 'f***')
      .replace(/\bshit(?:ty|s)?\b/gi, 's***')
      .replace(/\bdamn(?:ed)?\b/gi, 'd***');
    if (UNCENSORED_PROFANITY.test(text)) {
      return null;
    }
  }

  if (!stressed && CENSORED_FRUSTRATION.test(text)) {
    return null;
  }

  return text;
}
