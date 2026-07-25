import type { ExtensionSettings, CatLifeStage, CatMood } from './types';
import { fallbackSpeech } from './speech-fallback';
import { ALARM_NAMES } from './types';
import { createMomentTimer } from './care-moment-timer';

const playingTimer = createMomentTimer(ALARM_NAMES.playingComplete, 5_000, 10_000);

export function pickPlayingDurationMs(_settings: ExtensionSettings, seed: number): number {
  return playingTimer.pickDurationMs(seed);
}

export const isPlayingActive = playingTimer.isActive;
export const playingMomentDue = playingTimer.momentDue;

export function playingWildSpeech(
  mood: CatMood,
  stage: CatLifeStage,
  seed: number,
): string {
  return fallbackSpeech({ kind: 'playing_wild', mood, stage, seed });
}

export function playingThanksSpeech(
  stage: CatLifeStage,
  seed: number,
): string {
  return fallbackSpeech({
    kind: 'playing_thanks',
    mood: 'happy',
    stage,
    seed,
  });
}

export const schedulePlayingCompleteAlarm = playingTimer.scheduleCompleteAlarm;
export const clearPlayingCompleteAlarm = playingTimer.clearCompleteAlarm;
