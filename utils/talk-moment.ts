import type { ExtensionSettings } from './types';
import { ALARM_NAMES } from './types';
import { createMomentTimer } from './care-moment-timer';

// Fixed, not a random range like feeding/playing: "how long to read a mood explanation"
// doesn't need per-line variance, just a firm cap so she doesn't talk forever if the bubble
// is never dismissed.
const TALK_DURATION_MS = 5_000;
const talkTimer = createMomentTimer(ALARM_NAMES.talkComplete, TALK_DURATION_MS, TALK_DURATION_MS);

export function pickTalkDurationMs(_settings: ExtensionSettings, seed: number): number {
  return talkTimer.pickDurationMs(seed);
}

export const isTalkActive = talkTimer.isActive;
export const talkMomentDue = talkTimer.momentDue;
export const scheduleTalkCompleteAlarm = talkTimer.scheduleCompleteAlarm;
export const clearTalkCompleteAlarm = talkTimer.clearCompleteAlarm;
