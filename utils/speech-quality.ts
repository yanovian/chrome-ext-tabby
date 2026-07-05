import type { SpeechContext } from './speech-types';

/** Patterns that usually mean the model drifted into encyclopedia mode. */
const BAD_SPEECH_PATTERNS = [
  /\b(open source|software|application|platform|corporation|company)\b/i,
  /\b(provides|allows users|people of all ages|designed to|developed by)\b/i,
  /\b(Wikipedia|according to|defined as|is a type of)\b/i,
  /\b(website|web site|search engine|browser extension)\b/i,
  /\b(Google|Microsoft|Apple|Facebook|Meta)\s+is\b/i,
  /\b(little girl|little boy|baby who|wants to make)\b/i,
  /\b(picture of|photo of|image of|drawing of|screenshot of)\b/i,
];

const CAT_VOICE_HINT =
  /\b(I|me|my|I'm|I've|we|you|purrr|purr|mew|whisk|tummy|nap|pounce|cozy|tabby|kitten|cat)\b/i;

const GENERIC_HOME_TITLES =
  /^(google|google search|bing|yahoo|duckduckgo|facebook|twitter|x|reddit|youtube|home)$/i;

/** Skip homepage / brand titles that make small models hallucinate facts. */
export function sanitizePageTitleHint(title: string | undefined): string | undefined {
  if (!title) {
    return undefined;
  }

  const trimmed = title.replace(/\s+/g, ' ').trim();
  if (!trimmed || GENERIC_HOME_TITLES.test(trimmed)) {
    return undefined;
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}(\s|$)/i.test(trimmed) && trimmed.split(/\s+/).length <= 2) {
    return undefined;
  }

  return trimmed.length > 60 ? `${trimmed.slice(0, 59)}…` : trimmed;
}

/** True when the line sounds like Tabby, not a product blurb. */
export function isAcceptableTabbySpeech(
  text: string,
  context: SpeechContext,
): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length < 4 || normalized.length > 180) {
    return false;
  }

  if (normalized.split(/\s+/).length > 22) {
    return false;
  }

  for (const pattern of BAD_SPEECH_PATTERNS) {
    if (pattern.test(normalized)) {
      return false;
    }
  }

  const titleHint = sanitizePageTitleHint(context.pageTitle);
  if (titleHint) {
    const lead = titleHint.split(/\s+/)[0];
    if (lead && lead.length > 2 && new RegExp(`\\b${lead}\\s+is\\b`, 'i').test(normalized)) {
      return false;
    }
  }

  if (context.kind !== 'dev' && !CAT_VOICE_HINT.test(normalized)) {
    return false;
  }

  return true;
}
