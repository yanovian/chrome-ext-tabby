import { DEFAULT_SETTINGS, STORAGE_KEYS } from './types';
import { MOOD_TIMER_DEV_DEFAULTS, MOOD_TIMER_SLIDER_BOUNDS } from './mood-timers';
import { normalizeLocaleTag } from './locale-registry';
import type {
  CatMood,
  DevLifeStageOverride,
  DevMoodOverride,
  DevTemperScenario,
  ExtensionSettings,
} from './types';
import { MIN_PAGE_DWELL_MS } from './visit-dedup';

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

function parseDevMood(value: unknown): DevMoodOverride {
  const moods: CatMood[] = [
    'content',
    'happy',
    'curious',
    'hungry',
    'starving',
    'stressed',
    'sleepy',
    'peek',
    'overwhelmed',
  ];
  if (value === 'auto' || moods.includes(value as CatMood)) {
    return value as DevMoodOverride;
  }
  return DEFAULT_SETTINGS.devForceMood;
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

function clampTemperMs(
  value: number,
  fallback: number,
  bounds: { min: number; max: number; step: number },
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const stepped = Math.round(value / bounds.step) * bounds.step;
  return Math.max(bounds.min, Math.min(bounds.max, stepped));
}

function parseDevTemperScenario(value: unknown): DevTemperScenario {
  return value === 'away_from_feed' ? 'away_from_feed' : 'on_feed';
}

/** Merge stored (possibly partial) settings with defaults. */
export function mergeSettings(
  partial: Partial<ExtensionSettings> | undefined,
  isDevBuild = false,
): ExtensionSettings {
  const raw = partial ?? {};
  return {
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
      12,
    ),
    appearanceCooldownMinutes: Math.max(
      10,
      clampPositiveInt(
        Number(
          raw.appearanceCooldownMinutes ?? DEFAULT_SETTINGS.appearanceCooldownMinutes,
        ),
        DEFAULT_SETTINGS.appearanceCooldownMinutes,
        180,
      ),
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
    devForceMood: parseDevMood(raw.devForceMood),
    devOverwhelmedThresholdMs: MOOD_TIMER_DEV_DEFAULTS.overwhelmedThresholdMs,
    devRecoveryThanksThresholdMs: MOOD_TIMER_DEV_DEFAULTS.recoveryThanksThresholdMs,
    devStressedVitalThreshold: MOOD_TIMER_DEV_DEFAULTS.stressedVitalThreshold,
    devTemperScenario: parseDevTemperScenario(raw.devTemperScenario),
    devSimulatedDrainingMs: clampTemperMs(
      Number(raw.devSimulatedDrainingMs ?? DEFAULT_SETTINGS.devSimulatedDrainingMs),
      DEFAULT_SETTINGS.devSimulatedDrainingMs,
      MOOD_TIMER_SLIDER_BOUNDS.simulatedDrainingMs,
    ),
    devSimulatedRecoveryAwayMs: clampTemperMs(
      Number(
        raw.devSimulatedRecoveryAwayMs ?? DEFAULT_SETTINGS.devSimulatedRecoveryAwayMs,
      ),
      DEFAULT_SETTINGS.devSimulatedRecoveryAwayMs,
      MOOD_TIMER_SLIDER_BOUNDS.simulatedRecoveryAwayMs,
    ),
    showOverlay:
      typeof raw.showOverlay === 'boolean'
        ? raw.showOverlay
        : DEFAULT_SETTINGS.showOverlay,
    locale:
      typeof raw.locale === 'string'
        ? normalizeLocaleTag(raw.locale)
        : DEFAULT_SETTINGS.locale,
  };
}

export function effectiveAppearanceLimits(settings: ExtensionSettings): {
  maxPerDay: number;
  cooldownMinutes: number;
  statMultiplier: number;
  minPageDwellMs: number;
} {
  if (settings.devModeEnabled) {
    return {
      maxPerDay: settings.devMaxAppearancesPerDay,
      cooldownMinutes: settings.devAppearanceCooldownMinutes,
      statMultiplier: settings.devStatMultiplier,
      minPageDwellMs: settings.devMinTabDurationMs,
    };
  }

  return {
    maxPerDay: settings.maxAppearancesPerDay,
    cooldownMinutes: settings.appearanceCooldownMinutes,
    statMultiplier: 1,
    minPageDwellMs: MIN_PAGE_DWELL_MS,
  };
}

/** Dev overrides that change sprite or on-screen size need a fresh presentation. */
export function settingsChangeRequiresPresent(
  before: ExtensionSettings,
  after: ExtensionSettings,
): boolean {
  return (
    before.devForceLifeStage !== after.devForceLifeStage ||
    before.devForceMood !== after.devForceMood ||
    before.devModeEnabled !== after.devModeEnabled ||
    before.locale !== after.locale
  );
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

/** Dev mode is overriding the displayed mood (e.g. forcing a peek preview). */
export function isDevMoodForced(
  settings: ExtensionSettings,
): settings is ExtensionSettings & { devForceMood: CatMood } {
  return settings.devModeEnabled && settings.devForceMood !== 'auto';
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
