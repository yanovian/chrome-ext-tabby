import { describe, expect, it, vi } from 'vitest';
import {
  COMPANION_ENTER_MS,
  COMPANION_EXIT_MS,
  preloadCompanionSprite,
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

describe('preloadCompanionSprite', () => {
  it('resolves after the sprite loads', async () => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    await preloadCompanionSprite(
      (path) => `chrome-extension://test${path}`,
      '/sprites/adult/content.png',
    );

    vi.unstubAllGlobals();
  });
});

describe('companion animation timing', () => {
  it('keeps enter slower than exit for a soft arrival', () => {
    expect(COMPANION_ENTER_MS).toBeGreaterThan(COMPANION_EXIT_MS);
  });
});
