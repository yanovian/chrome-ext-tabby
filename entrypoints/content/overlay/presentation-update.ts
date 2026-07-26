import { shouldOpenSpeechBubbleForUpdate } from '../../../utils/overlay-chrome';
import { shouldAnimateMoodTransition, shouldReactToSpeechTrigger } from '../../../utils/overlay-entrance';
import type { CatPresentation, ExtensionSettings } from '../../../utils/types';
import type { OverlayPositioner } from './positioner';
import type { IntroMenuController } from './intro-menu';
import type { RealCatCameoController } from './real-cat-cameo';
import type { PatchOptions } from './renderer';

export interface PresentationUpdateContext {
  getPresentation: () => CatPresentation | null;
  setPresentation: (presentation: CatPresentation) => void;
  settlePresentation: (presentation: CatPresentation) => CatPresentation;
  positioner: OverlayPositioner;
  introMenu: IntroMenuController;
  realCatCameo: RealCatCameoController;
  getSettings: () => ExtensionSettings | null;
  hostname: string | undefined;
  resolveUrl: (path: string) => string;
  setCompanionHidden: (hidden: boolean) => void;
  syncOutsideClickListener: () => void;
  render: (options: PatchOptions) => void;
  isOverlayVisible: () => boolean;
  beginIntroIfNeeded: () => void;
  getRoot: () => HTMLElement | null;
}

/**
 * The single place that applies a freshly fetched or pushed CatPresentation to local UI
 * state (peek chrome, speech bubble, menu) and renders it. The live storage listener and
 * refreshPresentation (used whenever the overlay tab (re)gains host status) both funnel
 * through this instead of each keeping their own partial copy of "settle it, then figure out
 * peek/menu/speech-bubble state" — that divergence is exactly how a tab regaining host status
 * mid-peek used to end up rendering inconsistently with one that received the same update live.
 *
 * setPresentation() is called immediately after settling, before any of the render/sync calls
 * below — those read the coordinator's live presentation field through its own methods, so if
 * it weren't updated first they'd act on the stale value.
 */
export function applyPresentationUpdate(next: CatPresentation, ctx: PresentationUpdateContext): void {
  const current = ctx.getPresentation();
  const previousMood = current?.mood ?? null;
  const previousSpeech = current?.speech ?? null;
  const previousSprite = current?.sprite ?? null;
  const previousEatingUntil = current?.eatingUntil ?? null;
  const previousPlayingUntil = current?.playingUntil ?? null;
  const previousPettingUntil = current?.pettingUntil ?? null;
  const previousTalkUntil = current?.talkUntil ?? null;
  const previousCompanionVisible = current?.companionVisible ?? false;
  const previousAmbientPeekUntil = current?.ambientPeekUntil ?? null;

  const introJustFinished = ctx.introMenu.isIntroJustFinished();
  const settled = introJustFinished
    ? { ...ctx.settlePresentation(next), speech: null, triggerKind: null }
    : ctx.settlePresentation(next);
  ctx.setPresentation(settled);

  if (ctx.introMenu.syncForPeek(settled)) {
    ctx.syncOutsideClickListener();
  }
  ctx.positioner.syncPeekTransition(previousMood, settled.mood);

  const settings = ctx.getSettings();
  if (settings) {
    ctx.realCatCameo.sync(
      settled,
      { companionVisible: previousCompanionVisible, ambientPeekUntil: previousAmbientPeekUntil },
      {
        settings,
        hostname: ctx.hostname,
        resolveUrl: ctx.resolveUrl,
        setCompanionHidden: ctx.setCompanionHidden,
      },
    );
  }

  if (!introJustFinished) {
    if (
      ctx.introMenu.syncForCareMoment(settled, {
        eatingUntil: previousEatingUntil,
        playingUntil: previousPlayingUntil,
        pettingUntil: previousPettingUntil,
        talkUntil: previousTalkUntil,
      })
    ) {
      ctx.syncOutsideClickListener();
    }
  }

  const openSpeechBubble = shouldOpenSpeechBubbleForUpdate({
    introJustFinished,
    isIntro: ctx.introMenu.isIntroActive(),
    previousSpeech,
    nextSpeech: settled.speech,
    triggerKind: settled.triggerKind,
    speechBubbleOpen: ctx.introMenu.isSpeechBubbleOpen(),
  });
  if (openSpeechBubble) {
    ctx.introMenu.openSpeechBubble();
    ctx.syncOutsideClickListener();
  } else if (!settled.speech) {
    ctx.introMenu.setSpeechBubbleOpen(false);
  }

  const shouldReact = shouldReactToSpeechTrigger({
    previousSpeech,
    nextSpeech: settled.speech,
    triggerKind: settled.triggerKind,
  });
  ctx.render({
    animateMenu: openSpeechBubble || ctx.introMenu.isMenuOpen(),
    reactToTrigger: shouldReact,
    animateMood: shouldAnimateMoodTransition({
      previousSprite,
      nextSprite: settled.sprite,
      hasVisibleOverlay: Boolean(ctx.getRoot()?.isConnected),
    }),
  });

  if (
    !ctx.introMenu.isIntroCompleted() &&
    !introJustFinished &&
    ctx.isOverlayVisible() &&
    ctx.introMenu.getIntroStep() === null
  ) {
    ctx.beginIntroIfNeeded();
  }
}
