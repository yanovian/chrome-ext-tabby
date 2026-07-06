import type { ExtensionSettings, CatLifeStage, CatMood } from './types';
import { fallbackSpeech } from './speech-fallback';
import { ALARM_NAMES } from './types';

const PLAYING_MIN_MS = 5_000;
const PLAYING_MAX_MS = 10_000;

export function pickPlayingDurationMs(_settings: ExtensionSettings, seed: number): number {
  const span = PLAYING_MAX_MS - PLAYING_MIN_MS + 1;
  return PLAYING_MIN_MS + (Math.abs(seed) % span);
}

export function isPlayingActive(
  playingUntil: number | null | undefined,
  now: number,
): boolean {
  return playingUntil != null && now < playingUntil;
}

export function playingMomentDue(
  playingUntil: number | null | undefined,
  now: number,
): boolean {
  return playingUntil != null && now >= playingUntil;
}

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

export async function schedulePlayingCompleteAlarm(whenMs: number): Promise<void> {
  await browser.alarms.clear(ALARM_NAMES.playingComplete);
  await browser.alarms.create(ALARM_NAMES.playingComplete, { when: whenMs });
}

export async function clearPlayingCompleteAlarm(): Promise<void> {
  await browser.alarms.clear(ALARM_NAMES.playingComplete);
}
