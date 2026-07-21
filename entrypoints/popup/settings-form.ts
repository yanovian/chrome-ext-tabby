import { requestPresentation, requestSaveSettings } from '../../utils/runtime-client';
import { settingsChangeRequiresPresent } from '../../utils/settings';
import { t } from '../../utils/i18n';
import type { ExtensionSettings } from '../../utils/types';
import { fields, localeSelect } from './dom-refs';
import { getCachedSettings, setCachedSettings } from './settings-store';
import { populateLocaleSelect, applyPopupLocale } from './locale';
import { updatePreviewCat } from './preview-cat';
import { showStatus } from './status';
// refreshOverlayButtons (overlay-actions.ts) also calls back into fillForm/readPartialSettings
// here — both sides are function declarations only invoked from event handlers, never at
// module-init time, so the cycle never actually runs during either module's own evaluation.
import { refreshOverlayButtons } from './overlay-actions';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function fillForm(settings: ExtensionSettings): void {
  setCachedSettings(settings);
  populateLocaleSelect(localeSelect, settings.locale);
  fields.quietStart.value = String(settings.quietHoursStart);
  fields.quietEnd.value = String(settings.quietHoursEnd);
  fields.maxAppearances.value = String(settings.maxAppearancesPerDay);
  fields.cooldownMinutes.value = String(settings.appearanceCooldownMinutes);
  fields.devModeEnabled.checked = settings.devModeEnabled;
  fields.devMaxAppearances.value = String(settings.devMaxAppearancesPerDay);
  fields.devCooldownMinutes.value = String(settings.devAppearanceCooldownMinutes);
  fields.devStatMultiplier.value = String(settings.devStatMultiplier);
  fields.devMinTabMs.value = String(settings.devMinTabDurationMs);
  fields.devForceLifeStage.value = settings.devForceLifeStage;
  fields.devForceMood.value = settings.devForceMood;
}

export function readPartialSettings(): Partial<ExtensionSettings> {
  const cachedSettings = getCachedSettings();
  return {
    locale: localeSelect.value,
    showOverlay: cachedSettings.showOverlay,
    quietHoursStart: Number(fields.quietStart.value),
    quietHoursEnd: Number(fields.quietEnd.value),
    maxAppearancesPerDay: Number(fields.maxAppearances.value),
    appearanceCooldownMinutes: Number(fields.cooldownMinutes.value),
    devModeEnabled: fields.devModeEnabled.checked,
    devMaxAppearancesPerDay: Number(fields.devMaxAppearances.value),
    devAppearanceCooldownMinutes: Number(fields.devCooldownMinutes.value),
    devStatMultiplier: Number(fields.devStatMultiplier.value),
    devMinTabDurationMs: Number(fields.devMinTabMs.value),
    devForceLifeStage: fields.devForceLifeStage.value as ExtensionSettings['devForceLifeStage'],
  };
}

export function scheduleSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    void (async () => {
      const before = getCachedSettings();
      const saved = await requestSaveSettings(readPartialSettings(), { skipPresent: true });
      setCachedSettings(saved);
      if (before.locale !== saved.locale) {
        await applyPopupLocale(saved.locale);
      }
      fillForm(saved);
      if (settingsChangeRequiresPresent(before, saved)) {
        const presentation = await requestPresentation();
        await updatePreviewCat(presentation.sprite, {
          force: true,
          stage: presentation.stage,
        });
      }
      await refreshOverlayButtons(saved);
      showStatus(t('settings.saved'));
    })();
  }, 350);
}
