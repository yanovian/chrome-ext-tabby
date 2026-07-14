import { describe, expect, it } from 'vitest';
import {
  DRAINING_SESSION_THRESHOLD_MS,
  EMPTY_DRAINING_SESSION,
  isDrainingSessionOverwhelmed,
  acknowledgeRecoveryEasing,
  applyDrainingSessionPageChange,
} from '../utils/draining-session';
import { resolveDisplayMood, moodOverrideWhileHiding, buildPresentation, resolvePeekPlacementForBuild, patchPresentationForDevForce } from '../utils/presentation';
import { evaluateEmotionalTrigger } from '../utils/emotional-triggers';
import { createInitialCat, deriveMoodFromVitals, STRESSED_VITAL_THRESHOLD } from '../utils/cat-sim';
import { DEFAULT_SETTINGS } from '../utils/types';

describe('resolveDisplayMood', () => {
  it('uses vitals-derived mood by default', () => {
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: 'happy',
      }),
    ).toBe('happy');
  });

  it('lets dev mode override mood for preview', () => {
    expect(
      resolveDisplayMood({
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'stressed' },
        derivedMood: 'happy',
      }),
    ).toBe('stressed');
  });

  it('lets dev mode beat an explicit mood override', () => {
    expect(
      resolveDisplayMood({
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'peek' },
        derivedMood: 'happy',
        moodOverride: 'happy',
      }),
    ).toBe('peek');
  });

  it('lets dev mode override ambient sleeping for preview', () => {
    expect(
      resolveDisplayMood({
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'happy' },
        derivedMood: 'content',
        ambientActivity: 'sleeping',
      }),
    ).toBe('happy');
  });

  it('lets dev mode override ambient peeking for preview', () => {
    expect(
      resolveDisplayMood({
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'happy' },
        derivedMood: 'content',
        ambientActivity: 'peeking',
      }),
    ).toBe('happy');
  });

  it('lets dev mode override grooming ambient during stay-visible stickiness', () => {
    expect(
      resolveDisplayMood({
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'stressed' },
        derivedMood: 'content',
        ambientActivity: 'grooming',
      }),
    ).toBe('stressed');
  });

  it('keeps peek mood for one hide so duck-out can play', () => {
    expect(moodOverrideWhileHiding('peek', false)).toBe('peek');
    expect(moodOverrideWhileHiding('peek', true)).toBeUndefined();
    expect(moodOverrideWhileHiding('happy', false)).toBeUndefined();
  });

  it('keeps hungry mood during ambient grooming', () => {
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: 'hungry',
        ambientActivity: 'grooming',
      }),
    ).toBe('hungry');
  });

  it('keeps happy mood during ambient grooming', () => {
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: 'happy',
        ambientActivity: 'grooming',
      }),
    ).toBe('happy');
  });

  it('lets dev mode beat care-action mood overrides during preview', () => {
    expect(
      resolveDisplayMood({
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'happy' },
        derivedMood: 'content',
        moodOverride: 'stressed',
      }),
    ).toBe('happy');
  });

  it('shows peek mood during ambient peeking even when vitals are stressed', () => {
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: 'stressed',
        ambientActivity: 'peeking',
      }),
    ).toBe('peek');
  });

  it('shows peek mood during ambient peeking on a draining session', () => {
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: 'content',
        ambientActivity: 'peeking',
        drainingSession: {
          ...EMPTY_DRAINING_SESSION,
          kind: 'social',
          accumulatedMs: 2 * 60_000,
        },
      }),
    ).toBe('peek');
  });

  it('shows stressed from short simulated feed time when vitals are content', () => {
    expect(
      resolveDisplayMood({
        settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'auto' },
        derivedMood: 'content',
        drainingSession: {
          ...EMPTY_DRAINING_SESSION,
          kind: 'social',
          accumulatedMs: 2 * 60_000,
        },
      }),
    ).toBe('stressed');
  });

  it('shows stressed from vitals before a long session tips into overwhelmed', () => {
    const vitals = { hunger: 30, happiness: 50, stress: STRESSED_VITAL_THRESHOLD, energy: 50 };
    const cat = createInitialCat(Date.now());
    const derived = deriveMoodFromVitals({
      vitals,
      cat,
      now: Date.now(),
      settings: DEFAULT_SETTINGS,
      isUserIdle: false,
    });
    expect(derived).toBe('stressed');
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: derived,
        drainingSession: {
          ...EMPTY_DRAINING_SESSION,
          kind: 'social',
          accumulatedMs: DRAINING_SESSION_THRESHOLD_MS - 60_000,
        },
      }),
    ).toBe('stressed');
  });

  it('upgrades vitals stressed to overwhelmed on a long social or news session', () => {
    const session = {
      ...EMPTY_DRAINING_SESSION,
      kind: 'news' as const,
      accumulatedMs: DRAINING_SESSION_THRESHOLD_MS,
    };
    expect(isDrainingSessionOverwhelmed(session, DEFAULT_SETTINGS)).toBe(true);
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: 'stressed',
        drainingSession: session,
      }),
    ).toBe('overwhelmed');
  });

  it('does not fire stressed speech when display mood is overwhelmed', () => {
    const now = Date.parse('2026-07-05T14:00:00.000Z');
    const cat = createInitialCat(now);
    const vitals = { hunger: 30, happiness: 50, stress: 90, energy: 40 };
    const session = {
      ...EMPTY_DRAINING_SESSION,
      kind: 'news' as const,
      accumulatedMs: DRAINING_SESSION_THRESHOLD_MS,
      pendingNudgeKind: 'news' as const,
    };
    const stressedOnly = evaluateEmotionalTrigger({
      cat: { ...cat, lastSpeechAt: 0, nudgesToday: 0 },
      vitals,
      settings: DEFAULT_SETTINGS,
      now,
      isUserIdle: false,
      recentMemory: null,
      drainingSession: {
        ...EMPTY_DRAINING_SESSION,
        kind: 'news',
        accumulatedMs: DRAINING_SESSION_THRESHOLD_MS - 60_000,
      },
    });
    expect(stressedOnly.mood).toBe('stressed');
    expect(stressedOnly.triggerKind).toBe('stressed');

    const overwhelmed = evaluateEmotionalTrigger({
      cat: { ...cat, lastSpeechAt: 0, nudgesToday: 0 },
      vitals,
      settings: DEFAULT_SETTINGS,
      now,
      isUserIdle: false,
      recentMemory: null,
      drainingSession: session,
    });
    expect(overwhelmed.mood).toBe('overwhelmed');
    expect(overwhelmed.triggerKind).toBe('overwhelmed');
    expect(overwhelmed.triggerKind).not.toBe('stressed');
  });

  it('shows stressed during recovery easing, then happy for thanks', () => {
    const overwhelmed = {
      ...EMPTY_DRAINING_SESSION,
      kind: 'social' as const,
      accumulatedMs: DRAINING_SESSION_THRESHOLD_MS,
    };
    const recovery = applyDrainingSessionPageChange(overwhelmed, {
      title: 'Docs',
      url: 'https://developer.mozilla.org/',
      now: 1_000,
      thresholdMs: DRAINING_SESSION_THRESHOLD_MS,
    });
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: 'content',
        drainingSession: recovery,
      }),
    ).toBe('stressed');

    const thanksReady = {
      ...acknowledgeRecoveryEasing(recovery, 1_500),
      pendingRecoveryNudge: 'thanks' as const,
    };
    expect(
      resolveDisplayMood({
        settings: DEFAULT_SETTINGS,
        derivedMood: 'content',
        drainingSession: thanksReady,
      }),
    ).toBe('happy');
  });
});

describe('buildPresentation peeking', () => {
  it('disables care actions during an ambient peek', () => {
    const now = Date.parse('2026-07-05T14:00:00.000Z');
    const cat = createInitialCat(now);
    const presentation = buildPresentation({
      cat,
      vitals: cat.vitals,
      settings: DEFAULT_SETTINGS,
      now,
      isUserIdle: false,
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      companionVisible: true,
      ambientActivity: 'peeking',
      peekEdge: 'left',
      peekInset: 12,
      peekCorner: 'left',
    });

    expect(presentation.mood).toBe('peek');
    expect(presentation.canPet).toBe(false);
    expect(presentation.canTreat).toBe(false);
    expect(presentation.canPlay).toBe(false);
  });

  it('keeps the restore-to ambient activity through the hidden duck gap', () => {
    // Regression: the duck gap (companionVisible false, mood still 'peek'
    // via moodOverride) isn't isPeekPresentation (that needs companionVisible
    // true), so gating peekRestoreAmbientActivity on isPeeking wiped it to
    // null every time she ducked out between visits — reveal would then
    // restore to nothing instead of her real prior activity.
    const now = Date.parse('2026-07-05T14:00:00.000Z');
    const cat = createInitialCat(now);
    const presentation = buildPresentation({
      cat,
      vitals: cat.vitals,
      settings: DEFAULT_SETTINGS,
      now,
      isUserIdle: false,
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      companionVisible: false,
      ambientActivity: 'peeking',
      moodOverride: 'peek',
      peekRestoreAmbientActivity: 'grooming',
      peekRestoreAmbientUntil: now + 120_000,
    });

    expect(presentation.mood).toBe('peek');
    expect(presentation.companionVisible).toBe(false);
    expect(presentation.peekRestoreAmbientActivity).toBe('grooming');
    expect(presentation.peekRestoreAmbientUntil).toBe(now + 120_000);
  });

  it('assigns a peek edge when dev forces peek mood', () => {
    const now = Date.parse('2026-07-05T14:00:00.000Z');
    const cat = createInitialCat(now);
    const presentation = buildPresentation({
      cat,
      vitals: cat.vitals,
      settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'peek' },
      now,
      isUserIdle: false,
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      companionVisible: true,
    });

    expect(presentation.mood).toBe('peek');
    expect(presentation.ambientActivity).toBe('peeking');
    expect(presentation.peekEdge).toBeTruthy();
    expect(presentation.peekInset).toBeGreaterThanOrEqual(8);
    expect(presentation.canPet).toBe(false);
  });

  it('clears stay-visible stickiness when dev forces a mood', () => {
    const now = Date.parse('2026-07-05T14:00:00.000Z');
    const cat = createInitialCat(now);
    const presentation = buildPresentation({
      cat,
      vitals: cat.vitals,
      settings: { ...DEFAULT_SETTINGS, devModeEnabled: true, devForceMood: 'peek' },
      now,
      isUserIdle: false,
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      companionVisible: true,
      stayVisibleUntil: now + 120_000,
    });

    expect(presentation.mood).toBe('peek');
    expect(presentation.stayVisibleUntil).toBeNull();
  });
});

describe('patchPresentationForDevForce', () => {
  it('forces peek after stay-visible stickiness', () => {
    const now = Date.parse('2026-07-05T14:00:00.000Z');
    const cat = createInitialCat(now);
    const base = buildPresentation({
      cat,
      vitals: cat.vitals,
      settings: DEFAULT_SETTINGS,
      now,
      isUserIdle: false,
      speech: null,
      triggerKind: null,
      overlayHidden: false,
      companionVisible: true,
      moodOverride: 'happy',
      stayVisibleUntil: now + 120_000,
    });
    const patched = patchPresentationForDevForce(base, {
      ...DEFAULT_SETTINGS,
      devModeEnabled: true,
      devForceMood: 'peek',
    }, now);

    expect(patched.mood).toBe('peek');
    expect(patched.stayVisibleUntil).toBeNull();
    expect(patched.companionVisible).toBe(true);
    expect(patched.peekEdge).toBeTruthy();
  });
});

describe('resolvePeekPlacementForBuild', () => {
  it('reuses placement when edge is already set', () => {
    const placement = resolvePeekPlacementForBuild({
      isPeeking: true,
      peekEdge: 'right',
      peekInset: 20,
      peekCorner: 'right',
      seed: 0,
    });
    expect(placement).toEqual({ edge: 'right', inset: 20, corner: 'right' });
  });

  it('rolls a new placement when peeking without an edge', () => {
    const placement = resolvePeekPlacementForBuild({
      isPeeking: true,
      peekEdge: null,
      seed: 42,
    });
    expect(placement).toBeTruthy();
    expect(['bottom', 'left', 'right']).toContain(placement!.edge);
  });
});
