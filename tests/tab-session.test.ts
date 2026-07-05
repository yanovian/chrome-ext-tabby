import { describe, expect, it } from 'vitest';
import { beginFocus, createEmptySnapshot, endFocus } from '../utils/tab-session';

describe('tab-session', () => {
  it('measures active duration when the user leaves a tab', () => {
    const startedAt = 1_000;
    const now = 46_000;
    const focused = beginFocus(createEmptySnapshot(), {
      id: 12,
      title: 'Rust book',
      url: 'https://doc.rust-lang.org/book/',
    }, startedAt);

    const { activeDurationMs } = endFocus(focused, now);

    expect(activeDurationMs).toBe(45_000);
  });

  it('returns zero duration when no tab was being tracked', () => {
    const { activeDurationMs } = endFocus(createEmptySnapshot(), Date.now());
    expect(activeDurationMs).toBe(0);
  });
});
