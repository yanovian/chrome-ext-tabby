import { describe, expect, it } from 'vitest';
import {
  isAcceptableTabbySpeech,
  sanitizePageTitleHint,
} from '../utils/speech-quality';

describe('sanitizePageTitleHint', () => {
  it('drops generic search homepages that confuse the model', () => {
    expect(sanitizePageTitleHint('Google')).toBeUndefined();
    expect(sanitizePageTitleHint('Google Search')).toBeUndefined();
  });

  it('keeps specific page titles', () => {
    expect(sanitizePageTitleHint('Kubernetes docs — scheduling')).toBe(
      'Kubernetes docs — scheduling',
    );
  });
});

describe('isAcceptableTabbySpeech', () => {
  const baseContext = {
    kind: 'hungry' as const,
    mood: 'hungry' as const,
    stage: 'adult' as const,
    seed: 1,
  };

  it('rejects encyclopedia-style product blurbs', () => {
    expect(
      isAcceptableTabbySpeech(
        'Google is an open source application that provides software for people of all ages.',
        { ...baseContext, pageTitle: 'Google' },
      ),
    ).toBe(false);
  });

  it('rejects nonsense that does not sound like Tabby', () => {
    expect(
      isAcceptableTabbySpeech(
        'a little girl is a baby who wants to make a good baby',
        { kind: 'care_play', mood: 'happy', stage: 'playful', seed: 1 },
      ),
    ).toBe(false);
    expect(
      isAcceptableTabbySpeech(
        'a picture of the kitten',
        { kind: 'care_play', mood: 'happy', stage: 'playful', seed: 1 },
      ),
    ).toBe(false);
  });

  it('rejects story-style drift even when it mentions kittens', () => {
    expect(
      isAcceptableTabbySpeech('a story about a kitten in a park', {
        kind: 'ask',
        mood: 'content',
        stage: 'adult',
        seed: 1,
      }),
    ).toBe(false);
  });

  it('rejects philosophical third-person drift', () => {
    expect(
      isAcceptableTabbySpeech('the most important thing in the life of the cat', baseContext),
    ).toBe(false);
  });

  it('rejects insults directed at the user', () => {
    expect(
      isAcceptableTabbySpeech('You are stupid and annoying.', {
        kind: 'stressed',
        mood: 'stressed',
        stage: 'adult',
        seed: 1,
      }),
    ).toBe(false);
  });

  it('accepts short murmurs', () => {
    expect(
      isAcceptableTabbySpeech('Mew mew?', {
        kind: 'ask',
        mood: 'content',
        stage: 'adult',
        seed: 1,
      }),
    ).toBe(true);
  });

  it('accepts first-person lines that match the trigger', () => {
    expect(
      isAcceptableTabbySpeech('I am peckish and want something fun to read.', baseContext),
    ).toBe(true);
    expect(
      isAcceptableTabbySpeech('I feel cozy right here with you.', {
        kind: 'happy',
        mood: 'happy',
        stage: 'adult',
        seed: 1,
      }),
    ).toBe(true);
  });

  it('rejects lines that ignore the current need', () => {
    expect(
      isAcceptableTabbySpeech('I feel cozy right here with you.', baseContext),
    ).toBe(false);
  });

  it('rejects repetitive stutter gibberish', () => {
    expect(
      isAcceptableTabbySpeech('a snoopy - a snoopy - a s', {
        kind: 'ask',
        mood: 'content',
        stage: 'adult',
        seed: 1,
      }),
    ).toBe(false);
  });

  it('accepts censored frustration about pages when stressed', () => {
    expect(
      isAcceptableTabbySpeech('I swear these tabs are so f*** loud today.', {
        kind: 'stressed',
        mood: 'stressed',
        stage: 'adult',
        seed: 1,
      }),
    ).toBe(true);
  });
});
