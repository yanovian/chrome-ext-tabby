import { STORAGE_KEYS } from './types';

/** Short first-meeting lines — one per step. */
export const INTRO_STEPS = [
  "Hi! I'm Tabby — your browser cat.",
  'I live here while you browse. Everything stays on your device.',
  'I stay off some sensitive sites.',
  "I'm off to play. Feed me or play with me sometimes, okay?",
] as const;

export const INTRO_SKIP_LABEL = 'I already know Tabby';

export function introStepText(step: number): string {
  const index = Math.max(0, Math.min(step, INTRO_STEPS.length - 1));
  return INTRO_STEPS[index] ?? INTRO_STEPS[0];
}

export function introNextLabel(step: number): string {
  return step >= INTRO_STEPS.length - 1 ? 'Got it' : 'Next';
}

export function introStepCount(): number {
  return INTRO_STEPS.length;
}

export async function isIntroCompleted(): Promise<boolean> {
  const stored = await browser.storage.local.get([STORAGE_KEYS.introCompleted]);
  return stored[STORAGE_KEYS.introCompleted] === true;
}

export async function markIntroCompleted(): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEYS.introCompleted]: true,
  });
}

export async function resetIntro(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEYS.introCompleted);
}
