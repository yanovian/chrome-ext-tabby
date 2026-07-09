import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  companionAnimationPath,
  companionCanvasSizeFromPath,
  moodToAnimationState,
  peekDuckAnimationPath,
  resolveCompanionAnimation,
  resolveCompanionAnimationState,
} from '../utils/companion-animation';

describe('resolveCompanionAnimation', () => {
  it('maps moods to animation clips', () => {
    expect(resolveCompanionAnimation({ stage: 'adult', mood: 'happy' })).toBe(
      'animations/adult/happy.json',
    );
    expect(resolveCompanionAnimation({ stage: 'playful', mood: 'starving' })).toBe(
      'animations/playful/eat.json',
    );
  });

  it('maps peek mood to peek animation', () => {
    expect(moodToAnimationState('peek')).toBe('peek');
    expect(resolveCompanionAnimation({ stage: 'adult', mood: 'peek' })).toBe(
      'animations/adult/peek.json',
    );
  });

  it('maps overwhelmed mood to overwhelmed animation', () => {
    expect(moodToAnimationState('overwhelmed')).toBe('overwhelmed');
    expect(resolveCompanionAnimation({ stage: 'adult', mood: 'overwhelmed' })).toBe(
      'animations/adult/overwhelmed.json',
    );
  });

  it('prefers ambient activity over mood', () => {
    expect(
      resolveCompanionAnimation({
        stage: 'adult',
        mood: 'content',
        ambientActivity: 'grooming',
      }),
    ).toBe('animations/adult/groom.json');
  });

  it('uses play after a play care action', () => {
    expect(
      resolveCompanionAnimationState({
        mood: 'content',
        lastCareAction: 'play',
      }),
    ).toBe('play');
  });

  it('uses feeding after a feed care action', () => {
    expect(
      resolveCompanionAnimationState({
        mood: 'happy',
        lastCareAction: 'feed',
      }),
    ).toBe('feeding');
    expect(
      resolveCompanionAnimation({
        stage: 'adult',
        mood: 'hungry',
        lastCareAction: 'feed',
      }),
    ).toBe('animations/adult/feeding.json');
  });

  it('uses feeding while eatingUntil is active', () => {
    const now = 1_000_000;
    expect(
      resolveCompanionAnimation({
        stage: 'adult',
        mood: 'happy',
        eatingUntil: now + 5_000,
        now,
      }),
    ).toBe('animations/adult/feeding.json');
  });

  it('uses playing while playingUntil is active', () => {
    const now = 1_000_000;
    expect(
      resolveCompanionAnimationState({
        mood: 'content',
        lastCareAction: 'play',
        playingUntil: now + 5_000,
        now,
      }),
    ).toBe('playing');
    expect(
      resolveCompanionAnimation({
        stage: 'adult',
        mood: 'content',
        playingUntil: now + 5_000,
        now,
      }),
    ).toBe('animations/adult/playing.json');
  });

  it('exposes a peek duck clip per stage', () => {
    expect(peekDuckAnimationPath('adult')).toBe('animations/adult/peek_duck.json');
  });
});

describe('moodToAnimationState', () => {
  it('defaults to idle for a calm mood', () => {
    expect(moodToAnimationState('content')).toBe('idle');
    expect(companionAnimationPath('newborn', 'sleep')).toBe('animations/newborn/sleep.json');
  });
});

describe('companionCanvasSizeFromPath', () => {
  it('matches the Lottie composition size for each stage', () => {
    expect(companionCanvasSizeFromPath('animations/newborn/idle.json')).toBe(140);
    expect(companionCanvasSizeFromPath('animations/playful/happy.json')).toBe(180);
    expect(companionCanvasSizeFromPath('animations/adult/play.json')).toBe(220);
  });
});

describe('generated companion animations', () => {
  it('includes visible gold eyes in idle clips', () => {
    const json = readFileSync(
      join(process.cwd(), 'public/animations/adult/idle.json'),
      'utf8',
    );
    expect(json).toContain('"nm":"EyeL"');
    expect(json).toContain('0.99,0.82,0.18');
  });

  it('keeps the head layer in front of the body layer', () => {
    const animation = JSON.parse(
      readFileSync(join(process.cwd(), 'public/animations/adult/idle.json'), 'utf8'),
    ) as { layers: Array<{ nm: string; ind: number; shapes?: Array<{ nm: string }> }> };
    const head = animation.layers.find((layer) => layer.nm === 'Head');
    const body = animation.layers.find((layer) => layer.nm === 'Body');
    expect(head?.ind).toBeGreaterThan(body?.ind ?? 0);
    expect(head?.shapes?.[0]?.nm).toBe('Face');
    expect(head?.shapes?.[1]?.nm).toBe('HeadShell');
  });

  it('includes a bowl in feeding clips', () => {
    const animation = JSON.parse(
      readFileSync(join(process.cwd(), 'public/animations/adult/feeding.json'), 'utf8'),
    ) as { layers: Array<{ nm: string }> };
    expect(animation.layers.some((layer) => layer.nm === 'Bowl')).toBe(true);
  });

  it('does not show a bowl in hungry eat clips', () => {
    const animation = JSON.parse(
      readFileSync(join(process.cwd(), 'public/animations/adult/eat.json'), 'utf8'),
    ) as { layers: Array<{ nm: string }> };
    expect(animation.layers.some((layer) => layer.nm === 'Bowl')).toBe(false);
  });

  it('keeps tail and batting paws attached inside the body layer', () => {
    const animation = JSON.parse(
      readFileSync(join(process.cwd(), 'public/animations/adult/playing.json'), 'utf8'),
    ) as {
      layers: Array<{
        nm: string;
        shapes?: Array<{ nm: string; it?: Array<{ nm: string }> }>;
      }>;
    };
    expect(animation.layers.some((layer) => layer.nm === 'TailPlay')).toBe(false);
    const bodyLayer = animation.layers.find((layer) => layer.nm === 'Body');
    const bodyRig = bodyLayer?.shapes?.[0];
    expect(bodyRig?.nm).toBe('BodyRig');
    expect(bodyRig?.it?.some((item) => item.nm === 'Tail')).toBe(true);
    expect(bodyRig?.it?.some((item) => item.nm === 'PawBatL')).toBe(true);
    expect(bodyRig?.it?.some((item) => item.nm === 'PawBatR')).toBe(true);
  });
});
