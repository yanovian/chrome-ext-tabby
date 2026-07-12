import { describe, expect, it } from 'vitest';
import {
  introNextLabel,
  introSkipLabel,
  introStepCount,
  introStepText,
} from '../utils/intro';
import { tLines } from '../utils/i18n';

describe('intro', () => {
  it('keeps the tour short', () => {
    expect(introStepCount()).toBe(4);
    for (const line of tLines('intro')) {
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
    expect(introSkipLabel()).toMatch(/already know Tabby/i);
  });
});
