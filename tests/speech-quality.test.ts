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
    kind: 'ask' as const,
    mood: 'content' as const,
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

  it('accepts first-person cat lines', () => {
    expect(isAcceptableTabbySpeech('I feel cozy right here with you.', baseContext)).toBe(
      true,
    );
  });
});
