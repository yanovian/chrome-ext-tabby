import type { InteractionAction } from '../../../utils/cat-interactions';
import { introStepCount, isIntroCompleted } from '../../../utils/intro';
import {
  hasOverlayChrome as computeHasOverlayChrome,
  shouldShowSpeechBubble as computeShouldShowSpeechBubble,
} from '../../../utils/overlay-chrome';
import { isFeedingActive } from '../../../utils/feeding-moment';
import { isPlayingActive } from '../../../utils/play-moment';
import { isPeekPresentation } from '../../../utils/presentation';
import type { CatPresentation } from '../../../utils/types';
import {
  buildIntroMenuArea as renderIntroMenuArea,
  buildOverlayChrome as renderOverlayChrome,
} from './menu-builders';

export interface MenuBuildHandlers {
  onAdvanceIntro: () => void;
  onSkipIntro: () => void;
  onCloseMenu: () => void;
  onToggleMore: () => void;
  onDismissSpeech: () => void;
  onAction: (action: InteractionAction) => void;
}

/**
 * Owns the care-menu/speech-bubble/intro-walkthrough state (open/closed, which step, which
 * button is pending or highlighted) and knows how to render that state as DOM. Click handlers
 * inside the built DOM call back out through the injected MenuBuildHandlers rather than
 * mutating state directly here, since opening/closing/advancing all have side effects
 * (re-render, outside-click listener, background requests) that belong to the coordinator.
 */
export class IntroMenuController {
  private menuOpen = false;
  private speechBubbleOpen = false;
  private moreOpen = false;
  private pendingAction: InteractionAction | null = null;
  private highlightedAction: InteractionAction | null = null;
  private introCompleted = true;
  private introStep: number | null = null;
  private introJustFinished = false;
  private introFinishTimer: number | null = null;

  isMenuOpen(): boolean {
    return this.menuOpen;
  }

  isSpeechBubbleOpen(): boolean {
    return this.speechBubbleOpen;
  }

  setSpeechBubbleOpen(open: boolean): void {
    this.speechBubbleOpen = open;
  }

  isMoreOpen(): boolean {
    return this.moreOpen;
  }

  toggleMoreOpen(): void {
    this.moreOpen = !this.moreOpen;
  }

  getPendingAction(): InteractionAction | null {
    return this.pendingAction;
  }

  setPendingAction(action: InteractionAction | null): void {
    this.pendingAction = action;
  }

  getHighlightedAction(): InteractionAction | null {
    return this.highlightedAction;
  }

  setHighlightedAction(action: InteractionAction | null): void {
    this.highlightedAction = action;
  }

  isIntroCompleted(): boolean {
    return this.introCompleted;
  }

  setIntroCompleted(completed: boolean): void {
    this.introCompleted = completed;
  }

  getIntroStep(): number | null {
    return this.introStep;
  }

  isIntroJustFinished(): boolean {
    return this.introJustFinished;
  }

  isIntroActive(): boolean {
    return !this.introCompleted && this.introStep !== null;
  }

  async load(): Promise<void> {
    this.introCompleted = await isIntroCompleted();
  }

  startIntro(): void {
    this.introStep = 0;
    this.menuOpen = true;
  }

  /** Advances to the next intro step, or reports 'complete' once the last step is reached so
   * the coordinator can run completeIntro() (which needs to touch presentation/background
   * state this controller doesn't own). */
  advanceIntroStep(): 'advanced' | 'complete' | 'noop' {
    if (this.introStep === null) {
      return 'noop';
    }
    if (this.introStep >= introStepCount() - 1) {
      return 'complete';
    }
    this.introStep += 1;
    return 'advanced';
  }

  /** Flips all the "intro just finished" bookkeeping. The 3s window it opens lets
   * applyPresentationUpdate suppress the settle-after-intro presentation's own speech, so the
   * completion doesn't immediately reopen a speech bubble right after the walkthrough closes. */
  beginCompleting(): void {
    this.introJustFinished = true;
    if (this.introFinishTimer !== null) {
      window.clearTimeout(this.introFinishTimer);
    }
    this.introFinishTimer = window.setTimeout(() => {
      this.introJustFinished = false;
      this.introFinishTimer = null;
    }, 3000);

    this.introCompleted = true;
    this.introStep = null;
    this.menuOpen = false;
    this.moreOpen = false;
    this.speechBubbleOpen = false;
  }

  /** Returns whether it actually opened, so the caller only pings/renders/syncs when
   * something really changed. */
  openMenuState(isCareMoment: boolean): boolean {
    if (isCareMoment || this.menuOpen) {
      return false;
    }
    this.menuOpen = true;
    return true;
  }

  closeMenuState(): boolean {
    if (this.isIntroActive() || !this.menuOpen) {
      return false;
    }
    this.menuOpen = false;
    this.moreOpen = false;
    this.pendingAction = null;
    this.highlightedAction = null;
    return true;
  }

  /** Same reset closeMenu() does: used by gracefulDeactivate()/destroy() so whichever button
   * was highlighted before this tab lost focus/was torn down doesn't reappear as "active" the
   * next time the menu reopens, even though the user never touched it this time around. */
  resetMenuAndSpeechState(): void {
    this.menuOpen = false;
    this.moreOpen = false;
    this.speechBubbleOpen = false;
    this.pendingAction = null;
    this.highlightedAction = null;
  }

  /** Used after a 'dismiss' interaction: closes menu, speech bubble, and the highlight, but
   * leaves pendingAction alone since the caller's own finally block clears that. */
  dismissMenuAndSpeech(): void {
    this.menuOpen = false;
    this.moreOpen = false;
    this.speechBubbleOpen = false;
    this.highlightedAction = null;
  }

  /** Used after a dnd/shoo interaction: closes the menu and highlight only — unlike dismiss,
   * this deliberately leaves any open speech bubble alone. */
  closeMenuAfterAction(): void {
    this.menuOpen = false;
    this.moreOpen = false;
    this.highlightedAction = null;
  }

  openSpeechBubble(): void {
    this.speechBubbleOpen = true;
    this.menuOpen = false;
    this.moreOpen = false;
  }

  /** Ambient peeking runs on its own timer in the background and would otherwise duck the
   * cat out from under an open care menu — this closes any open chrome when peek starts.
   * Returns whether anything changed, so the caller knows whether to resync the outside-click
   * listener. */
  syncForPeek(presentation: CatPresentation): boolean {
    if (!isPeekPresentation(presentation)) {
      return false;
    }
    this.menuOpen = false;
    this.moreOpen = false;
    this.speechBubbleOpen = false;
    return true;
  }

  syncForCareMoment(
    presentation: CatPresentation,
    previous: { eatingUntil?: number | null; playingUntil?: number | null } = {},
  ): boolean {
    const now = Date.now();
    const active =
      isFeedingActive(presentation.eatingUntil, now) || isPlayingActive(presentation.playingUntil, now);
    const justFinished =
      (previous.eatingUntil != null && presentation.eatingUntil == null) ||
      (previous.playingUntil != null && presentation.playingUntil == null);
    if (!active && !(justFinished && presentation.speech && presentation.triggerKind)) {
      return false;
    }
    this.menuOpen = false;
    this.moreOpen = false;
    if (presentation.speech && presentation.triggerKind) {
      this.speechBubbleOpen = true;
    }
    return true;
  }

  shouldShowSpeechBubble(presentation: CatPresentation | null): boolean {
    return computeShouldShowSpeechBubble({
      speech: presentation?.speech ?? null,
      triggerKind: presentation?.triggerKind ?? null,
      isIntro: this.isIntroActive(),
      careMenuOpen: this.menuOpen,
      speechBubbleOpen: this.speechBubbleOpen,
    });
  }

  hasChrome(presentation: CatPresentation | null): boolean {
    return computeHasOverlayChrome({
      isIntro: this.isIntroActive(),
      careMenuOpen: this.menuOpen,
      showSpeechBubble: this.shouldShowSpeechBubble(presentation),
    });
  }

  /** DOM construction itself lives in menu-builders.ts (kept out of this file so it stays
   * state-and-decisions only) — these just forward to it with `this` for state access. */
  buildIntroMenuArea(handlers: MenuBuildHandlers, options: { animate?: boolean } = {}): HTMLElement {
    return renderIntroMenuArea(this, handlers, options);
  }

  buildOverlayChrome(
    presentation: CatPresentation,
    isCareMoment: boolean,
    handlers: MenuBuildHandlers,
    options: { animate?: boolean } = {},
  ): HTMLElement {
    return renderOverlayChrome(this, presentation, isCareMoment, handlers, options);
  }
}
