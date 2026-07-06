import { describe, expect, it, vi } from 'vitest';
import {
  COMPANION_ENTER_MS,
  COMPANION_EXIT_MS,
  preloadCompanionSprite,
  shouldAnimateMoodTransition,
  shouldReactToSpeechTrigger,
} from '../utils/overlay-entrance';

describe('shouldReactToSpeechTrigger', () => {
  it('reacts when a new emotional trigger speech arrives', () => {
    expect(
      shouldReactToSpeechTrigger({
        previousSpeech: null,
        nextSpeech: 'Lots of angry pages out there.',
        triggerKind: 'stressed',
      }),
    ).toBe(true);
  });

  it('does not react when speech is unchanged', () => {
    expect(
      shouldReactToSpeechTrigger({
        previousSpeech: 'Still here.',
        nextSpeech: 'Still here.',
        triggerKind: 'happy',
      }),
    ).toBe(false);
  });

  it('does not react without a trigger kind', () => {
    expect(
      shouldReactToSpeechTrigger({
        previousSpeech: null,
        nextSpeech: 'Hello.',
        triggerKind: null,
      }),
    ).toBe(false);
  });
});

describe('shouldAnimateMoodTransition', () => {
  it('crossfades when the sprite changes on a visible overlay', () => {
    expect(
      shouldAnimateMoodTransition({
        previousSprite: 'animations/adult/idle.json',
        nextSprite: 'animations/adult/eat.json',
        hasVisibleOverlay: true,
      }),
    ).toBe(true);
  });

  it('skips the transition on first mount or when the sprite is unchanged', () => {
    expect(
      shouldAnimateMoodTransition({
        previousSprite: null,
        nextSprite: 'animations/adult/idle.json',
        hasVisibleOverlay: true,
      }),
    ).toBe(false);
    expect(
      shouldAnimateMoodTransition({
        previousSprite: 'animations/adult/idle.json',
        nextSprite: 'animations/adult/idle.json',
        hasVisibleOverlay: true,
      }),
    ).toBe(false);
  });
});

describe('preloadCompanionSprite', () => {
  it('prefetches the animation JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await preloadCompanionSprite(
      (path) => `chrome-extension://test/${path}`,
      'animations/adult/idle.json',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'chrome-extension://test/animations/adult/idle.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    vi.unstubAllGlobals();
  });
});

describe('companion animation timing', () => {
  it('keeps enter slower than exit for a soft arrival', () => {
    expect(COMPANION_ENTER_MS).toBeGreaterThan(COMPANION_EXIT_MS);
  });
});
