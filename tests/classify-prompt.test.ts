import { describe, expect, it } from 'vitest';
import { buildClassifyPrompt, parseClassifyAnswer } from '../utils/classify-prompt';

describe('buildClassifyPrompt', () => {
  it('includes title and URL in the prompt', () => {
    const prompt = buildClassifyPrompt({
      title: 'Kubernetes Pods — docs',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/',
    });

    expect(prompt).toContain('Kubernetes Pods');
    expect(prompt).toContain('kubernetes.io');
    expect(prompt).toContain('nourishing');
  });
});

describe('parseClassifyAnswer', () => {
  it('parses a clean one-word answer', () => {
    expect(parseClassifyAnswer('nourishing')).toBe('nourishing');
    expect(parseClassifyAnswer('Category: draining')).toBe('draining');
  });

  it('maps fuzzy answers to categories', () => {
    expect(parseClassifyAnswer('This looks nourishing for learning')).toBe('nourishing');
    expect(parseClassifyAnswer('stressful draining feed')).toBe('draining');
  });

  it('returns null for unusable output', () => {
    expect(parseClassifyAnswer('')).toBeNull();
    expect(parseClassifyAnswer('maybe kinda fine idk')).toBeNull();
  });
});
