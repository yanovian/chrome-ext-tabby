import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  companionAnimationPath,
  companionCanvasSizeFromPath,
  companionDisplayScaleForStage,
  companionPreviewSizeForStage,
  lifeStageFromCompanionAssetPath,
  COMPANION_PREVIEW_MAX,
  companionDisplaySizeForStage,
  COMPANION_GIF_SOURCE_SIZE,
  moodToAnimationState,
  peekDuckAnimationPath,
  resolveCompanionAnimation,
  resolveCompanionAnimationState,
} from '../utils/companion-animation';

const LOTTIE = (segment: string) => join(process.cwd(), 'lottie-json', segment);

describe('resolveCompanionAnimation', () => {
  it('maps moods to animation clips', () => {
    expect(resolveCompanionAnimation({ stage: 'adult', mood: 'happy' })).toBe(
      'gif/adult/happy.gif',
    );
    expect(resolveCompanionAnimation({ stage: 'playful', mood: 'hungry' })).toBe(
      'gif/playful/eat.gif',
    );
    expect(resolveCompanionAnimation({ stage: 'playful', mood: 'starving' })).toBe(
      'gif/playful/starving.gif',
    );
  });

  it('maps peek mood to peek animation', () => {
    expect(moodToAnimationState('peek')).toBe('peek');
    expect(resolveCompanionAnimation({ stage: 'adult', mood: 'peek' })).toBe(
      'gif/adult/peek.gif',
    );
  });

  it('maps overwhelmed mood to overwhelmed animation', () => {
    expect(moodToAnimationState('overwhelmed')).toBe('overwhelmed');
    expect(resolveCompanionAnimation({ stage: 'adult', mood: 'overwhelmed' })).toBe(
      'gif/adult/overwhelmed.gif',
    );
  });

  it('draws overwhelmed cover paws in front of the face', async () => {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(LOTTIE('adult/overwhelmed.json'), 'utf8');
    const animation = JSON.parse(raw) as {
      layers: Array<{ nm: string; shapes?: Array<{ nm: string }> }>;
    };
    const head = animation.layers.find((layer) => layer.nm === 'Head');
    expect(animation.layers[0]?.nm).toBe('CoverHands');
    expect(head?.shapes?.map((shape) => shape.nm)).toEqual(['Face', 'HeadShell']);
  });

  it('prefers ambient activity over mood', () => {
    expect(
      resolveCompanionAnimation({
        stage: 'adult',
        mood: 'content',
        ambientActivity: 'grooming',
      }),
    ).toBe('gif/adult/groom.gif');
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
    ).toBe('gif/adult/feeding.gif');
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
    ).toBe('gif/adult/feeding.gif');
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
    ).toBe('gif/adult/playing.gif');
  });

  it('exposes a peek duck clip per stage', () => {
    expect(peekDuckAnimationPath('adult')).toBe('gif/adult/peek_duck.gif');
  });
});

describe('moodToAnimationState', () => {
  it('defaults to idle for a calm mood', () => {
    expect(moodToAnimationState('content')).toBe('idle');
    expect(companionAnimationPath('newborn', 'sleep')).toBe('gif/newborn/sleep.gif');
  });
});

describe('companionCanvasSizeFromPath', () => {
  it('returns uniform GIF source size for shipped clips', () => {
    expect(companionCanvasSizeFromPath('gif/newborn/idle.gif')).toBe(COMPANION_GIF_SOURCE_SIZE);
    expect(companionCanvasSizeFromPath('gif/playful/happy.gif')).toBe(COMPANION_GIF_SOURCE_SIZE);
    expect(companionCanvasSizeFromPath('gif/adult/play.gif')).toBe(COMPANION_GIF_SOURCE_SIZE);
  });

  it('still returns Lottie composition size for JSON paths', () => {
    expect(companionCanvasSizeFromPath('lottie-json/newborn/idle.json')).toBe(140);
    expect(companionCanvasSizeFromPath('lottie-json/adult/play.json')).toBe(220);
  });
});

describe('companion display scale by life stage', () => {
  it('scales 150px GIF source smaller for newborn and larger for adult', () => {
    expect(companionDisplaySizeForStage('newborn')).toBe(132);
    expect(companionDisplaySizeForStage('playful')).toBe(162);
    expect(companionDisplaySizeForStage('adult')).toBe(192);
    expect(companionDisplayScaleForStage('newborn')).toBeLessThan(1);
    expect(companionDisplayScaleForStage('adult')).toBeGreaterThan(1);
  });

  it('scales popup preview smallest for newborn and largest for adult', () => {
    expect(companionPreviewSizeForStage('newborn')).toBeLessThan(
      companionPreviewSizeForStage('playful'),
    );
    expect(companionPreviewSizeForStage('playful')).toBeLessThan(
      companionPreviewSizeForStage('adult'),
    );
    expect(companionPreviewSizeForStage('adult')).toBe(COMPANION_PREVIEW_MAX);
  });

  it('reads life stage from companion asset paths', () => {
    expect(lifeStageFromCompanionAssetPath('gif/newborn/idle.gif')).toBe('newborn');
    expect(lifeStageFromCompanionAssetPath('gif/adult/happy.gif')).toBe('adult');
    expect(lifeStageFromCompanionAssetPath('other/path.gif')).toBeNull();
  });
});

describe('generated companion Lottie sources', () => {
  it('includes visible gold eyes in idle clips', () => {
    const json = readFileSync(LOTTIE('adult/idle.json'), 'utf8');
    expect(json).toContain('"nm":"EyeL"');
    expect(json).toContain('0.99,0.82,0.18');
  });

  it('keeps the head layer in front of the body layer', () => {
    const animation = JSON.parse(readFileSync(LOTTIE('adult/idle.json'), 'utf8')) as {
      layers: Array<{ nm: string; ind: number; shapes?: Array<{ nm: string }> }>;
    };
    const head = animation.layers.find((layer) => layer.nm === 'Head');
    const body = animation.layers.find((layer) => layer.nm === 'Body');
    expect(head?.ind).toBeGreaterThan(body?.ind ?? 0);
    expect(head?.shapes?.[0]?.nm).toBe('Face');
    expect(head?.shapes?.[1]?.nm).toBe('HeadShell');
  });

  it('includes a bowl in feeding clips', () => {
    const animation = JSON.parse(readFileSync(LOTTIE('adult/feeding.json'), 'utf8')) as {
      layers: Array<{ nm: string }>;
    };
    expect(animation.layers.some((layer) => layer.nm === 'Bowl')).toBe(true);
  });

  it('does not show a bowl in hungry eat clips', () => {
    const animation = JSON.parse(readFileSync(LOTTIE('adult/eat.json'), 'utf8')) as {
      layers: Array<{ nm: string }>;
    };
    expect(animation.layers.some((layer) => layer.nm === 'Bowl')).toBe(false);
  });

  it('keeps tail and batting paws attached inside the body layer', () => {
    const animation = JSON.parse(readFileSync(LOTTIE('adult/playing.json'), 'utf8')) as {
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
