import type { InteractionAction } from '../../../utils/cat-interactions';
import { introNextLabel, introSkipLabel, introStepCount, introStepText } from '../../../utils/intro';
import { t } from '../../../utils/i18n';
import { MENU_ENTER_CLASS } from '../../../utils/overlay-entrance';
import type { CatPresentation } from '../../../utils/types';
import type { IntroMenuController, MenuBuildHandlers } from './intro-menu';

/** DOM construction for the care menu / intro walkthrough / speech bubble, split out of
 * IntroMenuController so that file stays state-and-decisions only. Every click handler here
 * calls back out through MenuBuildHandlers rather than mutating state directly — none of this
 * is "pure" in the sense of being side-effect-free, but it's pure in the sense that it never
 * decides anything, only asks the controller for its current state and reports taps upward. */

export function buildIntroMenuArea(
  menu: IntroMenuController,
  handlers: MenuBuildHandlers,
  options: { animate?: boolean } = {},
): HTMLElement {
  const menuArea = document.createElement('div');
  menuArea.className = 'tabby-menu-area tabby-menu-area--top';
  if (options.animate) {
    menuArea.classList.add(MENU_ENTER_CLASS);
  }

  const step = menu.getIntroStep() ?? 0;

  const controls = document.createElement('div');
  controls.className = 'tabby-card tabby-card--actions tabby-card--intro';

  const footer = document.createElement('div');
  footer.className = 'tabby-intro-footer';

  const progress = document.createElement('span');
  progress.className = 'tabby-intro-step';
  progress.textContent = `${step + 1} / ${introStepCount()}`;
  footer.appendChild(progress);

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'tabby-btn tabby-btn--suggested';
  nextButton.textContent = introNextLabel(step);
  nextButton.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.onAdvanceIntro();
  });
  footer.appendChild(nextButton);

  const skipButton = document.createElement('button');
  skipButton.type = 'button';
  skipButton.className = 'tabby-btn tabby-btn--link';
  skipButton.textContent = introSkipLabel();
  skipButton.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.onSkipIntro();
  });
  footer.appendChild(skipButton);

  controls.appendChild(footer);
  menuArea.appendChild(controls);
  menuArea.appendChild(buildSpeechBubble(introStepText(step)));

  return menuArea;
}

export function buildOverlayChrome(
  menu: IntroMenuController,
  presentation: CatPresentation,
  isCareMoment: boolean,
  handlers: MenuBuildHandlers,
  options: { animate?: boolean } = {},
): HTMLElement {
  const menuArea = document.createElement('div');
  menuArea.className = 'tabby-menu-area tabby-menu-area--top';
  if (options.animate) {
    menuArea.classList.add(MENU_ENTER_CLASS);
  }

  if (menu.isMenuOpen() && !isCareMoment) {
    menuArea.appendChild(buildCareCard(menu, presentation, handlers));
  }

  if (menu.shouldShowSpeechBubble(presentation) && presentation.speech) {
    menuArea.appendChild(
      buildSpeechBubble(presentation.speech, { showClose: !menu.isMenuOpen() }, handlers.onDismissSpeech),
    );
  }

  return menuArea;
}

function buildCareCard(
  menu: IntroMenuController,
  presentation: CatPresentation,
  handlers: MenuBuildHandlers,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'tabby-card tabby-card--actions';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'tabby-card-close';
  closeButton.title = t('overlay.closeMenu');
  closeButton.setAttribute('aria-label', t('overlay.closeMenu'));
  closeButton.textContent = '×';
  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.onCloseMenu();
  });
  card.appendChild(closeButton);

  const actions = document.createElement('div');
  actions.className = 'tabby-actions';

  for (const option of presentation.interactions) {
    actions.appendChild(createActionButton(menu, option, handlers));
  }

  const secondary = presentation.secondaryInteractions ?? [];
  if (secondary.length > 0) {
    const moreButton = document.createElement('button');
    moreButton.type = 'button';
    moreButton.className = 'tabby-btn tabby-btn--ghost';
    moreButton.setAttribute('aria-expanded', menu.isMoreOpen() ? 'true' : 'false');
    moreButton.textContent = menu.isMoreOpen() ? t('overlay.less') : t('overlay.more');
    moreButton.addEventListener('click', (event) => {
      event.stopPropagation();
      handlers.onToggleMore();
    });
    actions.appendChild(moreButton);

    if (menu.isMoreOpen()) {
      const secondaryActions = document.createElement('div');
      secondaryActions.className = 'tabby-actions-secondary';

      for (const option of secondary) {
        secondaryActions.appendChild(createActionButton(menu, option, handlers, { secondary: true }));
      }

      actions.appendChild(secondaryActions);
    }
  }

  card.appendChild(actions);

  return card;
}

function buildSpeechBubble(
  text: string,
  options: { showClose?: boolean } = {},
  onDismiss?: () => void,
): HTMLElement {
  const bubble = document.createElement('div');
  bubble.className = 'tabby-speech-bubble';

  if (options.showClose) {
    bubble.classList.add('tabby-speech-bubble--dismissible');
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'tabby-speech-bubble-close';
    closeButton.title = t('overlay.dismissSpeech');
    closeButton.setAttribute('aria-label', t('overlay.dismissSpeech'));
    closeButton.textContent = '×';
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      onDismiss?.();
    });
    bubble.appendChild(closeButton);
  }

  const bubbleText = document.createElement('p');
  bubbleText.className = 'tabby-speech-bubble-text';
  bubbleText.textContent = text;

  bubble.appendChild(bubbleText);
  return bubble;
}

function createActionButton(
  menu: IntroMenuController,
  option: {
    action: InteractionAction;
    label: string;
    enabled: boolean;
    primary?: boolean;
  },
  handlers: MenuBuildHandlers,
  options: { secondary?: boolean } = {},
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tabby-btn';
  button.dataset.action = option.action;

  const isPending = menu.getPendingAction() === option.action;
  const isActive = !isPending && menu.getHighlightedAction() === option.action;

  if (option.primary && !isActive && !isPending) {
    button.classList.add('tabby-btn--suggested');
  }
  if (options.secondary) {
    button.classList.add('tabby-btn--danger');
  }
  if (isPending) {
    button.classList.add('tabby-btn--pending');
    button.setAttribute('aria-busy', 'true');
  }
  if (isActive) {
    button.classList.add('tabby-btn--active');
    button.setAttribute('aria-current', 'true');
  }

  button.textContent = isPending ? `${option.label}…` : option.label;
  button.disabled = !option.enabled || isPending;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.onAction(option.action);
  });
  return button;
}
