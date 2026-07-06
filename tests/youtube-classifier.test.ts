import { describe, expect, it } from 'vitest';
import { classifyYouTube } from '../utils/youtube-classifier';

describe('classifyYouTube', () => {
  it('treats Shorts as draining from path alone', () => {
    const result = classifyYouTube('Funny clip', '/shorts/abc123');
    expect(result.category).toBe('draining');
  });

  it('treats tutorial titles as nourishing', () => {
    const result = classifyYouTube(
      'Rust programming tutorial — lesson 1',
      '/watch',
    );
    expect(result.category).toBe('nourishing');
  });

  it('treats drama reaction titles as draining', () => {
    const result = classifyYouTube(
      'Celebrity drama exposed — reaction',
      '/watch',
    );
    expect(result.category).toBe('draining');
  });

  it('defaults long-form watch pages to neutral when title is vague', () => {
    const result = classifyYouTube('Untitled video', '/watch?v=abc');
    expect(result.category).toBe('neutral');
  });
});
