import { describe, expect, it } from 'vitest';
import { classifyTab, isTrackableUrl, parseHostname } from '../utils/classifier';

describe('classifyTab', () => {
  it('classifies nourishing pages from title and URL alone', () => {
    const result = classifyTab({
      title: 'Kubernetes documentation — Pods',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/',
    });

    expect(result.category).toBe('nourishing');
    expect(result.topic).toBe('Development');
    expect(result.source).toBe('registry');
  });

  it('classifies AWS docs as nourishing from the site registry', () => {
    const result = classifyTab({
      title: 'Amazon EC2 — AWS Documentation',
      url: 'https://docs.aws.amazon.com/ec2/',
    });

    expect(result.category).toBe('nourishing');
    expect(result.topic).toBe('Cloud');
  });

  it('treats endless social feeds as draining from title and URL alone', () => {
    const result = classifyTab({
      title: 'Explore / X',
      url: 'https://twitter.com/explore',
    });

    expect(result.category).toBe('draining');
    expect(result.source).toBe('registry');
  });

  it('classifies YouTube tutorials from the title', () => {
    const result = classifyTab({
      title: 'Python course — full tutorial',
      url: 'https://www.youtube.com/watch?v=abc123',
    });

    expect(result.category).toBe('nourishing');
    expect(result.source).toBe('video');
  });

  it('classifies Netflix as nourishing entertainment from the host', () => {
    const result = classifyTab({
      title: 'Stranger Things',
      url: 'https://www.netflix.com/watch/123',
    });

    expect(result.category).toBe('nourishing');
    expect(result.source).toBe('registry');
    expect(result.topic).toBe('Streaming');
  });

  it('classifies Rutube tiktok-style titles as draining', () => {
    const result = classifyTab({
      title: 'TikTok cringe compilation',
      url: 'https://rutube.ru/video/abc/',
    });

    expect(result.category).toBe('draining');
    expect(result.source).toBe('video');
  });

  it('classifies book reading from the title on unknown hosts', () => {
    const result = classifyTab({
      title: 'Chapter 12 — The Great Novel',
      url: 'https://reader.example.com/book/123',
    });

    expect(result.category).toBe('nourishing');
    expect(result.source).toBe('keywords');
  });

  it('classifies Medium tutorials from the title on a neutral host', () => {
    const result = classifyTab({
      title: 'Build a Rust CLI — lesson 3',
      url: 'https://medium.com/@user/rust-cli',
    });

    expect(result.category).toBe('nourishing');
    expect(result.source).toBe('keywords');
  });

  it('detects nourishing tutorials on generic hosts from title keywords', () => {
    const result = classifyTab({
      title: 'Build a Rust CLI — lesson 3',
      url: 'https://example.com/courses/rust-cli',
    });

    expect(result.category).toBe('nourishing');
    expect(result.topic).toBe('Rust');
    expect(result.source).toBe('keywords');
  });

  it('keeps banking and inbox pages in the neutral bucket', () => {
    const result = classifyTab({
      title: 'Sign in to your bank account',
      url: 'https://bank.example/login',
    });

    expect(result.category).toBe('neutral');
  });
});

describe('isTrackableUrl', () => {
  it('ignores internal browser pages', () => {
    expect(isTrackableUrl('chrome://extensions')).toBe(false);
    expect(isTrackableUrl('https://developer.mozilla.org/en-US/docs/Web')).toBe(true);
  });
});

describe('parseHostname', () => {
  it('normalizes hostnames for local classification', () => {
    expect(parseHostname('https://www.github.com/repo')).toBe('github.com');
  });
});
