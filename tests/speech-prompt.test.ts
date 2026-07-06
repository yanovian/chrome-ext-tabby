import { describe, expect, it } from 'vitest';
import {
  buildSpeechPrompt,
  normalizeSpeechProfanity,
  postProcessSpeech,
} from '../utils/speech-prompt';

describe('buildSpeechPrompt', () => {
  it('includes mood, stage, and completion prefix', () => {
    const prompt = buildSpeechPrompt({
      kind: 'hungry',
      mood: 'hungry',
      stage: 'playful',
      seed: 1,
    });

    expect(prompt).toMatch(/Tabby/i);
    expect(prompt).toMatch(/hungry/i);
    expect(prompt).toMatch(/playful kitten/i);
    expect(prompt).toMatch(/Tabby says:/);
    expect(prompt).toMatch(/First person only/i);
    expect(prompt).toMatch(/Never insult/i);
    expect(prompt).toMatch(/Required theme:.*peckish/i);
  });

  it('allows censored frustration rules when stressed', () => {
    const prompt = buildSpeechPrompt({
      kind: 'stressed',
      mood: 'stressed',
      stage: 'adult',
      seed: 1,
    });

    expect(prompt).toMatch(/f\*\*\*/i);
    expect(prompt).toMatch(/never at the user/i);
  });

  it('skips page titles for care actions', () => {
    const prompt = buildSpeechPrompt({
      kind: 'care_pet',
      mood: 'content',
      stage: 'adult',
      seed: 2,
      pageTitle: 'Google',
    });

    expect(prompt).not.toContain('Google');
  });

  it('adds topic hints for ambient speech when present', () => {
    const prompt = buildSpeechPrompt({
      kind: 'memory',
      mood: 'content',
      stage: 'adult',
      seed: 2,
      pageTopic: 'Kubernetes',
      memoryTopic: 'Kubernetes',
    });

    expect(prompt).toContain('Browsing topic lately: Kubernetes');
    expect(prompt).toContain('Remembered topic: Kubernetes');
  });
});

describe('postProcessSpeech', () => {
  it('strips labels and keeps the first sentence', () => {
    expect(postProcessSpeech('Tabby: Hello there!')).toBe('Hello there!');
    expect(postProcessSpeech('Tabby says: Hello there! More text.')).toBe('Hello there!');
  });

  it('returns null for empty output', () => {
    expect(postProcessSpeech('   ')).toBeNull();
  });

  it('truncates very long lines', () => {
    const long = 'I feel '.concat('a'.repeat(200));
    const result = postProcessSpeech(long, {
      kind: 'happy',
      mood: 'happy',
      stage: 'adult',
      seed: 1,
    });
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(140);
  });
});

describe('normalizeSpeechProfanity', () => {
  it('censors uncensored frustration when stressed', () => {
    expect(
      normalizeSpeechProfanity('This feed is fucking loud.', {
        kind: 'stressed',
        mood: 'stressed',
        stage: 'adult',
        seed: 1,
      }),
    ).toBe('This feed is f*** loud.');
  });

  it('rejects profanity in calm moods', () => {
    expect(
      normalizeSpeechProfanity('This is fucking great.', {
        kind: 'happy',
        mood: 'happy',
        stage: 'adult',
        seed: 1,
      }),
    ).toBeNull();
  });
});
