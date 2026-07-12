import { describe, expect, it } from 'vitest';
import {
  brandName,
  getAppLocale,
  loadAppLocale,
  t,
  tLines,
} from '../utils/i18n';
import { LOCALE_BRANDS } from '../utils/locale-registry';

describe('i18n', () => {
  it('defaults to English', () => {
    expect(getAppLocale()).toBe('en');
    expect(brandName()).toBe('Tabby');
  });

  it('loads Armenian with a transliterated brand name', async () => {
    await loadAppLocale('hy');
    expect(getAppLocale()).toBe('hy');
    expect(brandName()).toBe('Տաբբի');
    expect(t('care.pet')).toMatch(/Գուրգուր/);
    await loadAppLocale('en');
  });

  it('returns speech lines for a mood', () => {
    const lines = tLines('speech.hungry');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toMatch(/hungry|peckish|mew/i);
  });

  it('interpolates placeholders', () => {
    expect(t('care.feedBrand', { brand: 'Տաբբի' })).toContain('Տաբբի');
  });

  it('uses transliterated brand names outside English', () => {
    for (const [code, brand] of Object.entries(LOCALE_BRANDS)) {
      if (code === 'en') {
        expect(brand).toBe('Tabby');
      } else {
        expect(brand).not.toMatch(/\bTabby\b/);
      }
    }
  });

  it('loads Farsi mood speech without English cat-sound leftovers', async () => {
    await loadAppLocale('fa');
    const starving = tLines('speech.starving');
    expect(starving.some((line) => line.includes('کاسه'))).toBe(true);
    expect(starving.join(' ')).not.toMatch(/Mrrp|f\*\*\*|Tabby|unprompted/i);
    const munch = tLines('speech.feeding_munch');
    expect(munch.join(' ')).toMatch(/نُم|قُرقُر|لپ/);
    const stressed = tLines('speech.stressed');
    expect(stressed.some((line) => line.includes('لع*نت'))).toBe(true);
    await loadAppLocale('en');
  });
});
