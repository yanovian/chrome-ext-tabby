import { describe, expect, it } from 'vitest';
import { createInitialCat } from '../utils/cat-sim';
import { resolveCompanionPresence } from '../utils/presence';
import { DEFAULT_SETTINGS, type CatPresentation } from '../utils/types';

const NOW = Date.parse('2026-07-06T14:00:00.000Z');

const basePresentation: CatPresentation = {
  mood: 'content',
  stage: 'adult',
  stageLabel: 'Grown-up Tabby',
  sprite: 'animations/adult/idle.json',
  speech: null,
  triggerKind: null,
  overlayHidden: false,
  canPet: true,
  canTreat: false,
  canPlay: false,
  interactions: [],
  secondaryInteractions: [],
  lastCareAction: null,
  companionVisible: false,
  ambientActivity: null,
  ambientPeekUntil: null,
  eatingUntil: null,
  playingUntil: null,
};

describe('resolveCompanionPresence', () => {
  it('hides Tabby during global do not disturb', () => {
    const result = resolveCompanionPresence({
      cat: createInitialCat(NOW),
      settings: DEFAULT_SETTINGS,
      now: NOW,
      speechTrigger: {
        shouldAppear: false,
        mood: 'content',
        speechContext: null,
        triggerKind: null,
      },
      doNotDisturb: { until: NOW + 60_000 },
      introCompleted: true,
      lastPresentation: null,
    });

    expect(result.companionVisible).toBe(false);
  });

  it('hides Tabby during do not disturb even before intro is completed', () => {
    const result = resolveCompanionPresence({
      cat: createInitialCat(NOW),
      settings: DEFAULT_SETTINGS,
      now: NOW,
      speechTrigger: {
        shouldAppear: false,
        mood: 'content',
        speechContext: null,
        triggerKind: null,
      },
      doNotDisturb: { until: NOW + 60_000 },
      introCompleted: false,
      lastPresentation: null,
    });

    expect(result.companionVisible).toBe(false);
  });

  it('shows speech without ambient activity', () => {
    const result = resolveCompanionPresence({
      cat: createInitialCat(NOW),
      settings: DEFAULT_SETTINGS,
      now: NOW,
      speechTrigger: {
        shouldAppear: true,
        mood: 'hungry',
        speechContext: {
          kind: 'hungry',
          mood: 'hungry',
          stage: 'adult',
          seed: NOW,
        },
        triggerKind: 'hungry',
      },
      doNotDisturb: { until: null },
      introCompleted: true,
      lastPresentation: null,
    });

    expect(result.companionVisible).toBe(true);
    expect(result.recordSpeech).toBe(true);
    expect(result.ambientActivity).toBeNull();
  });

  it('keeps an ambient rest alive until it expires', () => {
    const result = resolveCompanionPresence({
      cat: createInitialCat(NOW),
      settings: DEFAULT_SETTINGS,
      now: NOW,
      speechTrigger: {
        shouldAppear: false,
        mood: 'sleepy',
        speechContext: null,
        triggerKind: null,
      },
      doNotDisturb: { until: null },
      introCompleted: true,
      lastPresentation: {
        ...basePresentation,
        companionVisible: false,
        ambientActivity: 'sleeping',
        ambientPeekUntil: NOW + 20_000,
      },
    });

    expect(result.companionVisible).toBe(false);
    expect(result.ambientActivity).toBe('sleeping');
    expect(result.recordAmbient).toBe(false);
  });

  it('stays mostly visible by default after intro', () => {
    const result = resolveCompanionPresence({
      cat: { ...createInitialCat(NOW), lastAmbientAt: NOW },
      settings: DEFAULT_SETTINGS,
      now: NOW,
      speechTrigger: {
        shouldAppear: false,
        mood: 'content',
        speechContext: null,
        triggerKind: null,
      },
      doNotDisturb: { until: null },
      introCompleted: true,
      lastPresentation: null,
    });

    expect(result.companionVisible).toBe(true);
    expect(result.ambientActivity).toBe('grooming');
  });

  it('starts a rest with sleeping or grooming, not peeking', () => {
    const cat = {
      ...createInitialCat(0),
      lastAmbientAt: 0,
      ambientsToday: 0,
    };
    const eligibleNow = Date.parse('2026-07-06T14:04:00.000Z');
    const result = resolveCompanionPresence({
      cat,
      settings: { ...DEFAULT_SETTINGS, devModeEnabled: true },
      now: eligibleNow,
      speechTrigger: {
        shouldAppear: false,
        mood: 'content',
        speechContext: null,
        triggerKind: null,
      },
      doNotDisturb: { until: null },
      introCompleted: true,
      lastPresentation: null,
    });

    expect(result.companionVisible).toBe(false);
    expect(result.ambientActivity).not.toBe('peeking');
    expect(result.recordAmbient).toBe(true);
  });

  it('shows Tabby during intro without unprompted speech', () => {
    const result = resolveCompanionPresence({
      cat: createInitialCat(NOW),
      settings: DEFAULT_SETTINGS,
      now: NOW,
      speechTrigger: {
        shouldAppear: true,
        mood: 'hungry',
        speechContext: {
          kind: 'hungry',
          mood: 'hungry',
          stage: 'adult',
          seed: NOW,
        },
        triggerKind: 'hungry',
      },
      doNotDisturb: { until: null },
      introCompleted: false,
      lastPresentation: null,
    });

    expect(result.companionVisible).toBe(true);
    expect(result.recordSpeech).toBe(false);
  });

  it('records dev force tick speech even before the intro tour finishes', () => {
    const result = resolveCompanionPresence({
      cat: createInitialCat(NOW),
      settings: { ...DEFAULT_SETTINGS, devModeEnabled: true },
      now: NOW,
      speechTrigger: {
        shouldAppear: true,
        mood: 'hungry',
        speechContext: {
          kind: 'hungry',
          mood: 'hungry',
          stage: 'adult',
          seed: NOW,
        },
        triggerKind: 'hungry',
      },
      doNotDisturb: { until: null },
      introCompleted: false,
      lastPresentation: null,
      forceVisible: true,
    });

    expect(result.companionVisible).toBe(true);
    expect(result.recordSpeech).toBe(true);
  });

  it('records speech when forceVisible and the trigger fired (dev tick)', () => {
    const result = resolveCompanionPresence({
      cat: createInitialCat(NOW),
      settings: DEFAULT_SETTINGS,
      now: NOW,
      speechTrigger: {
        shouldAppear: true,
        mood: 'hungry',
        speechContext: {
          kind: 'hungry',
          mood: 'hungry',
          stage: 'adult',
          seed: NOW,
        },
        triggerKind: 'hungry',
      },
      doNotDisturb: { until: null },
      introCompleted: true,
      lastPresentation: null,
      forceVisible: true,
    });

    expect(result.companionVisible).toBe(true);
    expect(result.recordSpeech).toBe(true);
    expect(result.ambientActivity).toBeNull();
  });

  it('shows Tabby without speech when forceVisible has no trigger', () => {
    const result = resolveCompanionPresence({
      cat: createInitialCat(NOW),
      settings: DEFAULT_SETTINGS,
      now: NOW,
      speechTrigger: {
        shouldAppear: false,
        mood: 'content',
        speechContext: null,
        triggerKind: null,
      },
      doNotDisturb: { until: null },
      introCompleted: true,
      lastPresentation: null,
      forceVisible: true,
    });

    expect(result.companionVisible).toBe(true);
    expect(result.recordSpeech).toBe(false);
  });
});
