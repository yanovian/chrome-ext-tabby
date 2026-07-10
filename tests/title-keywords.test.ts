import { describe, expect, it } from 'vitest';
import { classifyFromTitleHints, scoreTitleHints } from '../utils/title-keywords';

describe('title-keywords', () => {
  it('scores nourishing and draining hints in a title', () => {
    expect(scoreTitleHints('Rust programming tutorial — lesson 1')).toEqual({
      nourishingHits: 3,
      drainingHits: 0,
    });
    expect(scoreTitleHints('Celebrity drama exposed — reaction')).toEqual({
      nourishingHits: 0,
      drainingHits: 4,
    });
  });

  it('returns null when the title has no signal', () => {
    expect(classifyFromTitleHints('Untitled video')).toBeNull();
  });

  it('recognizes book and reading titles as nourishing', () => {
    expect(classifyFromTitleHints('Kindle — chapter 4')).toEqual({
      category: 'nourishing',
      confidence: expect.any(Number),
    });
  });

  it('recognizes tiktok titles as draining', () => {
    expect(classifyFromTitleHints('Funny tiktok compilation')?.category).toBe('draining');
  });
});
