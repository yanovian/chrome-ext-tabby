import { applyNodeLocale } from '../../../utils/i18n';
import {
  COMPANION_ENTER_ANIMATION,
  COMPANION_ENTER_MS,
  OVERLAY_ENTER_CLASS,
  waitForOverlayAnimation,
} from '../../../utils/overlay-entrance';
import { PEEK_VISIBLE_HEIGHT_RATIO } from '../../../utils/companion-animation';
import { CAT_DISPLAY_SIZE, peekCatSurfaceLayout, peekVisibleSize } from '../../../utils/overlay-position';
import type { CatPresentation } from '../../../utils/types';
import { peekPlacement } from './peek-state';
import type { OverlayPositioner } from './positioner';
import type { OverlayTransitions } from './transitions';
import type { IntroMenuController, MenuBuildHandlers } from './intro-menu';

export const ROOT_ID = 'tabby-companion-root';

/** Everything buildRoot/patchRoot need to ask of the coordinator and its other collaborators.
 * Bundled into one object so these stay plain functions (not another stateful class) while
 * still respecting the max-params lint rule. */
export interface RenderContext {
  positioner: OverlayPositioner;
  transitions: OverlayTransitions;
  introMenu: IntroMenuController;
  hasOverlayChrome: boolean;
  isIntroActive: boolean;
  isCareMoment: boolean;
  menuHandlers: MenuBuildHandlers;
  getPresentation: () => CatPresentation | null;
  onTap: () => void;
}

export interface PatchOptions {
  animateMenu?: boolean;
  reactToTrigger?: boolean;
  animateMood?: boolean;
}

export function applyRootPresentationClasses(
  root: HTMLElement,
  presentation: CatPresentation,
  ctx: RenderContext,
): void {
  root.classList.add('tabby-root');
  for (const stage of ['newborn', 'playful', 'adult'] as const) {
    root.classList.toggle(`tabby-root--${stage}`, presentation.stage === stage);
  }
  root.classList.toggle('tabby-root--menu-open', ctx.hasOverlayChrome);
  root.classList.toggle('tabby-root--intro', ctx.isIntroActive);
  root.classList.toggle(
    'tabby-root--ambient-sleeping',
    presentation.ambientActivity === 'sleeping' && !presentation.speech,
  );
  root.classList.toggle(
    'tabby-root--ambient-grooming',
    presentation.ambientActivity === 'grooming' && !presentation.speech,
  );
  root.classList.toggle('tabby-root--mood-peek', presentation.mood === 'peek');

  const peekEdge = peekPlacement(presentation).edge;
  for (const edge of ['bottom', 'left', 'right'] as const) {
    root.classList.toggle(
      `tabby-root--peek-edge-${edge}`,
      presentation.mood === 'peek' && peekEdge === edge,
    );
  }

  if (presentation.mood === 'peek') {
    const catSize = CAT_DISPLAY_SIZE[presentation.stage];
    const visibleSize = peekVisibleSize(catSize);
    const surfaceLayout = peekCatSurfaceLayout(peekEdge, catSize);
    root.style.setProperty('--tabby-cat-size', `${catSize}px`);
    root.style.setProperty('--tabby-peek-visible-size', `${visibleSize}px`);
    root.style.setProperty('--tabby-peek-visible-ratio', String(PEEK_VISIBLE_HEIGHT_RATIO));
    ctx.positioner.applyPeekSurfaceLayout(surfaceLayout, root);
  } else {
    root.style.removeProperty('--tabby-cat-size');
    root.style.removeProperty('--tabby-peek-visible-size');
    root.style.removeProperty('--tabby-peek-visible-ratio');
    ctx.positioner.applyPeekSurfaceLayout(null, root);
  }
}

function buildMenuContent(presentation: CatPresentation, options: { animateMenu?: boolean }, ctx: RenderContext): HTMLElement {
  return ctx.isIntroActive
    ? ctx.introMenu.buildIntroMenuArea(ctx.menuHandlers, { animate: options.animateMenu })
    : ctx.introMenu.buildOverlayChrome(presentation, ctx.isCareMoment, ctx.menuHandlers, {
        animate: options.animateMenu,
      });
}

export async function buildRoot(
  presentation: CatPresentation,
  options: { animateMenu?: boolean },
  ctx: RenderContext,
): Promise<HTMLElement> {
  const root = document.createElement('div');
  root.id = ROOT_ID;
  applyNodeLocale(root);

  const panel = document.createElement('div');
  panel.className = 'tabby-panel';

  const catSurface = document.createElement('div');
  catSurface.className = 'tabby-cat-surface';

  await ctx.transitions.createPlayer(catSurface, presentation.sprite);

  panel.appendChild(catSurface);
  applyRootPresentationClasses(root, presentation, ctx);

  if (ctx.hasOverlayChrome) {
    panel.appendChild(buildMenuContent(presentation, options, ctx));
  }

  ctx.positioner.attachDragAndTapHandlers(root, catSurface, ctx.getPresentation, ctx.onTap);

  root.appendChild(panel);
  return root;
}

export function patchRoot(
  root: HTMLElement,
  presentation: CatPresentation,
  options: PatchOptions,
  ctx: RenderContext,
): void {
  applyRootPresentationClasses(root, presentation, ctx);

  if (ctx.transitions.hasPlayer()) {
    ctx.transitions.updateCatAnimation(presentation, {
      animateMood: options.animateMood,
      reactToTrigger: options.reactToTrigger,
    });
  }

  for (const menu of root.querySelectorAll('.tabby-menu-area')) {
    menu.remove();
  }

  if (!ctx.hasOverlayChrome) {
    delete root.dataset.menuPlacement;
    return;
  }

  const panel = root.querySelector('.tabby-panel');
  if (!(panel instanceof HTMLElement)) {
    return;
  }

  panel.appendChild(buildMenuContent(presentation, options, ctx));
}

export function playEntrance(root: HTMLElement): void {
  if (root.classList.contains('tabby-root--mood-peek')) {
    return;
  }
  root.classList.add(OVERLAY_ENTER_CLASS);
  void waitForOverlayAnimation(root, COMPANION_ENTER_ANIMATION, COMPANION_ENTER_MS).then(() => {
    root.classList.remove(OVERLAY_ENTER_CLASS);
  });
}
