import type { ExtensionSettings, CatLifeStage, CatMood } from './types';
import { fallbackSpeech } from './speech-fallback';
import { ALARM_NAMES } from './types';

const FEEDING_MIN_MS = 5_000;
const FEEDING_MAX_MS = 10_000;

export function pickFeedingDurationMs(_settings: ExtensionSettings, seed: number): number {
  const span = FEEDING_MAX_MS - FEEDING_MIN_MS + 1;
  return FEEDING_MIN_MS + (Math.abs(seed) % span);
}

export function isFeedingActive(
  eatingUntil: number | null | undefined,
  now: number,
): boolean {
  return eatingUntil != null && now < eatingUntil;
}

export function feedingMomentDue(
  eatingUntil: number | null | undefined,
  now: number,
): boolean {
  return eatingUntil != null && now >= eatingUntil;
}

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

export async function scheduleFeedingCompleteAlarm(whenMs: number): Promise<void> {
  await browser.alarms.clear(ALARM_NAMES.feedingComplete);
  await browser.alarms.create(ALARM_NAMES.feedingComplete, { when: whenMs });
}

export async function clearFeedingCompleteAlarm(): Promise<void> {
  await browser.alarms.clear(ALARM_NAMES.feedingComplete);
}
