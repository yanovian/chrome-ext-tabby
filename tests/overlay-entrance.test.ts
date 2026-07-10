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
        previousSprite: 'gif/adult/idle.gif',
        nextSprite: 'gif/adult/eat.gif',
        hasVisibleOverlay: true,
      }),
    ).toBe(true);
  });

  it('skips the transition on first mount or when the sprite is unchanged', () => {
    expect(
      shouldAnimateMoodTransition({
        previousSprite: null,
        nextSprite: 'gif/adult/idle.gif',
        hasVisibleOverlay: true,
      }),
    ).toBe(false);
    expect(
      shouldAnimateMoodTransition({
        previousSprite: 'gif/adult/idle.gif',
        nextSprite: 'gif/adult/idle.gif',
        hasVisibleOverlay: true,
      }),
    ).toBe(false);
  });
});

describe('preloadCompanionSprite', () => {
  it('prefetches the companion GIF', async () => {
    let loadedSrc = '';
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(value: string) {
        this._src = value;
        loadedSrc = value;
        queueMicrotask(() => this.onload?.());
      }
      get src() {
        return this._src;
      }
    }
    vi.stubGlobal('Image', MockImage);

    await preloadCompanionSprite(
      (path) => `chrome-extension://test/${path}`,
      'gif/adult/idle.gif',
    );

    expect(loadedSrc).toBe('chrome-extension://test/gif/adult/idle.gif');
    vi.unstubAllGlobals();
  });
});

describe('companion animation timing', () => {
  it('keeps enter slower than exit for a soft arrival', () => {
    expect(COMPANION_ENTER_MS).toBeGreaterThan(COMPANION_EXIT_MS);
  });
});
