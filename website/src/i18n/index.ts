import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import enSeo from '@/locales/en/seo.json';
import enCommon from '@/locales/en/common.json';
import enLegal from '@/locales/en/legal.json';

const SUPPORTED_LANGUAGES = ['en'] as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { seo: enSeo, common: enCommon, legal: enLegal },
    },
    ns: ['seo', 'common', 'legal'],
    defaultNS: 'seo',
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['htmlTag', 'navigator'],
      caches: [],
    },
  });

export { SUPPORTED_LANGUAGES };
export default i18n;
