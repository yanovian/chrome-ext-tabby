import type { ExtensionSettings, CatLifeStage, CatMood } from './types';
import { fallbackSpeech } from './speech-fallback';
import { ALARM_NAMES } from './types';
import { createMomentTimer } from './care-moment-timer';

const feedingTimer = createMomentTimer(ALARM_NAMES.feedingComplete, 5_000, 10_000);

export function pickFeedingDurationMs(_settings: ExtensionSettings, seed: number): number {
  return feedingTimer.pickDurationMs(seed);
}

export const isFeedingActive = feedingTimer.isActive;
export const feedingMomentDue = feedingTimer.momentDue;

export function wasHungryEnoughForFeedingMoment(mood: CatMood): boolean {
  return mood === 'hungry' || mood === 'starving';
}

export function shouldStartFeedingMoment(
  derivedMoodBeforeCare: CatMood,
  displayMoodBeforeCare: CatMood | undefined,
): boolean {
  if (wasHungryEnoughForFeedingMoment(derivedMoodBeforeCare)) {
    return true;
  }
  if (displayMoodBeforeCare) {
    return wasHungryEnoughForFeedingMoment(displayMoodBeforeCare);
  }
  return false;
}

export function feedingMunchSpeech(
  mood: CatMood,
  stage: CatLifeStage,
  seed: number,
): string {
  return fallbackSpeech({ kind: 'feeding_munch', mood, stage, seed });
}

export function feedingThanksSpeech(
  stage: CatLifeStage,
  seed: number,
): string {
  return fallbackSpeech({
    kind: 'feeding_thanks',
    mood: 'happy',
    stage,
    seed,
  });
}

export const scheduleFeedingCompleteAlarm = feedingTimer.scheduleCompleteAlarm;
export const clearFeedingCompleteAlarm = feedingTimer.clearCompleteAlarm;
