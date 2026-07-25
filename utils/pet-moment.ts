import type { ExtensionSettings } from './types';
import { ALARM_NAMES } from './types';
import { createMomentTimer } from './care-moment-timer';

// A quick, obvious reaction, not a full moment like feeding/playing — petting is the
// gentlest of the three care actions, so its animation window is the shortest. Fixed (not a
// random range like feeding/playing) and pinned to the pet clip's actual length — 48 frames
// @ 30fps (scripts/generate-scaffold-animations.mjs, state === 'pet') — so the reaction
// always plays its full lean-in/lean-out: never cut off mid-motion, never lingering after
// it's done.
const PET_ANIMATION_FRAMES = 48;
const PET_ANIMATION_FPS = 30;
const PETTING_DURATION_MS = (PET_ANIMATION_FRAMES / PET_ANIMATION_FPS) * 1000;

const pettingTimer = createMomentTimer(
  ALARM_NAMES.pettingComplete,
  PETTING_DURATION_MS,
  PETTING_DURATION_MS,
);

export function pickPettingDurationMs(_settings: ExtensionSettings, seed: number): number {
  return pettingTimer.pickDurationMs(seed);
}

export const isPettingActive = pettingTimer.isActive;
export const pettingMomentDue = pettingTimer.momentDue;
export const schedulePettingCompleteAlarm = pettingTimer.scheduleCompleteAlarm;
export const clearPettingCompleteAlarm = pettingTimer.clearCompleteAlarm;
