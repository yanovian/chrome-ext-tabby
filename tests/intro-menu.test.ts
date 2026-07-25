import { describe, expect, it } from 'vitest';
import { IntroMenuController } from '../entrypoints/content/overlay/intro-menu';
import type { CatPresentation } from '../utils/types';

const NOW = Date.parse('2026-07-05T14:00:00.000Z');

const base: CatPresentation = {
  mood: 'happy',
  stage: 'adult',
  stageLabel: 'Adult',
  sprite: 'gif/adult/talk.gif',
  speech: "Just vibing, why do you ask?",
  triggerKind: null,
  overlayHidden: false,
  canPet: true,
  canTreat: false,
  canPlay: true,
  interactions: [],
  secondaryInteractions: [],
  lastCareAction: 'ask',
  companionVisible: true,
  ambientActivity: null,
  ambientPeekUntil: null,
  peekEdge: null,
  peekInset: null,
  peekCorner: null,
  peekRestoreAmbientActivity: null,
  peekRestoreAmbientUntil: null,
  stayVisibleUntil: null,
  eatingUntil: null,
  playingUntil: null,
  pettingUntil: null,
  talkUntil: NOW + 3_000,
};

describe('IntroMenuController.syncForCareMoment', () => {
  it('clears the highlighted action once talking finishes, without touching the open menu', () => {
    const menu = new IntroMenuController();
    menu.openMenuState(false);
    menu.setHighlightedAction('ask');

    const finished: CatPresentation = { ...base, speech: null, lastCareAction: null, talkUntil: null };
    menu.syncForCareMoment(finished, { talkUntil: base.talkUntil });

    expect(menu.getHighlightedAction()).toBeNull();
    expect(menu.isMenuOpen()).toBe(true);
  });

  it('clears the highlighted action once petting finishes, without touching the open menu', () => {
    const menu = new IntroMenuController();
    menu.openMenuState(false);
    menu.setHighlightedAction('pet');

    const petting: CatPresentation = { ...base, lastCareAction: 'pet', pettingUntil: NOW + 1_600 };
    const finished: CatPresentation = { ...petting, lastCareAction: null, pettingUntil: null };
    menu.syncForCareMoment(finished, { pettingUntil: petting.pettingUntil });

    expect(menu.getHighlightedAction()).toBeNull();
    expect(menu.isMenuOpen()).toBe(true);
  });

  it('leaves the highlight alone, and does NOT close the menu, while talking is still active', () => {
    // Regression: unlike feeding/playing (a full physical "moment" that's meant to close the
    // menu), talking is a quick read-at-your-pace reaction — she keeps talking with the menu
    // open right in front of the user, exactly like petting always has.
    const menu = new IntroMenuController();
    menu.openMenuState(false);
    menu.setHighlightedAction('ask');

    menu.syncForCareMoment(base, {});

    expect(menu.getHighlightedAction()).toBe('ask');
    expect(menu.isMenuOpen()).toBe(true);
  });

  it('does not close the menu while petting is still active', () => {
    const menu = new IntroMenuController();
    menu.openMenuState(false);
    menu.setHighlightedAction('pet');

    const petting: CatPresentation = { ...base, lastCareAction: 'pet', pettingUntil: NOW + 1_600 };
    menu.syncForCareMoment(petting, {});

    expect(menu.getHighlightedAction()).toBe('pet');
    expect(menu.isMenuOpen()).toBe(true);
  });

  it('still closes the menu while feeding is active, unchanged from before', () => {
    const menu = new IntroMenuController();
    menu.openMenuState(false);

    // syncForCareMoment checks isFeedingActive against the real clock (Date.now()), not a
    // passed-in `now` — needs a genuinely future timestamp, unlike the other fixtures above
    // whose historical NOW is fine since petting/talking no longer factor into `active` at all.
    const feeding: CatPresentation = { ...base, lastCareAction: 'feed', eatingUntil: Date.now() + 5_000 };
    const closed = menu.syncForCareMoment(feeding, {});

    expect(closed).toBe(true);
    expect(menu.isMenuOpen()).toBe(false);
  });
});
