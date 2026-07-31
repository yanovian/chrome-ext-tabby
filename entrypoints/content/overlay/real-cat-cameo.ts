import { isEnteringShooDuckGap, pickRealCatPhoto, realCatAssetPath } from '../../../utils/real-cats';
import type { AvoidToken, PeekSlot } from '../../../utils/site-registry/corner-avoidance';
import type { CatPresentation, ExtensionSettings } from '../../../utils/types';

/** Deliberately slower than her own COMPANION_ENTER_MS/EXIT_MS (360/240ms) — those are tuned
 * for a snappy UI reaction, but this is a "look at this photo" moment that reads better
 * eased in and out over a beat longer than that. */
const ENTER_MS = 700;
const EXIT_MS = 500;
const SIZE_PX = 96;
const ELEMENT_ID = 'tabby-real-cat-cameo';

interface CameoContext {
  settings: ExtensionSettings;
  hostname?: string;
  resolveUrl: (path: string) => string;
  /** She and the cameo must never show at once — this hides/restores her own sprite for the
   * cameo's duration, however she got there (a natural shoo duck, or a dev preview fired
   * while she's still fully visible on screen). */
  setCompanionHidden: (hidden: boolean) => void;
  /** Clicking the cameo dismisses it and reveals her previous (pre-shoo) mood, same as tapping
   * her while she's peeking. */
  onReveal: () => void;
  /** Called once the cameo naturally finishes (its own hold timer, not an interruption from a
   * new presentation) so whatever she should be doing right now — pop back up, keep ducking,
   * whatever the latest presentation already says — actually renders, instead of leaving
   * whatever the last unrelated render happened to mount. */
  render: () => void;
  /** Called once whenever a preview-triggered cameo ends, however it ends (clicked away, or
   * left to run out on its own) — picking a specific photo in the dev panel forces her into
   * peek pose alongside it (see settings-form.ts), and once that one-shot preview is over, that
   * forced pick has served its purpose and shouldn't linger and keep forcing the same photo on
   * every future duck gap. Never called for the natural shoo/duck path (isPreview is only ever
   * true here), which doesn't touch devForceRealCat at all. */
  resetDevForceRealCat: () => void;
}

/** Anchors the cameo to the same screen edge her own peek would use for that slot — a plain
 * translate, not the rotated peek-surface treatment her own sprite uses, since a square photo
 * doesn't need to look like it's "peeking up" rotated. */
const SLOT_STYLE: Record<PeekSlot, Partial<CSSStyleDeclaration>> = {
  bl: { bottom: '0px', left: '24px' },
  br: { bottom: '0px', right: '24px' },
  lb: { left: '0px', bottom: '80px' },
  lt: { left: '0px', top: '80px' },
  rb: { right: '0px', bottom: '80px' },
  rt: { right: '0px', top: '80px' },
};

const ENTER_FROM_BOTTOM = 'translateY(115%)';
const ENTER_FROM_LEFT = 'translateX(-115%)';
const ENTER_FROM_RIGHT = 'translateX(115%)';

/** Which direction the cameo slides in from. Left/right edge slots (lb/lt/rb/rt) always slide
 * in from their own side. Bottom slots (bl/br) slide up from the bottom by default — UNLESS
 * the photo's own token is the exact slot (not the 'b' group), meaning it's specifically
 * composed for that corner, in which case it slides in from the matching side instead. */
export function enterTransformFor(slot: PeekSlot, token: AvoidToken): string {
  if (slot === 'bl') {
    return token === 'bl' ? ENTER_FROM_LEFT : ENTER_FROM_BOTTOM;
  }
  if (slot === 'br') {
    return token === 'br' ? ENTER_FROM_RIGHT : ENTER_FROM_BOTTOM;
  }
  return slot === 'lb' || slot === 'lt' ? ENTER_FROM_LEFT : ENTER_FROM_RIGHT;
}

/**
 * A one-off funny-photo cameo shown while she's ducked away after being shooed (see
 * utils/real-cats.ts for the manifest/placement logic this just renders). Deliberately not
 * part of CatPresentation/the background state machine: it's a purely decorative, per-tab
 * aside, not something her mood needs to stay consistent about across tabs or a reload.
 */
export class RealCatCameoController {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private element: HTMLImageElement | null = null;
  private scheduledForPeekUntil: number | null = null;
  /** Set only while an element is actually mounted (she's actually hidden right now) — so
   * cancel() only un-hides her when this controller is the one that hid her in the first
   * place, never as a side effect of cancelling a merely-scheduled, not-yet-shown timer. */
  private unhide: (() => void) | null = null;
  /** Captured alongside unhide, for the same reason — only meaningful (and only ever called)
   * while isPreview is true. */
  private resetDevForceRealCat: (() => void) | null = null;
  /** True while the currently-showing cameo was started via preview() rather than the natural
   * shoo/duck path. A dev preview deliberately forces her mood to 'peek' alongside it (see
   * settings-form.ts), which makes the backend recompute and republish a presentation with
   * companionVisible: true — sync() must not read that as "she's back, cancel the cameo" when
   * it's the cameo's own preview that caused it. */
  private isPreview = false;

  /** Call on every presentation update. Schedules a cameo the instant a shoo-triggered duck
   * gap begins, and tears down anything in progress the moment she's visible again (another
   * care action, an ambient tick recomputing her own peek) so the two can't show at once. */
  sync(
    presentation: CatPresentation,
    previous: { companionVisible: boolean; ambientPeekUntil: number | null },
    context: CameoContext,
  ): void {
    if (presentation.companionVisible) {
      if (!this.isPreview) {
        this.cancel();
      }
      return;
    }
    if (
      !isEnteringShooDuckGap(presentation, previous) ||
      this.scheduledForPeekUntil === presentation.ambientPeekUntil
    ) {
      return;
    }
    this.scheduledForPeekUntil = presentation.ambientPeekUntil;
    const delay = Math.max(0, presentation.ambientPeekUntil! - Date.now());
    this.timer = setTimeout(() => this.show(presentation.stage, context, false), delay);
  }

  /** Dev-only: preview a specific (or random) cameo immediately, bypassing the shoo/duck
   * wait entirely — the point is to be able to check each corner mapping on demand. She may
   * still be fully visible when this fires (unlike the natural shoo path), so show() still
   * has to hide her itself rather than assume she already is. */
  preview(context: { stage: CatPresentation['stage'] } & CameoContext): void {
    this.show(context.stage, context, true);
  }

  private show(stage: CatPresentation['stage'], context: CameoContext, isPreview: boolean): void {
    const forcedFile =
      context.settings.devForceRealCat === 'auto' ? undefined : context.settings.devForceRealCat;
    const placement = pickRealCatPhoto({
      seed: Date.now(),
      stage,
      hostname: context.hostname,
      forcedFile,
    });
    if (!placement) {
      return;
    }

    this.cancel();
    this.isPreview = isPreview;
    context.setCompanionHidden(true);
    this.unhide = () => context.setCompanionHidden(false);
    this.resetDevForceRealCat = () => context.resetDevForceRealCat();

    const enterFrom = enterTransformFor(placement.slot, placement.token);
    const size = Math.round(SIZE_PX * placement.scale);
    const img = document.createElement('img');
    img.id = ELEMENT_ID;
    img.decoding = 'async';
    img.src = context.resolveUrl(realCatAssetPath(placement.file));
    img.alt = '';
    Object.assign(img.style, {
      position: 'fixed',
      width: `${size}px`,
      height: `${size}px`,
      objectFit: 'contain',
      zIndex: '2147483646',
      opacity: '0',
      cursor: 'pointer',
      transform: enterFrom,
      transition: `transform ${ENTER_MS}ms ease-out, opacity ${ENTER_MS}ms ease-out`,
      ...SLOT_STYLE[placement.slot],
    });
    img.addEventListener('click', () => context.onReveal());

    document.body.appendChild(img);
    this.element = img;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        img.style.opacity = '1';
        img.style.transform = 'translate(0, 0)';
      });
    });

    this.timer = setTimeout(() => {
      img.style.transition = `transform ${EXIT_MS}ms ease-in, opacity ${EXIT_MS}ms ease-in`;
      img.style.opacity = '0';
      img.style.transform = enterFrom;
      this.timer = setTimeout(() => {
        // cancel() owns every bit of "a cameo just ended" cleanup — including, if this was a
        // preview, un-forcing devForceRealCat — so this doesn't have to separately remember to
        // do any of that itself.
        this.cancel();
        // Nothing else triggers a render at this exact moment (unlike sync()'s own cancel-on-
        // visible call, which always happens from inside an applyPresentationUpdate that renders
        // right after) — so this has to ask for one itself, or whatever she should be doing
        // right now (pop back up, keep ducking) just doesn't happen until some unrelated update
        // happens to arrive.
        context.render();
      }, EXIT_MS);
    }, ENTER_MS + placement.holdMs);
  }

  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.element?.remove();
    this.element = null;
    this.scheduledForPeekUntil = null;
    this.unhide?.();
    this.unhide = null;
    if (this.isPreview) {
      this.resetDevForceRealCat?.();
    }
    this.resetDevForceRealCat = null;
    this.isPreview = false;
  }
}
