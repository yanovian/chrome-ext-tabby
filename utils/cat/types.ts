import type { CareAction, CatPresentation, CatState, ExtensionSettings } from '../types';

export const IS_DEV_BUILD = import.meta.env.DEV;

export interface OrchestratorState {
  cat: CatState;
  settings: ExtensionSettings;
  isUserIdle: boolean;
  lastPresentation: CatPresentation | null;
}

export interface PageContext {
  title?: string;
  topic?: string;
  url?: string;
}

/**
 * Every kind of thing that can change what Tabby looks like right now. See reduceCat below —
 * this is the only way into it. (Two dev-only tools, syncDevTemperControls and
 * getDevTemperState, stay outside this union: they return a richer testing/preview payload
 * that doesn't fit "the next OrchestratorState," not a different presentation-computing
 * pathway — they still go through the same serialization queue as everything here.)
 */
export type CatEvent =
  | { type: 'careAction'; action: CareAction; now: number; page: PageContext }
  | {
      type: 'tick';
      now: number;
      page?: PageContext;
      forceDevSpeech?: boolean;
      forceTick?: boolean;
      isUserIdle?: boolean;
    }
  | { type: 'showOnPage'; now: number; page: PageContext }
  | { type: 'clearSpeech'; now: number }
  | { type: 'settleAfterIntro'; now: number }
  | { type: 'restartIntro'; now: number }
  | { type: 'devPreview'; now: number }
  | { type: 'devHide'; now: number };
