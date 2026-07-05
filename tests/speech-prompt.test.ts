import { describe, expect, it } from 'vitest';
import { buildSpeechPrompt, postProcessSpeech } from '../utils/speech-prompt';

describe('buildSpeechPrompt', () => {
  it('includes mood, stage, and kind instructions', () => {
    const prompt = buildSpeechPrompt({
      kind: 'hungry',
      mood: 'hungry',
      stage: 'playful',
      seed: 1,
    });

    expect(prompt).toMatch(/Tabby/i);
    expect(prompt).toMatch(/hungry/i);
    expect(prompt).toMatch(/playful kitten/i);
    expect(prompt).toMatch(/Answer:/);
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

    expect(prompt).toContain('Topic lately: Kubernetes');
    expect(prompt).toContain('Recent memory: Kubernetes');
  });
});

describe('postProcessSpeech', () => {
  it('strips labels and keeps up to two sentences', () => {
    expect(postProcessSpeech('Tabby: Hello there!')).toBe('Hello there!');
    expect(postProcessSpeech('Tabby: Hello there! More text.')).toBe('Hello there! More text.');
  });

  it('returns null for empty output', () => {
    expect(postProcessSpeech('   ')).toBeNull();
  });

  it('truncates very long lines', () => {
    const long = 'a'.repeat(200);
    const result = postProcessSpeech(long);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(160);
  });
});
