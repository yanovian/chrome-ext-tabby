import type { SpeechContext, SpeechKind } from './speech-types';
import type { SpeechTriggerKind } from './types';

const FALLBACK_LINES: Record<SpeechKind, string[]> = {
  starving: [
    'I’m so hungry. Got anything good?',
    'Empty tummy. Help me out?',
    'I need something tasty to read.',
  ],
  hungry: [
    'Find anything fun today?',
    'I could use a little something new.',
    'Got a page worth pouncing on?',
  ],
  stressed: [
    'Everything feels loud. Somewhere quieter?',
    'This is a lot. Can we take it easy?',
    'My whiskers are buzzing. Softer tabs?',
  ],
  lonely: [
    'It’s been quiet. Where should we go?',
    'I missed you. Explore something with me?',
    'Keep me company for a bit?',
  ],
  happy: [
    'Hey. I’m in a good mood.',
    'Nice day, huh?',
    'Life feels cozy right now.',
  ],
  sleepy: [
    'I’ll nap nearby…',
    'Zzz… oh, hi.',
    'I’m drowsy but still here.',
  ],
  curious: [
    'What’s this?',
    'Ooh, interesting.',
    'This page smells like fun.',
  ],
  memory: [
    'This feels familiar.',
    'We’ve been here before, haven’t we?',
    'I remember this topic.',
  ],
  milestone: [
    'Do you know what day it is? Our day.',
    'Still us. Still here. I’m glad.',
    'Another little anniversary with you.',
  ],
  dev: [
    'Dev mode — extra chatty for testing.',
    'Dev mode — tap something and see what happens.',
  ],
  ask: [
    'I’m okay. Just hanging out.',
    'Still here with you.',
  ],
  care_pet: [
    'Mmm. That helped.',
    'Purrr. Better now.',
    'That was nice.',
    'Right there. Perfect.',
    'Soft pets. I needed that.',
  ],
  care_treat: [
    'Better. Thank you.',
    'Yum. That hit the spot.',
    'Much nicer now.',
  ],
  care_play: [
    'Again! …okay, I’m good.',
    'That was fun.',
    'Hehe. I needed that.',
    'Wheee! My paws are happy.',
    'You’re good at this game.',
  ],
  dismiss: [
    'Okay. I’ll be here.',
    'I’ll hide for now. Call me back anytime.',
  ],
};

function pickLine(kind: SpeechKind, seed: number): string {
  const lines = FALLBACK_LINES[kind] ?? FALLBACK_LINES.ask;
  const index = Math.abs(seed) % lines.length;
  return lines[index] ?? lines[0] ?? '';
}

export function fallbackSpeech(context: SpeechContext): string {
  if (context.kind === 'memory' && context.memoryTopic) {
    return `We looked at ${context.memoryTopic} together before. I remember.`;
  }

  if (context.kind === 'milestone' && context.milestoneDays) {
    const days = context.milestoneDays;
    if (days === 1) {
      return 'First day together. Hi — I’m Tabby.';
    }
    if (days === 7) {
      return 'A week already. I’m learning your rhythm.';
    }
    if (days === 30) {
      return 'A month. We’ve got history now.';
    }
    if (days === 100) {
      return '100 days. That’s a lot of exploring.';
    }
    if (days === 365) {
      return 'A whole year. I remember so much.';
    }
  }

  return pickLine(context.kind, context.seed);
}

export function triggerKindToSpeechKind(kind: SpeechTriggerKind): SpeechKind {
  return kind;
}
