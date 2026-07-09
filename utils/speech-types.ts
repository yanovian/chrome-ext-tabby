import type { CatLifeStage, CatMood, SpeechTriggerKind } from './types';

export type SpeechKind =
  | SpeechTriggerKind
  | 'overwhelmed_social'
  | 'overwhelmed_news'
  | 'ask'
  | 'peeking'
  | 'care_pet'
  | 'care_pet_hungry'
  | 'care_treat'
  | 'care_play'
  | 'dismiss'
  | 'feeding_munch'
  | 'feeding_thanks'
  | 'playing_wild'
  | 'playing_thanks';

/** Inputs for curated speech line selection. */
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
