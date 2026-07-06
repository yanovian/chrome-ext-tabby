import { describe, expect, it } from 'vitest';
import {
  hasOverlayChrome,
  isNewTriggerSpeech,
  shouldShowSpeechBubble,
} from '../utils/overlay-chrome';

describe('isNewTriggerSpeech', () => {
  it('detects a fresh unprompted line', () => {
    expect(
      isNewTriggerSpeech({
        previousSpeech: null,
        nextSpeech: 'Hello there.',
        triggerKind: 'happy',
      }),
    ).toBe(true);
  });

  it('ignores duplicate presentation updates', () => {
    expect(
      isNewTriggerSpeech({
        previousSpeech: 'Hello there.',
        nextSpeech: 'Hello there.',
        triggerKind: 'happy',
      }),
    ).toBe(false);
  });
});

describe('shouldShowSpeechBubble', () => {
  it('shows speech alone after an unprompted trigger', () => {
    expect(
      shouldShowSpeechBubble({
        speech: 'Hi!',
        triggerKind: 'happy',
        isIntro: false,
        careMenuOpen: false,
        speechBubbleOpen: true,
      }),
    ).toBe(true);
  });

  it('hides the care menu until Tabby is tapped', () => {
    expect(
      shouldShowSpeechBubble({
        speech: 'Hi!',
        triggerKind: 'happy',
        isIntro: false,
        careMenuOpen: false,
        speechBubbleOpen: false,
      }),
    ).toBe(false);
  });

  it('keeps speech attached when the care menu is open', () => {
    expect(
      shouldShowSpeechBubble({
        speech: 'Hi!',
        triggerKind: 'happy',
        isIntro: false,
        careMenuOpen: true,
        speechBubbleOpen: false,
      }),
    ).toBe(true);
  });
});

describe('hasOverlayChrome', () => {
  it('is true for speech-only or care menu states', () => {
    expect(
      hasOverlayChrome({
        isIntro: false,
        careMenuOpen: false,
        showSpeechBubble: true,
      }),
    ).toBe(true);
    expect(
      hasOverlayChrome({
        isIntro: false,
        careMenuOpen: true,
        showSpeechBubble: false,
      }),
    ).toBe(true);
  });
});
