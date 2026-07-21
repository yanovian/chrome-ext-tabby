import { warmCompanionGifCache } from '../../utils/companion-gif-preload';
import { resetIntro } from '../../utils/intro';
import { loadLocaleFromSettings } from '../../utils/i18n';
import { ensureCatExists, showOverlayOnPage } from '../../utils/cat';
import { clearAllPageOverlayHides } from '../../utils/page-overlay';
import { ensureSettingsExist, getSettings, saveSettings } from '../../utils/settings';
import { canShowOverlayOnUrl } from '../../utils/overlay-inject';
import { ALARM_NAMES } from '../../utils/types';
import { focusActiveTab, updateToolbarFromPresentation } from './tab-activity';
import { retryActiveOverlaySync, syncOverlayToTab } from './overlay-sync';

const IS_DEV_BUILD = import.meta.env.DEV;

export async function scheduleTickAlarm(): Promise<void> {
  await browser.alarms.clear(ALARM_NAMES.tick);
  await browser.alarms.create(ALARM_NAMES.tick, { periodInMinutes: 1 });
}

/** Runs on every service-worker wake (install, update, browser startup) — cheap and
 * idempotent, so it's safe to call more often than strictly necessary. */
export async function bootstrap(): Promise<void> {
  await loadLocaleFromSettings(IS_DEV_BUILD);
  await ensureSettingsExist(IS_DEV_BUILD);
  await ensureCatExists(Date.now());
  await scheduleTickAlarm();

  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  await focusActiveTab(activeTab, Date.now());
  const settings = await getSettings(IS_DEV_BUILD);
  if (!settings.showOverlay) {
    await updateToolbarFromPresentation();
  }
}

/** Runs once, the first time the extension is installed — first-run setup on top of the
 * normal bootstrap, plus showing her immediately on whatever page the user installed from. */
export async function bootstrapInstall(): Promise<void> {
  void warmCompanionGifCache();
  const now = Date.now();
  await resetIntro();
  await saveSettings({ showOverlay: true }, IS_DEV_BUILD);
  await clearAllPageOverlayHides();
  await bootstrap();
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id || !canShowOverlayOnUrl(activeTab.url)) {
    return;
  }
  await showOverlayOnPage(now, {
    url: activeTab.url,
    title: activeTab.title,
  });
  await syncOverlayToTab(activeTab);
  await retryActiveOverlaySync();
}
