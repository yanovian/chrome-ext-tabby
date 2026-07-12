import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { isRtlLocale } from '@/i18n/locales';

/** Sync `lang` and `dir` on `<html>` when the active locale changes (RTL for ar, fa, he). */
export function LocaleDirection() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const locale = i18n.resolvedLanguage ?? 'en';
    const dir = isRtlLocale(locale) ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [i18n.resolvedLanguage]);

  return null;
}
