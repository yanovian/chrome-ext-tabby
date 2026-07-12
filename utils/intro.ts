import { t, tLines } from './i18n';
import { STORAGE_KEYS } from './types';

export function introStepText(step: number): string {
  const steps = tLines('intro');
  const index = Math.max(0, Math.min(step, steps.length - 1));
  return steps[index] ?? steps[0] ?? '';
}

export function introSkipLabel(): string {
  return t('overlay.introSkip');
}

export function introNextLabel(step: number): string {
  return step >= introStepCount() - 1 ? t('overlay.introDone') : t('overlay.introNext');
}

export function introStepCount(): number {
  return tLines('intro').length;
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
