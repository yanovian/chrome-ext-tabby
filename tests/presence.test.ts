import { describe, expect, it } from 'vitest';
import { createInitialCat } from '../utils/cat-sim';
import { resolveCompanionPresence } from '../utils/presence';
import { DEFAULT_SETTINGS, type CatPresentation } from '../utils/types';

const NOW = Date.parse('2026-07-06T14:00:00.000Z');

const basePresentation: CatPresentation = {
  mood: 'content',
  stage: 'adult',
  stageLabel: 'Grown-up Tabby',
  sprite: 'gif/adult/idle.gif',
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
  peekEdge: null,
  peekInset: null,
  peekCorner: null,
  peekRestoreAmbientActivity: null,
  peekRestoreAmbientUntil: null,
  stayVisibleUntil: null,
  eatingUntil: null,
  playingUntil: null,
};

const idleTrigger = {
  shouldAppear: false,
  mood: 'content' as const,
  speechContext: null,
  triggerKind: null,
};

function resolve(input: Partial<Parameters<typeof resolveCompanionPresence>[0]> = {}) {
  return resolveCompanionPresence({
    cat: createInitialCat(NOW),
    settings: DEFAULT_SETTINGS,
    now: NOW,
    isUserIdle: false,
    speechTrigger: idleTrigger,
    doNotDisturb: { until: null },
    introCompleted: true,
    lastPresentation: null,
    ...input,
  });
}

describe('resolveCompanionPresence', () => {
  it('hides Tabby during global do not disturb', () => {
    const result = resolve({
      doNotDisturb: { until: NOW + 60_000 },
    });

    expect(result.companionVisible).toBe(false);
  });

  it('hides Tabby during do not disturb even before intro is completed', () => {
    const result = resolve({
      doNotDisturb: { until: NOW + 60_000 },
      introCompleted: false,
    });

    expect(result.companionVisible).toBe(false);
  });

  it('shows speech without ambient activity', () => {
    const result = resolve({
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
    });

    expect(result.companionVisible).toBe(true);
    expect(result.recordSpeech).toBe(true);
    expect(result.ambientActivity).toBeNull();
  });

  it('keeps an ambient rest alive until it expires', () => {
    const result = resolve({
      speechTrigger: {
        shouldAppear: false,
        mood: 'sleepy',
        speechContext: null,
        triggerKind: null,
      },
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

  it('peeks from an edge by default during daytime', () => {
    const result = resolve({
      cat: { ...createInitialCat(NOW), lastAmbientAt: NOW },
    });

    expect(result.companionVisible).toBe(true);
    expect(result.ambientActivity).toBe('peeking');
    expect(['bottom', 'left', 'right']).toContain(result.peekEdge);
    expect(result.peekInset).toBeGreaterThan(0);
  });

  it('stays hidden at night when idle', () => {
    const nightNow = Date.parse('2026-07-06T02:00:00.000Z');
    const result = resolveCompanionPresence({
      cat: createInitialCat(nightNow),
      settings: DEFAULT_SETTINGS,
      now: nightNow,
      isUserIdle: false,
      speechTrigger: idleTrigger,
      doNotDisturb: { until: null },
      introCompleted: true,
      lastPresentation: null,
    });

    expect(result.companionVisible).toBe(false);
    expect(result.ambientActivity).toBeNull();
  });

  it('resumes peeking from a new corner after the duck gap', () => {
    const result = resolve({
      lastPresentation: {
        ...basePresentation,
        mood: 'peek',
        companionVisible: false,
        ambientActivity: 'peeking',
        ambientPeekUntil: NOW - 1,
      },
    });

    expect(result.companionVisible).toBe(true);
    expect(result.ambientActivity).toBe('peeking');
    expect(['bottom', 'left', 'right']).toContain(result.peekEdge);
    expect(result.recordAmbient).toBe(false);
  });

  it('waits during an active peek duck gap', () => {
    const result = resolve({
      lastPresentation: {
        ...basePresentation,
        mood: 'peek',
        companionVisible: false,
        ambientActivity: 'peeking',
        ambientPeekUntil: NOW + 5_000,
      },
    });

    expect(result.companionVisible).toBe(false);
    expect(result.ambientActivity).toBe('peeking');
    expect(result.ambientPeekUntil).toBe(NOW + 5_000);
  });

  it('keeps Tabby on screen after reveal until the timer ends', () => {
    const result = resolve({
      lastPresentation: {
        ...basePresentation,
        companionVisible: true,
        ambientActivity: null,
        stayVisibleUntil: NOW + 120_000,
      },
    });

    expect(result.companionVisible).toBe(true);
    expect(result.ambientActivity).toBeNull();
    expect(result.recordAmbient).toBe(false);
  });

  it('prefers stay-visible after reveal over an active peek visit', () => {
    const result = resolve({
      lastPresentation: {
        ...basePresentation,
        companionVisible: true,
        ambientActivity: 'peeking',
        ambientPeekUntil: NOW + 60_000,
        stayVisibleUntil: NOW + 120_000,
      },
    });

    expect(result.companionVisible).toBe(true);
    expect(result.ambientActivity).toBeNull();
    expect(result.peekEdge).toBeNull();
  });

  it('keeps restored grooming ambient during stay-visible', () => {
    const result = resolve({
      lastPresentation: {
        ...basePresentation,
        companionVisible: true,
        ambientActivity: 'grooming',
        ambientPeekUntil: NOW + 120_000,
        stayVisibleUntil: NOW + 120_000,
      },
    });

    expect(result.companionVisible).toBe(true);
    expect(result.ambientActivity).toBe('grooming');
    expect(result.ambientPeekUntil).toBe(NOW + 120_000);
  });

  it('ignores stay-visible stickiness when dev forces a mood', () => {
    const result = resolve({
      settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'happy' },
      lastPresentation: {
        ...basePresentation,
        companionVisible: true,
        ambientActivity: 'grooming',
        ambientPeekUntil: NOW + 120_000,
        stayVisibleUntil: NOW + 120_000,
      },
    });

    expect(result.companionVisible).toBe(true);
    expect(result.ambientActivity).toBeNull();
    expect(result.peekEdge).toBeNull();
  });

  it('returns to peeking after stay-visible ends', () => {
    const result = resolve({
      lastPresentation: {
        ...basePresentation,
        companionVisible: true,
        ambientActivity: null,
        stayVisibleUntil: NOW - 1,
      },
    });

    expect(result.companionVisible).toBe(true);
    expect(result.ambientActivity).toBe('peeking');
  });

  it('returns to peeking after stay-visible grooming ends', () => {
    const result = resolve({
      lastPresentation: {
        ...basePresentation,
        companionVisible: true,
        ambientActivity: 'grooming',
        ambientPeekUntil: NOW - 1,
      },
    });

    expect(result.companionVisible).toBe(true);
    expect(result.ambientActivity).toBe('peeking');
  });

  it('starts a hidden rest with sleeping or grooming, not peeking', () => {
    const eligibleNow = Date.parse('2026-07-06T14:00:00.000Z');
    const cat = {
      ...createInitialCat(eligibleNow),
      adoptedAt: 5,
      lastCareAt: 0,
      lastAmbientAt: 0,
      ambientsToday: 0,
    };
    const result = resolveCompanionPresence({
      cat,
      settings: { ...DEFAULT_SETTINGS, devModeEnabled: true },
      now: eligibleNow,
      isUserIdle: false,
      speechTrigger: idleTrigger,
      doNotDisturb: { until: null },
      introCompleted: true,
      lastPresentation: null,
    });

    expect(result.companionVisible).toBe(false);
    expect(result.ambientActivity).not.toBe('peeking');
    expect(result.recordAmbient).toBe(true);
  });

  it('shows Tabby during intro without unprompted speech', () => {
    const result = resolve({
      introCompleted: false,
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
    });

    expect(result.companionVisible).toBe(true);
    expect(result.recordSpeech).toBe(false);
  });

  it('records dev force tick speech even before the intro tour finishes', () => {
    const result = resolve({
      settings: { ...DEFAULT_SETTINGS, devModeEnabled: true },
      introCompleted: false,
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
      forceVisible: true,
    });

    expect(result.companionVisible).toBe(true);
    expect(result.recordSpeech).toBe(true);
  });

  it('records speech when forceVisible and the trigger fired (dev tick)', () => {
    const result = resolve({
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
      forceVisible: true,
    });

    expect(result.companionVisible).toBe(true);
    expect(result.recordSpeech).toBe(true);
    expect(result.ambientActivity).toBeNull();
  });

  it('keeps peeking through non-urgent speech while in the peek cycle', () => {
    const result = resolve({
      speechTrigger: {
        shouldAppear: true,
        mood: 'curious',
        speechContext: {
          kind: 'curious',
          mood: 'curious',
          stage: 'adult',
          seed: NOW,
        },
        triggerKind: 'curious',
      },
      lastPresentation: {
        ...basePresentation,
        mood: 'peek',
        companionVisible: false,
        ambientActivity: 'peeking',
        ambientPeekUntil: NOW + 5_000,
      },
    });

    expect(result.companionVisible).toBe(false);
    expect(result.ambientActivity).toBe('peeking');
    expect(result.recordSpeech).toBe(false);
  });

  it('shows Tabby without speech when forceVisible has no trigger', () => {
    const result = resolve({
      forceVisible: true,
    });

    expect(result.companionVisible).toBe(true);
    expect(result.recordSpeech).toBe(false);
  });
});
