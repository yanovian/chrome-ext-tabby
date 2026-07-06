/** Unprompted speech arrived (tick, mood trigger, etc.). */
export function isNewTriggerSpeech(input: {
  previousSpeech: string | null;
  nextSpeech: string | null;
  triggerKind: string | null;
}): boolean {
  return Boolean(
    input.triggerKind &&
      input.nextSpeech &&
      input.nextSpeech !== input.previousSpeech,
  );
}

/** Speech bubble without the care menu (or attached while the menu is open). */
export function shouldShowSpeechBubble(input: {
  speech: string | null;
  triggerKind: string | null;
  isIntro: boolean;
  careMenuOpen: boolean;
  speechBubbleOpen: boolean;
}): boolean {
  if (input.isIntro || !input.speech) {
    return false;
  }
  if (input.careMenuOpen) {
    return true;
  }
  return Boolean(input.triggerKind) && input.speechBubbleOpen;
}

export function hasOverlayChrome(input: {
  isIntro: boolean;
  careMenuOpen: boolean;
  showSpeechBubble: boolean;
}): boolean {
  if (input.isIntro && input.careMenuOpen) {
    return true;
  }
  return input.careMenuOpen || input.showSpeechBubble;
}
