import { describe, expect, it } from 'vitest';
import {
  CARE_RECOVERY_AWAY_CREDIT_MS,
  CARE_RECOVERY_CREDIT_MS,
  DRAINING_SESSION_THRESHOLD_MS,
  RECOVERY_THANKS_THRESHOLD_MS,
  advanceDrainingSession,
  acknowledgeDrainingNudge,
  acknowledgeRecoveryEasing,
  applyCareRecoveryCredit,
  applyDrainingSessionPageChange,
  EMPTY_DRAINING_SESSION,
  isDrainingSessionStressed,
} from '../utils/draining-session';
import { DEFAULT_SETTINGS } from '../utils/types';

describe('isDrainingSessionStressed', () => {
  it('is true for short social dwell below overwhelmed', () => {
    expect(
      isDrainingSessionStressed(
        {
          ...EMPTY_DRAINING_SESSION,
          kind: 'social',
          accumulatedMs: 2 * 60_000,
        },
        DEFAULT_SETTINGS,
      ),
    ).toBe(true);
  });

  it('is false once overwhelmed', () => {
    expect(
      isDrainingSessionStressed(
        {
          ...EMPTY_DRAINING_SESSION,
          kind: 'news',
          accumulatedMs: DRAINING_SESSION_THRESHOLD_MS,
        },
        DEFAULT_SETTINGS,
      ),
    ).toBe(false);
  });
});

describe('advanceDrainingSession', () => {
  const threshold = DRAINING_SESSION_THRESHOLD_MS;
  const recoveryThanks = RECOVERY_THANKS_THRESHOLD_MS;

  it('accumulates time on social hosts', () => {
    const first = advanceDrainingSession(EMPTY_DRAINING_SESSION, {
      title: 'Home / X',
      url: 'https://x.com/home',
      elapsedMs: 30 * 60_000,
      now: 1_000,
      thresholdMs: threshold,
      recoveryThanksThresholdMs: recoveryThanks,
    });
    expect(first.kind).toBe('social');
    expect(first.accumulatedMs).toBe(30 * 60_000);
    expect(first.pendingNudgeKind).toBeNull();

    const second = advanceDrainingSession(first, {
      title: 'Home / X',
      url: 'https://x.com/home',
      elapsedMs: 31 * 60_000,
      now: 2_000,
      thresholdMs: threshold,
      recoveryThanksThresholdMs: recoveryThanks,
    });
    expect(second.accumulatedMs).toBe(61 * 60_000);
    expect(second.pendingNudgeKind).toBe('social');
  });

  it('resets when leaving draining sites before overwhelmed', () => {
    const social = advanceDrainingSession(EMPTY_DRAINING_SESSION, {
      title: 'Feed',
      url: 'https://instagram.com/',
      elapsedMs: 20 * 60_000,
      now: 1_000,
      thresholdMs: threshold,
      recoveryThanksThresholdMs: recoveryThanks,
    });
    const reset = applyDrainingSessionPageChange(social, {
      title: 'Docs',
      url: 'https://developer.mozilla.org/en-US/docs/Web',
      now: 2_000,
      thresholdMs: threshold,
    });
    expect(reset).toEqual(EMPTY_DRAINING_SESSION);
  });

  it('starts recovery when leaving an overwhelmed session', () => {
    const overwhelmed = advanceDrainingSession(EMPTY_DRAINING_SESSION, {
      title: 'CNN',
      url: 'https://www.cnn.com/',
      elapsedMs: threshold,
      now: 1_000,
      thresholdMs: threshold,
      recoveryThanksThresholdMs: recoveryThanks,
    });
    expect(overwhelmed.pendingNudgeKind).toBe('news');

    const recovery = applyDrainingSessionPageChange(overwhelmed, {
      title: 'Docs',
      url: 'https://developer.mozilla.org/en-US/docs/Web',
      now: 2_000,
      thresholdMs: threshold,
    });
    expect(recovery.kind).toBeNull();
    expect(recovery.pendingRecoveryNudge).toBe('easing');
    expect(recovery.recoveryStartedAt).toBe(2_000);
  });

  it('queues thanks after a minute away once easing was shown', () => {
    const recovery = applyDrainingSessionPageChange(
      {
        ...EMPTY_DRAINING_SESSION,
        kind: 'social',
        accumulatedMs: threshold,
      },
      {
        title: 'Docs',
        url: 'https://example.com/docs',
        now: 1_000,
        thresholdMs: threshold,
      },
    );
    const eased = acknowledgeRecoveryEasing(recovery, 1_500);
    const afterAway = advanceDrainingSession(eased, {
      title: 'Docs',
      url: 'https://example.com/docs',
      elapsedMs: recoveryThanks,
      now: 2_000,
      thresholdMs: threshold,
      recoveryThanksThresholdMs: recoveryThanks,
    });
    expect(afterAway.pendingRecoveryNudge).toBe('thanks');
    expect(afterAway.recoveryAwayMs).toBe(recoveryThanks);
  });

  it('resets the timer when switching between social and news', () => {
    const social = advanceDrainingSession(EMPTY_DRAINING_SESSION, {
      title: 'X',
      url: 'https://x.com/home',
      elapsedMs: 45 * 60_000,
      now: 1_000,
      thresholdMs: threshold,
      recoveryThanksThresholdMs: recoveryThanks,
    });
    const news = advanceDrainingSession(social, {
      title: 'CNN',
      url: 'https://www.cnn.com/',
      elapsedMs: 5 * 60_000,
      now: 2_000,
      thresholdMs: threshold,
      recoveryThanksThresholdMs: recoveryThanks,
    });
    expect(news.kind).toBe('news');
    expect(news.accumulatedMs).toBe(5 * 60_000);
    expect(news.pendingNudgeKind).toBeNull();
  });

  it('queues only one nudge per accumulation cycle', () => {
    const ready = advanceDrainingSession(EMPTY_DRAINING_SESSION, {
      title: 'CNN',
      url: 'https://www.cnn.com/',
      elapsedMs: threshold,
      now: 1_000,
      thresholdMs: threshold,
      recoveryThanksThresholdMs: recoveryThanks,
    });
    expect(ready.pendingNudgeKind).toBe('news');

    const stillReady = advanceDrainingSession(ready, {
      title: 'CNN',
      url: 'https://www.cnn.com/',
      elapsedMs: 60_000,
      now: 2_000,
      thresholdMs: threshold,
      recoveryThanksThresholdMs: recoveryThanks,
    });
    expect(stillReady.pendingNudgeKind).toBe('news');

    const acknowledged = acknowledgeDrainingNudge(ready, 3_000);
    const afterMore = advanceDrainingSession(acknowledged, {
      title: 'CNN',
      url: 'https://www.cnn.com/',
      elapsedMs: 60_000,
      now: 4_000,
      thresholdMs: threshold,
      recoveryThanksThresholdMs: recoveryThanks,
    });
    expect(afterMore.pendingNudgeKind).toBeNull();
    expect(afterMore.lastNudgedAt).toBe(3_000);
  });
});

describe('applyCareRecoveryCredit', () => {
  it('knocks time off an active session on pet, but does not clear it outright', () => {
    const session = {
      ...EMPTY_DRAINING_SESSION,
      kind: 'social' as const,
      accumulatedMs: DRAINING_SESSION_THRESHOLD_MS,
    };
    const credited = applyCareRecoveryCredit(session, 'pet', DEFAULT_SETTINGS);
    expect(credited.accumulatedMs).toBe(
      DRAINING_SESSION_THRESHOLD_MS - CARE_RECOVERY_CREDIT_MS.pet,
    );
    expect(credited.kind).toBe('social');
  });

  it('play knocks off more than pet', () => {
    const session = {
      ...EMPTY_DRAINING_SESSION,
      kind: 'news' as const,
      accumulatedMs: DRAINING_SESSION_THRESHOLD_MS,
    };
    const credited = applyCareRecoveryCredit(session, 'play', DEFAULT_SETTINGS);
    expect(credited.accumulatedMs).toBe(
      DRAINING_SESSION_THRESHOLD_MS - CARE_RECOVERY_CREDIT_MS.play,
    );
  });

  it('floors accumulatedMs at zero instead of going negative', () => {
    const session = {
      ...EMPTY_DRAINING_SESSION,
      kind: 'social' as const,
      accumulatedMs: 60_000,
    };
    const credited = applyCareRecoveryCredit(session, 'play', DEFAULT_SETTINGS);
    expect(credited.accumulatedMs).toBe(0);
  });

  it('does nothing when there is no active session', () => {
    const credited = applyCareRecoveryCredit(EMPTY_DRAINING_SESSION, 'pet', DEFAULT_SETTINGS);
    expect(credited).toBe(EMPTY_DRAINING_SESSION);
  });

  it('adds to recovery-away progress once recovery has already started', () => {
    const session = {
      ...EMPTY_DRAINING_SESSION,
      recoveryStartedAt: 1_000,
      recoveryAwayMs: 10_000,
      recoveryEasingAckedAt: 1_000,
    };
    const credited = applyCareRecoveryCredit(session, 'pet', DEFAULT_SETTINGS);
    expect(credited.recoveryAwayMs).toBe(10_000 + CARE_RECOVERY_AWAY_CREDIT_MS.pet);
  });

  it('queues the thanks nudge once recovery-away credit reaches the threshold', () => {
    const session = {
      ...EMPTY_DRAINING_SESSION,
      recoveryStartedAt: 1_000,
      recoveryAwayMs: RECOVERY_THANKS_THRESHOLD_MS - CARE_RECOVERY_AWAY_CREDIT_MS.play,
      recoveryEasingAckedAt: 1_000,
    };
    const credited = applyCareRecoveryCredit(session, 'play', DEFAULT_SETTINGS);
    expect(credited.pendingRecoveryNudge).toBe('thanks');
  });
});
