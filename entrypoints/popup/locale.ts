import { applyDataI18n, applyDocumentLocale, loadAppLocale, t } from '../../utils/i18n';
import { APP_LOCALES, LOCALE_FLAGS, LOCALE_LABELS } from '../../utils/locale-registry';
import { requestSaveSettings } from '../../utils/runtime-client';
import { localeSelect } from './dom-refs';
import { setCachedSettings } from './settings-store';
import { refreshOverlayButtons } from './overlay-actions';
import { refreshDoNotDisturbSection } from './dnd-actions';

export function populateLocaleSelect(select: HTMLSelectElement, current: string): void {
  select.replaceChildren();
  for (const code of APP_LOCALES) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = `${LOCALE_FLAGS[code]} ${LOCALE_LABELS[code]}`;
    select.appendChild(option);
  }
  if (APP_LOCALES.includes(current as (typeof APP_LOCALES)[number])) {
    select.value = current;
  }
}

export async function applyPopupLocale(locale: string): Promise<void> {
  await loadAppLocale(locale);
  applyDocumentLocale();
  applyDataI18n();
  document.title = `${t('settings.title')} settings`;
}

export function bindLocaleControl(): void {
  localeSelect.addEventListener('change', () => {
    void (async () => {
      const nextLocale = localeSelect.value;
      await applyPopupLocale(nextLocale);
      const saved = await requestSaveSettings({ locale: nextLocale }, { skipPresent: false });
      setCachedSettings(saved);
      await refreshDoNotDisturbSection();
      await refreshOverlayButtons(saved);
    })();
  });
}
