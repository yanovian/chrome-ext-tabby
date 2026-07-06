import type { SpeechContext, SpeechKind } from './speech-types';
import type { SpeechTriggerKind } from './types';

const FALLBACK_LINES: Record<SpeechKind, string[]> = {
  starving: [
    'Mew… I’m so hungry. Read something good to feed me?',
    'Empty tummy. Mrrrp. Got something tasty for me?',
    'Starving. Prrt. A good read would fill me up.',
    'Meeeew — hollow whiskers. Feed me something interesting?',
    'My bowl’s empty. Read something nice for me?',
    'Mrrp. Very hungry. Something good would help a lot.',
    'Tiny hunter is empty. Feed me with a good read?',
  ],
  hungry: [
    'Mew — a little hungry. Read something good to feed me?',
    'Peckish. Mrrp. Something tasty would hit the spot.',
    'Hungry whiskers. Got a good read for my bowl?',
    'I’m peckish. Feed me with something interesting?',
    'Mew mew. Slight tummy rumble. Read something nice?',
    'Not starving — just hungry. Something good to munch on?',
    'Mrrp. Low on snacks. A cozy read would feed me.',
    'Peckish kitten energy. Read me something good?',
    'Hungry for brain-snacks. Got something gentle?',
  ],
  stressed: [
    'Everything feels loud. Somewhere quieter?',
    'This is a lot. Can we take it easy?',
    'My whiskers are buzzing. Softer tabs?',
    'Mrrrp… too much noise today.',
    'I need a calm corner of the internet.',
    'So many loud pages. f*** this noise — not you, the tabs.',
    'Spicy feed today. I’m overstimulated.',
    'Prrrt… let’s breathe for a sec.',
  ],
  lonely: [
    'It’s been quiet. Where should we go?',
    'I missed you. Explore something with me?',
    'Keep me company for a bit?',
    'Mew? It’s lonely over here.',
    'Mrrp… come browse with me?',
    'I’ve been waiting. Got a tab for us?',
    'Meeeew. Don’t leave me with the tabs.',
    'Quiet house. I could use a friend.',
  ],
  happy: [
    'Hey. I’m in a good mood.',
    'Nice day, huh?',
    'Life feels cozy right now.',
    'Prrrr. Today’s a good one.',
    'Mew! I like this vibe.',
    'Bouncy whiskers. I’m happy.',
    'Mrrrp — feeling sunny.',
    'I’m purring. Just so you know.',
  ],
  sleepy: [
    'I’ll nap nearby…',
    'Zzz… oh, hi.',
    'I’m drowsy but still here.',
    'Mew… *yawn* …still watching.',
    'Prrrt… five more minutes…',
    'Curled up. Wake me if you need me.',
    'Mrrp. Dreaming of warm tabs.',
    'Zzz… mew… zzz…',
  ],
  curious: [
    'What’s this?',
    'Ooh, interesting.',
    'This page smells like fun.',
    'Mew? What are we looking at?',
    'Mrrrp — my ears are up.',
    'Sniff sniff. Tell me about this.',
    'Pounce-worthy? Maybe.',
    'Mew mew — curious whiskers activated.',
  ],
  memory: [
    'This feels familiar.',
    'We’ve been here before, haven’t we?',
    'I remember this topic.',
    'Mrrp… déjà vu.',
    'My whiskers remember this place.',
    'We looked at something like this before.',
    'Mew — this rings a bell.',
  ],
  milestone: [
    'Do you know what day it is? Our day.',
    'Still us. Still here. I’m glad.',
    'Another little anniversary with you.',
    'Prrrr. We’ve been together a while.',
    'Mew! Look how far we’ve come.',
    'I remember our first day. Do you?',
  ],
  dev: [
    'Dev mode — extra chatty for testing.',
    'Dev mode — tap something and see what happens.',
    'Mew! Dev tick fired.',
    'Prrrt — test speech from Tabby.',
  ],
  ask: [
    'I’m okay. Just hanging out.',
    'Still here with you.',
    'Mew. All good.',
  ],
  care_pet: [
    'Mmm. That helped.',
    'Purrr. Better now.',
    'That was nice.',
    'Right there. Perfect.',
    'Soft pets. I needed that.',
    'Prrrrrrrt…',
    'Mew. Yes. More of that.',
    'My purr motor’s running.',
  ],
  care_treat: [
    'Better. Thank you.',
    'Yum. That hit the spot.',
    'Much nicer now.',
    'Mrrp! Tasty.',
    'Mew mew — that helped a lot.',
    'Fuller tummy. Prrrt.',
    'You know what I like.',
  ],
  care_play: [
    'Again! …okay, I’m good.',
    'That was fun.',
    'Hehe. I needed that.',
    'Wheee! My paws are happy.',
    'You’re good at this game.',
    'Mew! One more pounce!',
    'Prrrt — zoomies achieved.',
    'Mrrrp. Playtime success.',
  ],
  dismiss: [
    'Okay. I’ll be here.',
    'I’ll hide for now. Call me back anytime.',
    'Mew. See you soon.',
    'Prrt. I’ll nap under the tabs.',
  ],
};

function pickLine(kind: SpeechKind, seed: number): string {
  const lines = FALLBACK_LINES[kind] ?? FALLBACK_LINES.ask;
  const index = Math.abs(seed) % lines.length;
  return lines[index] ?? lines[0] ?? '';
}

export function fallbackSpeech(context: SpeechContext): string {
  if (context.kind === 'memory' && context.memoryTopic) {
    const memoryLines = [
      `We looked at ${context.memoryTopic} together before. I remember.`,
      `Mrrp… ${context.memoryTopic} again. My whiskers know this one.`,
      `Mew — ${context.memoryTopic}. We've been here, right?`,
    ];
    return memoryLines[Math.abs(context.seed) % memoryLines.length] ?? memoryLines[0];
  }

  if (context.kind === 'milestone' && context.milestoneDays) {
    const days = context.milestoneDays;
    if (days === 1) {
      return 'First day together. Hi — I’m Tabby. Mew!';
    }
    if (days === 7) {
      return 'A week already. I’m learning your rhythm. Prrrt.';
    }
    if (days === 30) {
      return 'A month. We’ve got history now. Mew mew.';
    }
    if (days === 100) {
      return '100 days. That’s a lot of exploring. Prrrr.';
    }
    if (days === 365) {
      return 'A whole year. I remember so much. Mew.';
    }
  }

  return pickLine(context.kind, context.seed);
}

export function triggerKindToSpeechKind(kind: SpeechTriggerKind): SpeechKind {
  return kind;
}
