import { describe, expect, it } from 'vitest';
import { classifyVideoPlatform, isVideoPlatformHost } from '../utils/video-platform-classifier';

describe('isVideoPlatformHost', () => {
  it('recognizes major video platform hosts', () => {
    expect(isVideoPlatformHost('www.youtube.com')).toBe(true);
    expect(isVideoPlatformHost('rutube.ru')).toBe(true);
    expect(isVideoPlatformHost('vimeo.com')).toBe(true);
    expect(isVideoPlatformHost('www.netflix.com')).toBe(false);
  });
});

describe('classifyVideoPlatform', () => {
  it('treats Shorts paths as draining', () => {
    const result = classifyVideoPlatform('Funny clip', '/shorts/abc123');
    expect(result.category).toBe('draining');
  });

  it('treats tutorial titles as nourishing', () => {
    const result = classifyVideoPlatform('Rust programming tutorial — lesson 1', '/watch');
    expect(result.category).toBe('nourishing');
  });

  it('treats tiktok-style titles as draining', () => {
    const result = classifyVideoPlatform('Best TikTok compilation 2026', '/watch');
    expect(result.category).toBe('draining');
  });

  it('defaults long-form watch pages to neutral when title is vague', () => {
    const result = classifyVideoPlatform('Untitled video', '/watch?v=abc');
    expect(result.category).toBe('neutral');
  });
});
