import { DEFAULT_SETTINGS, STORAGE_KEYS } from './types';
import type { DevLifeStageOverride, ExtensionSettings } from './types';

function parseDevLifeStage(value: unknown): DevLifeStageOverride {
  if (
    value === 'auto' ||
    value === 'newborn' ||
    value === 'playful' ||
    value === 'adult'
  ) {
    return value;
  }
  return DEFAULT_SETTINGS.devForceLifeStage;
}

function clampHour(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(23, Math.floor(value)));
}

function clampPositiveInt(value: number, fallback: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.floor(value)));
}

/** Merge stored (possibly partial) settings with defaults. */
export function mergeSettings(
  partial: Partial<ExtensionSettings> | undefined,
  isDevBuild = false,
): ExtensionSettings {
  const raw = partial ?? {};
  return {
    readPageContent:
      typeof raw.readPageContent === 'boolean'
        ? raw.readPageContent
        : DEFAULT_SETTINGS.readPageContent,
    pageTextMaxChars: clampPositiveInt(
      Number(raw.pageTextMaxChars ?? DEFAULT_SETTINGS.pageTextMaxChars),
      DEFAULT_SETTINGS.pageTextMaxChars,
      8000,
    ),
    quietHoursStart: clampHour(
      Number(raw.quietHoursStart ?? DEFAULT_SETTINGS.quietHoursStart),
      DEFAULT_SETTINGS.quietHoursStart,
    ),
    quietHoursEnd: clampHour(
      Number(raw.quietHoursEnd ?? DEFAULT_SETTINGS.quietHoursEnd),
      DEFAULT_SETTINGS.quietHoursEnd,
    ),
    maxAppearancesPerDay: clampPositiveInt(
      Number(raw.maxAppearancesPerDay ?? DEFAULT_SETTINGS.maxAppearancesPerDay),
      DEFAULT_SETTINGS.maxAppearancesPerDay,
      20,
    ),
    appearanceCooldownMinutes: clampPositiveInt(
      Number(
        raw.appearanceCooldownMinutes ?? DEFAULT_SETTINGS.appearanceCooldownMinutes,
      ),
      DEFAULT_SETTINGS.appearanceCooldownMinutes,
      240,
    ),
    devModeEnabled: isDevBuild
      ? typeof raw.devModeEnabled === 'boolean'
        ? raw.devModeEnabled
        : true
      : false,
    devMaxAppearancesPerDay: clampPositiveInt(
      Number(raw.devMaxAppearancesPerDay ?? DEFAULT_SETTINGS.devMaxAppearancesPerDay),
      DEFAULT_SETTINGS.devMaxAppearancesPerDay,
      200,
    ),
    devAppearanceCooldownMinutes: clampPositiveInt(
      Number(
        raw.devAppearanceCooldownMinutes ??
          DEFAULT_SETTINGS.devAppearanceCooldownMinutes,
      ),
      DEFAULT_SETTINGS.devAppearanceCooldownMinutes,
      60,
    ),
    devStatMultiplier: clampPositiveInt(
      Number(raw.devStatMultiplier ?? DEFAULT_SETTINGS.devStatMultiplier),
      DEFAULT_SETTINGS.devStatMultiplier,
      20,
    ),
    devMinTabDurationMs: clampPositiveInt(
      Number(raw.devMinTabDurationMs ?? DEFAULT_SETTINGS.devMinTabDurationMs),
      DEFAULT_SETTINGS.devMinTabDurationMs,
      10_000,
    ),
    devForceLifeStage: parseDevLifeStage(raw.devForceLifeStage),
    showOverlay:
      typeof raw.showOverlay === 'boolean'
        ? raw.showOverlay
        : DEFAULT_SETTINGS.showOverlay,
    localSpeechEnabled:
      typeof raw.localSpeechEnabled === 'boolean'
        ? raw.localSpeechEnabled
        : DEFAULT_SETTINGS.localSpeechEnabled,
  };
}

export function effectiveAppearanceLimits(settings: ExtensionSettings): {
  maxPerDay: number;
  cooldownMinutes: number;
  statMultiplier: number;
  minTabDurationMs: number;
} {
  if (settings.devModeEnabled) {
    return {
      maxPerDay: settings.devMaxAppearancesPerDay,
      cooldownMinutes: settings.devAppearanceCooldownMinutes,
      statMultiplier: settings.devStatMultiplier,
      minTabDurationMs: settings.devMinTabDurationMs,
    };
  }

  return {
    maxPerDay: settings.maxAppearancesPerDay,
    cooldownMinutes: settings.appearanceCooldownMinutes,
    statMultiplier: 1,
    minTabDurationMs: 5000,
  };
}

export function isQuietHour(hour: number, settings: ExtensionSettings): boolean {
  const { quietHoursStart, quietHoursEnd } = settings;
  if (quietHoursStart === quietHoursEnd) {
    return false;
  }
  if (quietHoursStart < quietHoursEnd) {
    return hour >= quietHoursStart && hour < quietHoursEnd;
  }
  return hour >= quietHoursStart || hour < quietHoursEnd;
}

async function readLocal<T>(key: string): Promise<T | undefined> {
  const result = await browser.storage.local.get([key]);
  return result[key] as T | undefined;
}

async function writeLocal(key: string, value: unknown): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export async function getSettings(isDevBuild = false): Promise<ExtensionSettings> {
  return mergeSettings(
    await readLocal<Partial<ExtensionSettings>>(STORAGE_KEYS.settings),
    isDevBuild,
  );
}

export async function saveSettings(
  partial: Partial<ExtensionSettings>,
  isDevBuild = false,
): Promise<ExtensionSettings> {
  const current = await getSettings(isDevBuild);
  const merged = mergeSettings({ ...current, ...partial }, isDevBuild);
  await writeLocal(STORAGE_KEYS.settings, merged);
  return merged;
}

export async function ensureSettingsExist(isDevBuild = false): Promise<void> {
  const stored = await readLocal<Partial<ExtensionSettings>>(STORAGE_KEYS.settings);
  if (stored === undefined) {
    await writeLocal(STORAGE_KEYS.settings, mergeSettings(undefined, isDevBuild));
  }
}
