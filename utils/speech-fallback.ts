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
  overwhelmed: [
    'Too much internet. I’m covering my eyes for a minute.',
    'My whiskers are full. Want a softer tab?',
    'Mrrp. Overstimulated. Breather with me?',
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
  care_pet_hungry: [
    'f*** off with the pets. Can’t you see I’m starving? Feed me.',
    'Not scritches. FOOD. My bowl is empty, human.',
    'Mrrp. I need food, not pets. d*** it.',
    'Are your eyes broken? I’m hungry. Feed Tabby.',
    'Pet me when I’m full. Right now: feed me.',
    'sh** — starving over here. Open the food menu.',
    'Don’t you see I’m hungry? Feed me, not this.',
    'Wrong button, human. f***. My tummy is empty.',
    'My tummy is screaming. Less petting, more feeding.',
    'Mew?! STARVING. Not petting. Feed me.',
    'Prrt. Hungry cat. Not pet cat. Feed me.',
    'I said feed me. f***. Not pets.',
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
  feeding_munch: [
    '[hmm] [hmmm] yummy…',
    'Nom nom nom… mmmrp.',
    'Mmm… *munch munch*',
    '[slurp] So good…',
    'Mrrrp… nom nom…',
    '*crunch* Mew… tasty.',
    '[hmm] Yummy yummy…',
    'Mmm mmm… *lick*',
    'Nom nom… [hmmm] yes.',
    'Munch munch… mrrp.',
  ],
  feeding_thanks: [
    'Thanks hoooooman!',
    'My pet-human is the best.',
    'Deliciooooous!',
    'Mew mew — you saved my tummy.',
    'Prrrrt. Best snack giver ever.',
    'That hit the spot. You’re amazing.',
    'Mrrrp! I love you, snack wizard.',
    'So full now. Thank youuuu!',
    'Yum yum. You’re my favorite human.',
    'Mew! That was exactly what I needed.',
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
  playing_wild: [
    'WHEEE! Pounce pounce pounce!',
    'Zoom zoom ZOOM! Mew!',
    'Attack the invisible mouse! RAWR!',
    'I am SPEED. I am WIND. I am TABBY.',
    'Backflip! …okay that was in my head. Mrrrp!',
    'Bounce bounce bounce! Best day!',
    'My tail can’t keep up! Wheee!',
    'Mew mew mew — chaos mode ON.',
    'Prrt! That box corner didn’t stand a chance.',
    'Sideways sprint! Nom — wait, wrong button.',
    'Tail spin! Head spin! EVERYTHING spin!',
    'Mrrrp! Parkour! …on the keyboard edge.',
  ],
  playing_thanks: [
    'Phew! That was amazing. Again later?',
    'Mrrrp — playtime complete. You’re fun.',
    'Wiped out. Happy wiped out. Thanks human!',
    'Hehe. I needed that zoomies session.',
    'Best play buddy ever. Mew!',
    'Tail tired, heart happy. Prrrt.',
    '10/10 would pounce again.',
    'Mew! My paws are happy now.',
    'That was WILD. You’re the best.',
    'Prrrt. Zoomies achieved. Thank youuu!',
  ],
  dismiss: [
    'Okay. I’ll be here.',
    'I’ll hide for now. Call me back anytime.',
    'Mew. See you soon.',
    'Prrt. I’ll nap under the tabs.',
  ],
  peeking: [
    'Mew? You can’t see me. …Only my eyes.',
    'Prrt. Just peeking. Don’t look at me.',
    'Hi. I’m mostly hidden. Mew.',
    '…Did you see me? Mew mew.',
    'Hiding! …Okay, you caught me.',
    'Mrrp. I’m down here. Peek peek.',
    'Mew mew — pretend you didn’t see me.',
  ],
  overwhelmed_social: [
    'My paws are tired from all this scrolling. Breather?',
    'So many feeds. Mrrp. Maybe stretch with me?',
    'Scroll scroll scroll. Even cats need a window break.',
    'Timelines everywhere. Want to hop somewhere calmer?',
    'I’ve been watching the feed a while. Let’s air out our whiskers.',
    'Lots of little posts. Big world outside the scroll, you know?',
  ],
  overwhelmed_news: [
    'So many loud headlines. The world is gentler than this, promise.',
    'Mrrp. News loves to yell. Don’t let it rent space in your head.',
    'Propaganda wore me out. I’m covering my eyes. Softer tab?',
    'Breaking news breaking news… Tabby needs a quiet corner.',
    'Every headline thinks it’s the apocalypse. It usually isn’t.',
    'My whiskers hurt from doomscrolling. One nice page, maybe?',
    'The feed is selling panic popcorn. You don’t have to buy any.',
  ],
  recovery_easing: [
    'Prrrt… getting better. The noise is fading.',
    'Mew. Less stressful already. Breathe with me?',
    'My whiskers are uncurling. That feels softer.',
    'Mrrp. Quieter tabs already. I can feel it easing.',
    'Better, better. The loud feed is behind us.',
  ],
  recovery_thanks: [
    'Thank you for stepping away. I feel happier already.',
    'Mrrp — nice call leaving that feed. Thanks, human.',
    'So much better. Thanks for the break from the stressful stuff.',
    'My paws unclenched. Thank you for stopping that scroll.',
    'Happy whiskers again. Thanks for the gentler tabs.',
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
  if (kind === 'overwhelmed') {
    return 'overwhelmed_social';
  }
  return kind;
}

/** Dev preview: sample recovery line for easing or thanks. */
export function previewRecoverySpeech(
  kind: 'recovery_easing' | 'recovery_thanks',
  seed = 0,
): string {
  return pickLine(kind, seed);
}
