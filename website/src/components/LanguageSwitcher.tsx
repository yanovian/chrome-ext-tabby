import { useTranslation } from 'react-i18next';
import {
  LOCALE_LABELS,
  WEBSITE_LOCALES,
  type WebsiteLocale,
  isWebsiteLocale,
} from '@/i18n/locales';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation('marketing');
  const current = isWebsiteLocale(i18n.resolvedLanguage ?? 'en')
    ? i18n.resolvedLanguage
    : 'en';

  return (
    <div className="language-switcher">
      <label className="language-switcher__label" htmlFor="tabby-language">
        {t('languageLabel')}
      </label>
      <select
        id="tabby-language"
        className="language-switcher__select"
        value={current}
        onChange={(event) => {
          void i18n.changeLanguage(event.target.value);
        }}
      >
        {WEBSITE_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_LABELS[locale as WebsiteLocale]}
          </option>
        ))}
      </select>
    </div>
  );
}
