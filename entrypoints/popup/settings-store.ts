import type { ExtensionSettings } from '../../utils/types';

/** The one shared copy of "what settings does the popup currently think are saved" — almost
 * every module here reads or writes this, so it's a single store rather than each keeping its
 * own stale copy. */
let cachedSettings: ExtensionSettings;

export function getCachedSettings(): ExtensionSettings {
  return cachedSettings;
}

export function setCachedSettings(settings: ExtensionSettings): void {
  cachedSettings = settings;
}
