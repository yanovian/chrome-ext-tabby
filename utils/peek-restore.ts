import type { AmbientActivity } from './ambient-presence';
import type { CatPresentation } from './types';

export function isEnteringPeekCycle(
  last: CatPresentation | null,
  ambientActivity: AmbientActivity | null,
  companionVisible: boolean,
): boolean {
  return (
    companionVisible &&
    ambientActivity === 'peeking' &&
    last?.ambientActivity !== 'peeking'
  );
}

/** Ambient state to restore after the user taps a peek. */
export function resolvePeekRestoreAmbient(
  last: CatPresentation | null,
  enteringPeek: boolean,
): {
  peekRestoreAmbientActivity: AmbientActivity | null;
  peekRestoreAmbientUntil: number | null;
} {
  if (!enteringPeek) {
    return {
      peekRestoreAmbientActivity: last?.peekRestoreAmbientActivity ?? null,
      peekRestoreAmbientUntil: last?.peekRestoreAmbientUntil ?? null,
    };
  }

  if (!last || last.ambientActivity === 'peeking') {
    return {
      peekRestoreAmbientActivity: last?.peekRestoreAmbientActivity ?? null,
      peekRestoreAmbientUntil: last?.peekRestoreAmbientUntil ?? null,
    };
  }

  return {
    peekRestoreAmbientActivity: last.ambientActivity,
    peekRestoreAmbientUntil: last.ambientPeekUntil,
  };
}
