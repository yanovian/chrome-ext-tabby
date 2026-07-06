import { describe, expect, it } from 'vitest';
import {
  hasDwelledLongEnough,
  MIN_PAGE_DWELL_MS,
  RECENT_VISIT_LIMIT,
  pageVisitKey,
  registerVisit,
} from '../utils/visit-dedup';

describe('pageVisitKey', () => {
  it('normalizes host and path without query or hash', () => {
    expect(pageVisitKey('https://www.github.com/foo/bar?q=1#top')).toBe(
      'github.com/foo/bar',
    );
  });

  it('treats trailing slashes as the same page', () => {
    expect(pageVisitKey('https://example.com/docs/')).toBe('example.com/docs');
    expect(pageVisitKey('https://example.com/docs')).toBe('example.com/docs');
  });

  it('returns null for invalid URLs', () => {
    expect(pageVisitKey('not-a-url')).toBeNull();
  });
});

describe('hasDwelledLongEnough', () => {
  it('requires at least one minute in production', () => {
    const startedAt = 0;
    expect(hasDwelledLongEnough(startedAt, MIN_PAGE_DWELL_MS - 1, MIN_PAGE_DWELL_MS)).toBe(
      false,
    );
    expect(hasDwelledLongEnough(startedAt, MIN_PAGE_DWELL_MS, MIN_PAGE_DWELL_MS)).toBe(true);
  });
});

describe('registerVisit', () => {
  it('counts the first visit to a page', () => {
    const result = registerVisit('https://github.com/repo', []);

    expect(result.counted).toBe(true);
    expect(result.recentKeys).toEqual(['github.com/repo']);
  });

  it('skips a repeat visit already in the recent ring buffer', () => {
    const first = registerVisit('https://github.com/repo', []);
    const second = registerVisit('https://github.com/repo', first.recentKeys);

    expect(second.counted).toBe(false);
    expect(second.recentKeys).toEqual(first.recentKeys);
  });

  it('counts again after the page falls out of the buffer', () => {
    const keys = Array.from({ length: RECENT_VISIT_LIMIT }, (_, index) => `site${index}.com/`);

    const result = registerVisit('https://github.com/repo', keys);

    expect(result.counted).toBe(true);
    expect(result.recentKeys).toHaveLength(RECENT_VISIT_LIMIT);
    expect(result.recentKeys[0]).toBe('github.com/repo');
    expect(result.recentKeys).not.toContain('site9.com/');
  });

  it('ignores different query strings on the same path', () => {
    const first = registerVisit('https://news.example.com/story?id=1', []);
    const second = registerVisit('https://news.example.com/story?id=2', first.recentKeys);

    expect(second.counted).toBe(false);
  });
});
