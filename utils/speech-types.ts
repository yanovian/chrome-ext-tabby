import type { CatLifeStage, CatMood, SpeechTriggerKind } from './types';

export type SpeechKind =
  | SpeechTriggerKind
  | 'ask'
  | 'care_pet'
  | 'care_treat'
  | 'care_play'
  | 'dismiss';

/** Inputs for local speech generation — fully on-device, no network. */
export interface SpeechContext {
  kind: SpeechKind;
  mood: CatMood;
  stage: CatLifeStage;
  seed: number;
  pageTitle?: string;
  pageTopic?: string;
  memoryTopic?: string;
  milestoneDays?: number;
}

export const SPEECH_MODEL = 'Xenova/flan-t5-small' as const;

export const SPEECH_GENERATION_TIMEOUT_MS = 12_000;
