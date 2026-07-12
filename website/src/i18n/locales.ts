/** Keep in sync with `scripts/generate-locales.mjs` (Chrome Web Store locales). */
export const WEBSITE_LOCALES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt_BR',
  'nl',
  'pl',
  'ru',
  'uk',
  'tr',
  'ar',
  'fa',
  'hi',
  'bn',
  'ta',
  'ja',
  'ko',
  'zh_CN',
  'vi',
  'th',
  'id',
  'ms',
  'fil',
  'sw',
  'sv',
  'da',
  'no',
  'fi',
  'cs',
  'sk',
  'hu',
  'ro',
  'bg',
  'el',
  'hr',
  'sr',
  'ca',
] as const;

export type WebsiteLocale = (typeof WEBSITE_LOCALES)[number];

export const RTL_LOCALES = new Set<WebsiteLocale>(['ar', 'fa']);

export const LOCALE_LABELS: Record<WebsiteLocale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt_BR: 'Português (Brasil)',
  nl: 'Nederlands',
  pl: 'Polski',
  ru: 'Русский',
  uk: 'Українська',
  tr: 'Türkçe',
  ar: 'العربية',
  fa: 'فارسی',
  hi: 'हिन्दी',
  bn: 'বাংলা',
  ta: 'தமிழ்',
  ja: '日本語',
  ko: '한국어',
  zh_CN: '简体中文',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  fil: 'Filipino',
  sw: 'Kiswahili',
  sv: 'Svenska',
  da: 'Dansk',
  no: 'Norsk',
  fi: 'Suomi',
  cs: 'Čeština',
  sk: 'Slovenčina',
  hu: 'Magyar',
  ro: 'Română',
  bg: 'Български',
  el: 'Ελληνικά',
  hr: 'Hrvatski',
  sr: 'Српски',
  ca: 'Català',
};

export const LANGUAGE_STORAGE_KEY = 'tabby-website-lang';

export function isWebsiteLocale(value: string): value is WebsiteLocale {
  return (WEBSITE_LOCALES as readonly string[]).includes(value);
}

export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.has(locale as WebsiteLocale);
}

/** BCP 47 tag for hreflang and OG locale (e.g. pt_BR → pt-BR). */
export function hreflangTag(locale: WebsiteLocale): string {
  return locale.replace('_', '-');
}

export function ogLocaleTag(locale: WebsiteLocale): string {
  if (locale === 'en') {
    return 'en_US';
  }
  const [lang, region] = locale.split('_');
  return region ? `${lang}_${region.toUpperCase()}` : `${lang}_${lang.toUpperCase()}`;
}
