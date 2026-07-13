import { describe, expect, it } from 'vitest';
import { isEnteringPeekCycle, resolvePeekRestoreAmbient } from '../utils/peek-restore';
import type { CatPresentation } from '../utils/types';

const base: CatPresentation = {
  mood: 'content',
  stage: 'adult',
  stageLabel: 'Adult',
  sprite: 'gif/adult/idle.gif',
  speech: null,
  triggerKind: null,
  overlayHidden: false,
  canPet: true,
  canTreat: false,
  canPlay: false,
  interactions: [],
  secondaryInteractions: [],
  lastCareAction: null,
  companionVisible: true,
  ambientActivity: 'grooming',
  ambientPeekUntil: 1000,
  peekEdge: null,
  peekInset: null,
  peekCorner: null,
  peekRestoreAmbientActivity: null,
  peekRestoreAmbientUntil: null,
  stayVisibleUntil: null,
  eatingUntil: null,
  playingUntil: null,
};

describe('peek restore', () => {
  it('detects the first peek in a cycle', () => {
    expect(isEnteringPeekCycle(base, 'peeking', true)).toBe(true);
    expect(isEnteringPeekCycle({ ...base, ambientActivity: 'peeking' }, 'peeking', true)).toBe(
      false,
    );
  });

  it('saves ambient state when peek starts', () => {
    const restore = resolvePeekRestoreAmbient(base, true);
    expect(restore.peekRestoreAmbientActivity).toBe('grooming');
    expect(restore.peekRestoreAmbientUntil).toBe(1000);
  });

  it('keeps saved ambient state while peek continues', () => {
    const peeking: CatPresentation = {
      ...base,
      mood: 'peek',
      ambientActivity: 'peeking',
      peekRestoreAmbientActivity: 'grooming',
      peekRestoreAmbientUntil: 1000,
    };
    const restore = resolvePeekRestoreAmbient(peeking, false);
    expect(restore.peekRestoreAmbientActivity).toBe('grooming');
    expect(restore.peekRestoreAmbientUntil).toBe(1000);
  });
});
