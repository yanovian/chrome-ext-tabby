import { describe, expect, it } from 'vitest';
import {
  deriveLifeStage,
  resolveLifeStage,
  LIFE_STAGE_THRESHOLDS_DAYS,
} from '../utils/cat-sim';
import { companionAnimationPath, resolveCompanionAnimation } from '../utils/companion-animation';
import { lifeStageLabel } from '../utils/sprites';

const ADOPTED = Date.parse('2026-01-01T00:00:00.000Z');

describe('deriveLifeStage', () => {
  it('shows a newborn kitten during the first two weeks together', () => {
    const now = ADOPTED + LIFE_STAGE_THRESHOLDS_DAYS.newbornMax * 24 * 60 * 60 * 1000;
    expect(deriveLifeStage(ADOPTED, now)).toBe('newborn');
  });

  it('grows into a playful naughty kitten after the newborn phase', () => {
    const now = ADOPTED + (LIFE_STAGE_THRESHOLDS_DAYS.newbornMax + 20) * 24 * 60 * 60 * 1000;
    expect(deriveLifeStage(ADOPTED, now)).toBe('playful');
  });

  it('becomes a grown-up cat after several months', () => {
    const now = ADOPTED + (LIFE_STAGE_THRESHOLDS_DAYS.playfulMax + 30) * 24 * 60 * 60 * 1000;
    expect(deriveLifeStage(ADOPTED, now)).toBe('adult');
  });
});

describe('resolveLifeStage', () => {
  it('allows dev override to preview any life stage instantly', () => {
    const ancient = ADOPTED + 400 * 24 * 60 * 60 * 1000;
    expect(resolveLifeStage(ADOPTED, ancient, 'newborn')).toBe('newborn');
    expect(resolveLifeStage(ADOPTED, ancient, 'playful')).toBe('playful');
  });
});

describe('resolveCompanionAnimation', () => {
  it('uses animated JSON assets for each age and mood', () => {
    expect(resolveCompanionAnimation({ stage: 'newborn', mood: 'happy' })).toBe(
      'animations/newborn/happy.json',
    );
    expect(resolveCompanionAnimation({ stage: 'playful', mood: 'stressed' })).toBe(
      'animations/playful/stress.json',
    );
    expect(resolveCompanionAnimation({ stage: 'adult', mood: 'starving' })).toBe(
      'animations/adult/eat.json',
    );
  });

  it('labels each life stage for the overlay caption', () => {
    expect(lifeStageLabel('newborn')).toBe('Newborn kitten');
    expect(lifeStageLabel('playful')).toBe('Playful kitten');
    expect(lifeStageLabel('adult')).toBe('Grown-up Tabby');
    expect(companionAnimationPath('adult', 'idle')).toBe('animations/adult/idle.json');
  });
});
