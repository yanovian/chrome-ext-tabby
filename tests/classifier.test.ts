import { describe, expect, it } from 'vitest';
import { classifyTab, isTrackableUrl, parseHostname } from '../utils/classifier';

describe('classifyTab', () => {
  it('treats documentation and learning sites as nourishing for Tabby', () => {
    const result = classifyTab({
      title: 'Kubernetes documentation — Pods',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/',
      pageTextSnippet: 'A Pod is the smallest deployable unit of computing.',
    });

    expect(result.category).toBe('nourishing');
    expect(result.topic).toBe('Kubernetes');
  });

  it('treats endless social feeds as draining without calling the user bad', () => {
    const result = classifyTab({
      title: 'Explore / X',
      url: 'https://twitter.com/explore',
      pageTextSnippet: 'Trending drama and viral outrage all day.',
    });

    expect(result.category).toBe('draining');
  });

  it('uses page text to detect nourishing tutorials on generic hosts', () => {
    const result = classifyTab({
      title: 'Build a Rust CLI — lesson 3',
      url: 'https://example.com/courses/rust-cli',
      pageTextSnippet: 'In this programming tutorial we will learn cargo and build a project.',
    });

    expect(result.category).toBe('nourishing');
    expect(result.topic).toBe('Rust');
  });

  it('keeps banking and inbox pages in the neutral bucket', () => {
    const result = classifyTab({
      title: 'Sign in to your bank account',
      url: 'https://bank.example/login',
      pageTextSnippet: 'Secure login for your checking account inbox settings.',
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
