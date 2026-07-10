import { describe, expect, it } from 'vitest';
import {
  LOTTIE_GIF_STAGE_SIZE,
  TABBY_GIF_EXPORT_SIZE,
  normalizeLottiefilesGifName,
} from '../utils/lottie-gif-convert.mjs';

describe('lottie gif convert helpers', () => {
  it('exports every stage at 150px', () => {
    expect(TABBY_GIF_EXPORT_SIZE).toBe(150);
    expect(LOTTIE_GIF_STAGE_SIZE).toEqual({
      newborn: 150,
      playful: 150,
      adult: 150,
    });
  });

  it('normalizes Lottiefiles download filenames', () => {
    expect(normalizeLottiefilesGifName('idle.gif', 'idle')).toBe('idle.gif');
    expect(normalizeLottiefilesGifName('idle.json.gif', 'idle')).toBe('idle.gif');
    expect(normalizeLottiefilesGifName('animation.gif', 'idle')).toBe('idle.gif');
    expect(normalizeLottiefilesGifName('other.gif', 'idle')).toBeNull();
  });
});
