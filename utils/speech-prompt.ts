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

function kindInstruction(kind: SpeechContext['kind']): string {
  switch (kind) {
    case 'starving':
      return 'Tabby is very hungry for interesting browsing.';
    case 'hungry':
      return 'Tabby wants something new and curious to explore.';
    case 'stressed':
      return 'Tabby feels overwhelmed by loud pages and wants calm.';
    case 'lonely':
      return 'Tabby misses company and quiet exploration together.';
    case 'happy':
      return 'Tabby is cheerful and content with today.';
    case 'sleepy':
      return 'Tabby is drowsy and keeping gentle watch.';
    case 'curious':
      return 'Tabby is intrigued by the current page.';
    case 'memory':
      return 'Tabby remembers exploring this topic together before.';
    case 'milestone':
      return 'Tabby celebrates time together with the user.';
    case 'ask':
      return 'The user asked how Tabby feels right now.';
    case 'care_pet':
      return 'The user petted Tabby and she responds warmly.';
    case 'care_treat':
      return 'The user fed Tabby something interesting.';
    case 'care_play':
      return 'The user played with Tabby.';
    case 'dismiss':
      return 'The user asked Tabby to hide for a while.';
    case 'dev':
      return 'Dev mode test line.';
    default:
      return 'Tabby speaks briefly.';
  }
}

function includePageContext(kind: SpeechContext['kind']): boolean {
  return (
    kind !== 'ask' &&
    kind !== 'dismiss' &&
    !kind.startsWith('care_')
  );
}

/** Build a compact prompt for the local text model. */
export function buildSpeechPrompt(context: SpeechContext): string {
  const parts = [
    `Question: What does Tabby the ${STAGE_LABEL[context.stage]} say in first person?`,
    kindInstruction(context.kind),
    `Mood: ${context.mood}.`,
    'Answer in one cute sentence. No facts about companies or websites.',
  ];

  if (includePageContext(context.kind)) {
    const pageTitle = sanitizePageTitleHint(context.pageTitle);
    const pageTopic = trimHint(context.pageTopic, 40);
    const memoryTopic = trimHint(context.memoryTopic, 40);

    if (pageTopic) {
      parts.push(`Topic lately: ${pageTopic}.`);
    } else if (pageTitle) {
      parts.push(`Browsing: ${pageTitle}.`);
    }
    if (memoryTopic) {
      parts.push(`Recent memory: ${memoryTopic}.`);
    }
  }

  if (context.milestoneDays) {
    parts.push(`Days together: ${context.milestoneDays}.`);
  }

  parts.push('Answer:');
  return parts.join(' ');
}

/** Clean up model output for the speech bubble. */
export function postProcessSpeech(raw: string): string | null {
  let text = raw
    .replace(/^[\s"'`]+|[\s"'`]+$/g, '')
    .replace(/^tabby:\s*/i, '')
    .replace(/^answer:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return null;
  }

  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter(Boolean);
  if (sentences && sentences.length > 0) {
    text = sentences.slice(0, 2).join(' ');
  }

  if (text.length > 160) {
    text = `${text.slice(0, 157).trim()}…`;
  }

  return text;
}
