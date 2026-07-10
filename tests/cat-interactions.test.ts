import { describe, expect, it } from 'vitest';
import {
  buildInteractionOptions,
  buildSecondaryInteractionOptions,
  explainCurrentMood,
  isBored,
  mapInteractionToCareAction,
  needsPlayAttention,
  resolveAskMood,
} from '../utils/cat-interactions';
import { createInitialCat } from '../utils/cat-sim';

describe('buildInteractionOptions', () => {
  it('offers a frustration question when Tabby is stressed', () => {
    const options = buildInteractionOptions('stressed', {
      hunger: 30,
      happiness: 40,
      stress: 85,
      energy: 40,
    }, 'adult');

    expect(options[0]?.action).toBe('ask');
    expect(options[0]?.label).toMatch(/fussy|wrong/i);
  });

  it('offers feeding when Tabby is hungry or starving', () => {
    const hungry = buildInteractionOptions('hungry', {
      hunger: 70,
      happiness: 50,
      stress: 20,
      energy: 60,
    }, 'adult');
    const starving = buildInteractionOptions('starving', {
      hunger: 95,
      happiness: 35,
      stress: 15,
      energy: 40,
    }, 'adult');

    expect(hungry.some((option) => option.action === 'feed')).toBe(true);
    expect(starving.some((option) => option.action === 'feed')).toBe(true);
    expect(starving[0]?.label).toMatch(/Feed Tabby/);
  });

  it('offers play when Tabby is bored', () => {
    const options = buildInteractionOptions('content', {
      hunger: 35,
      happiness: 35,
      stress: 20,
      energy: 55,
    }, 'playful');

    expect(isBored({ hunger: 35, happiness: 35, stress: 20, energy: 55 }, 'content')).toBe(
      true,
    );
    expect(options.some((option) => option.action === 'play')).toBe(true);
  });

  it('uses gentler newborn wording when the baby kitten is fussy', () => {
    const options = buildInteractionOptions('stressed', {
      hunger: 30,
      happiness: 40,
      stress: 85,
      energy: 40,
    }, 'newborn');

    expect(options[0]?.label).toMatch(/fussy/i);
  });

  it('keeps hide behind secondary actions so it is harder to tap by mistake', () => {
    const primary = buildInteractionOptions('content', {
      hunger: 35,
      happiness: 70,
      stress: 20,
      energy: 55,
    }, 'adult');
    const secondary = buildSecondaryInteractionOptions();

    expect(primary.map((option) => option.action)).not.toContain('dismiss');
    expect(secondary.some((option) => option.action === 'dnd_30')).toBe(true);
    expect(secondary.some((option) => option.action === 'dismiss')).toBe(true);
  });

  it('still offers play after a pet only lifted happiness slightly', () => {
    const options = buildInteractionOptions('content', {
      hunger: 35,
      happiness: 52,
      stress: 20,
      energy: 55,
    }, 'playful');

    expect(needsPlayAttention({ hunger: 35, happiness: 52, stress: 20, energy: 55 }, 'content')).toBe(
      true,
    );
    expect(options[0]?.action).toBe('play');
    expect(options[0]?.primary).toBe(true);
  });

  it('highlights the mood-appropriate action, not always play', () => {
    const stressed = buildInteractionOptions('stressed', {
      hunger: 30,
      happiness: 40,
      stress: 85,
      energy: 40,
    }, 'adult');
    const hungry = buildInteractionOptions('hungry', {
      hunger: 70,
      happiness: 50,
      stress: 20,
      energy: 60,
    }, 'adult');
    const content = buildInteractionOptions('content', {
      hunger: 35,
      happiness: 70,
      stress: 20,
      energy: 55,
    }, 'adult');

    expect(stressed.find((option) => option.primary)?.action).toBe('ask');
    expect(hungry.find((option) => option.primary)?.action).toBe('feed');
    expect(content.some((option) => option.primary)).toBe(false);
    expect(content[0]?.action).toBe('ask');
  });
});

describe('explainCurrentMood', () => {
  it('explains stress without blaming the user', () => {
    const line = explainCurrentMood(
      'stressed',
      { hunger: 30, happiness: 40, stress: 85, energy: 40 },
      'adult',
      0,
    );

    expect(line).toMatch(/not mad at you|not upset with you|I'm fine/i);
    expect(line).toMatch(/noisy|much|spicy|loud/i);
  });

  it('explains extreme hunger in a funny warm way', () => {
    const line = explainCurrentMood(
      'starving',
      { hunger: 95, happiness: 35, stress: 15, energy: 40 },
      'adult',
      0,
    );

    expect(line).toMatch(/hungry|feed|good|interesting|starving|tummy/i);
  });

  it('still sounds bored after a pet only cheered Tabby up a little', () => {
    const vitals = { hunger: 35, happiness: 52, stress: 20, energy: 55 };
    const line = explainCurrentMood('content', vitals, 'playful', 0);

    expect(line).toMatch(/bored|fun|quiet|restless|interesting/i);
  });

  it('rotates happy check-in lines across taps', () => {
    const vitals = { hunger: 20, happiness: 80, stress: 10, energy: 70 };
    const lines = new Set(
      [0, 1, 2, 3].map((seed) => explainCurrentMood('happy', vitals, 'adult', seed)),
    );

    expect(lines.size).toBeGreaterThan(1);
  });
});

describe('resolveAskMood', () => {
  it('keeps hunger as the focus even after a comforting pet', () => {
    expect(
      resolveAskMood(
        { hunger: 72, happiness: 58, stress: 18, energy: 60 },
        'hungry',
      ),
    ).toBe('hungry');
  });

  it('keeps starving on ask when vitals still need food', () => {
    expect(
      resolveAskMood(
        { hunger: 90, happiness: 70, stress: 10, energy: 60 },
        'content',
      ),
    ).toBe('starving');
  });

  it('keeps a hungry dev preview mood until Tabby is fed', () => {
    expect(
      resolveAskMood(
        { hunger: 20, happiness: 70, stress: 10, energy: 60 },
        'content',
        'starving',
      ),
    ).toBe('starving');
  });

  it('still reads as needing play after a small happiness boost', () => {
    const mood = resolveAskMood(
      { hunger: 35, happiness: 52, stress: 20, energy: 55 },
      'content',
    );
    const line = explainCurrentMood(mood, {
      hunger: 35,
      happiness: 52,
      stress: 20,
      energy: 55,
    }, 'playful');

    expect(line).toMatch(/bored|fun|quiet/i);
  });

  it('reads happy after a check-in when grace is active', () => {
    const now = Date.now();
    const cat = {
      ...createInitialCat(now),
      happyUntil: now + 20 * 60_000,
    };

    expect(
      resolveAskMood(
        cat.vitals,
        'sleepy',
        'sleepy',
        cat,
        now,
      ),
    ).toBe('happy');
  });
});

describe('mapInteractionToCareAction', () => {
  it('maps feed to treat for the care engine', () => {
    expect(mapInteractionToCareAction('feed')).toBe('treat');
    expect(mapInteractionToCareAction('ask')).toBe('ask');
  });
});
