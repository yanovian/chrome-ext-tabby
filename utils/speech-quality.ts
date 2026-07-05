import type { SpeechContext } from './speech-types';

/** Patterns that usually mean the model drifted into encyclopedia or story mode. */
const BAD_SPEECH_PATTERNS = [
  /\b(open source|software|application|platform|corporation|company)\b/i,
  /\b(provides|allows users|people of all ages|designed to|developed by)\b/i,
  /\b(Wikipedia|according to|defined as|is a type of|refers to)\b/i,
  /\b(website|web site|search engine|browser extension)\b/i,
  /\b(Google|Microsoft|Apple|Facebook|Meta)\s+is\b/i,
  /\b(little girl|little boy|baby who|wants to make)\b/i,
  /\b(picture of|photo of|image of|drawing of|screenshot of)\b/i,
  /\b(story about|a story|once upon|there was a|in a park|in the park)\b/i,
  /\babout a (kitten|cat|tabby)\b/i,
  /\b(the most important|in the life of|life of the cat)\b/i,
  /\b(the cat|the kitten|tabby is|tabby was)\b/i,
  /\b(he |she |they )(?:is|was|says|said|wants|wanted)\b/i,
];

/** Never insult or attack the user — even when Tabby is stressed. */
const USER_INSULT_PATTERNS = [
  /\b(you\s+(?:are|'re)\s+(?:an?\s+)?(?:idiot|stupid|dumb|moron|worthless|pathetic|awful|terrible|useless|annoying|bad))\b/i,
  /\b(hate\s+you|screw\s+you|f+\*+\s*you|fuck\s+you|shut\s+up|go\s+away)\b/i,
  /\b(stupid\s+(?:human|user|person|owner))\b/i,
  /\b(dumb\s+(?:human|user|person|owner))\b/i,
];

const FIRST_PERSON_HINT =
  /\b(I|me|my|mine|I'm|I've|I'd|I'll|Ive|Im)\b/i;

const CAT_MURMUR_HINT =
  /\b(mew|mrrp|prrr|purr|meow|mrow|nya|meee+w+)\b/i;

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

/** True when the line sounds like Tabby, not a product blurb or insult. */
export function isAcceptableTabbySpeech(
  text: string,
  context: SpeechContext,
): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length < 4 || normalized.length > 160) {
    return false;
  }

  const wordCount = normalized.split(/\s+/).length;
  const murmurOnly =
    CAT_MURMUR_HINT.test(normalized) && !FIRST_PERSON_HINT.test(normalized);
  if (wordCount < (murmurOnly ? 1 : 3) || wordCount > 22) {
    return false;
  }

  for (const pattern of BAD_SPEECH_PATTERNS) {
    if (pattern.test(normalized)) {
      return false;
    }
  }

  for (const pattern of USER_INSULT_PATTERNS) {
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

  if (context.kind !== 'dev') {
    if (!FIRST_PERSON_HINT.test(normalized) && !CAT_MURMUR_HINT.test(normalized)) {
      return false;
    }
  }

  return true;
}
