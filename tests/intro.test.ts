import { describe, expect, it } from 'vitest';
import {
  INTRO_SKIP_LABEL,
  INTRO_STEPS,
  introNextLabel,
  introStepCount,
  introStepText,
} from '../utils/intro';

describe('intro', () => {
  it('keeps the tour short', () => {
    expect(introStepCount()).toBe(4);
    for (const line of INTRO_STEPS) {
      expect(line.split(/\s+/).length).toBeLessThanOrEqual(16);
    }
  });

  it('mentions avoiding distraction before the closing step', () => {
    expect(introStepText(2)).toMatch(/avoid distraction/i);
  });

  it('shows who Tabby is on the first step', () => {
    expect(introStepText(0)).toMatch(/Tabby/i);
  });

  it('reminds the user to care for Tabby on the last step', () => {
    expect(introStepText(introStepCount() - 1)).toMatch(/feed|play/i);
  });

  it('labels the final button Got it', () => {
    expect(introNextLabel(0)).toBe('Next');
    expect(introNextLabel(introStepCount() - 1)).toBe('Got it');
  });

  it('offers a skip link for returning users', () => {
    expect(INTRO_SKIP_LABEL).toMatch(/already know Tabby/i);
  });
});
