import { describe, expect, it } from 'vitest';
import {
  hasOverlayChrome,
  hasUnpromptedSpeech,
  isNewTriggerSpeech,
  shouldOpenSpeechBubbleForUpdate,
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

describe('shouldOpenSpeechBubbleForUpdate', () => {
  it('opens the bubble again after force tick even when the line repeats', () => {
    expect(
      shouldOpenSpeechBubbleForUpdate({
        introJustFinished: false,
        isIntro: false,
        previousSpeech: 'Hello there.',
        nextSpeech: 'Hello there.',
        triggerKind: 'happy',
        speechBubbleOpen: false,
      }),
    ).toBe(true);
  });

  it('does not open during the intro tour', () => {
    expect(
      shouldOpenSpeechBubbleForUpdate({
        introJustFinished: false,
        isIntro: true,
        previousSpeech: null,
        nextSpeech: 'Hi!',
        triggerKind: 'happy',
        speechBubbleOpen: false,
      }),
    ).toBe(false);
  });
});

describe('hasUnpromptedSpeech', () => {
  it('requires both speech and a trigger kind', () => {
    expect(hasUnpromptedSpeech({ speech: 'Hi!', triggerKind: 'happy' })).toBe(true);
    expect(hasUnpromptedSpeech({ speech: 'Hi!', triggerKind: null })).toBe(false);
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
