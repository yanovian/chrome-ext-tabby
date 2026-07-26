import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REAL_CAT_HOLD_MS,
  isEnteringShooDuckGap,
  pickRealCatPhoto,
  realCatAssetPath,
  REAL_CAT_PHOTOS,
} from '../utils/real-cats';

describe('REAL_CAT_PHOTOS manifest', () => {
  it('has at least one photo per shipped file', () => {
    expect(REAL_CAT_PHOTOS.length).toBeGreaterThan(0);
    for (const photo of REAL_CAT_PHOTOS) {
      expect(photo.file).toMatch(/\.png$/);
    }
  });

  it('gives funny-cat-b-3 the shortest hold of the four, the rest the (much longer) default', () => {
    const b3 = REAL_CAT_PHOTOS.find((photo) => photo.file === 'funny-cat-b-3.png')!;
    const others = REAL_CAT_PHOTOS.filter((photo) => photo.file !== 'funny-cat-b-3.png');

    expect(b3.holdMs).toBeDefined();
    for (const photo of others) {
      expect(photo.holdMs ?? DEFAULT_REAL_CAT_HOLD_MS).toBeGreaterThan(b3.holdMs!);
    }
  });

  it('scales funny-cat-b-3 down and funny-cat-bl-1 up to even out their on-screen size', () => {
    const b3 = REAL_CAT_PHOTOS.find((photo) => photo.file === 'funny-cat-b-3.png')!;
    const bl1 = REAL_CAT_PHOTOS.find((photo) => photo.file === 'funny-cat-bl-1.png')!;

    expect(b3.scale ?? 1).toBeLessThan(1);
    expect(bl1.scale ?? 1).toBeGreaterThan(1);
  });
});

describe('realCatAssetPath', () => {
  it('points into the real-cats public folder', () => {
    expect(realCatAssetPath('funny-cat-b-1.png')).toBe('real-cats/funny-cat-b-1.png');
  });
});

describe('pickRealCatPhoto', () => {
  it('only ever picks a slot the photo\'s token actually covers', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const placement = pickRealCatPhoto({ seed, stage: 'adult' });
      expect(placement).not.toBeNull();
      const photo = REAL_CAT_PHOTOS.find((p) => p.file === placement!.file)!;
      const validSlots =
        photo.token === 'b'
          ? ['bl', 'br']
          : photo.token === 'l'
            ? ['bl', 'lb', 'lt']
            : photo.token === 'r'
              ? ['br', 'rb', 'rt']
              : [photo.token];
      expect(validSlots).toContain(placement!.slot);
    }
  });

  it('never lands on a corner the current host blocks', () => {
    // pooyan.info blocks br/rb (see corner-avoidance.ts) — every candidate for a 'b'-token
    // photo must resolve to bl only, never br.
    for (let seed = 0; seed < 50; seed += 1) {
      const placement = pickRealCatPhoto({ seed, stage: 'adult', hostname: 'pooyan.info' });
      expect(placement?.slot).not.toBe('br');
    }
  });

  it('forces a specific photo when forcedFile is set, ignoring the random pick', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const placement = pickRealCatPhoto({
        seed,
        stage: 'adult',
        forcedFile: 'funny-cat-bl-1.png',
      });
      expect(placement?.file).toBe('funny-cat-bl-1.png');
      expect(placement?.slot).toBe('bl');
    }
  });

  it('returns null when the forced photo has no safe corner left on this host', () => {
    // The bl-1 photo only ever resolves to slot 'bl'. A host that blocks 'bl' specifically
    // (via the 'l' group, which covers bl/lb/lt) leaves it with nowhere to go.
    const placement = pickRealCatPhoto({
      seed: 1,
      stage: 'adult',
      forcedFile: 'funny-cat-bl-1.png',
      hostname: 'canva.com',
    });
    expect(placement).toBeNull();
  });

  it('excludes photos restricted to a different life stage', () => {
    const kittenOnly = [{ file: 'kitten-only.png', token: 'bl' as const, stages: ['newborn'] as const }];

    expect(pickRealCatPhoto({ seed: 0, stage: 'adult' }, kittenOnly)).toBeNull();
    expect(pickRealCatPhoto({ seed: 0, stage: 'newborn' }, kittenOnly)?.file).toBe('kitten-only.png');
  });

  it('treats a photo with no stages restriction as valid at every stage', () => {
    const anyStage = [{ file: 'any-stage.png', token: 'bl' as const }];
    for (const stage of ['newborn', 'playful', 'adult'] as const) {
      expect(pickRealCatPhoto({ seed: 0, stage }, anyStage)?.file).toBe('any-stage.png');
    }
  });

  it('uses a photo\'s own holdMs when it has one', () => {
    const custom = [{ file: 'lingers.png', token: 'bl' as const, holdMs: 12_000 }];
    expect(pickRealCatPhoto({ seed: 0, stage: 'adult' }, custom)?.holdMs).toBe(12_000);
  });

  it('falls back to DEFAULT_REAL_CAT_HOLD_MS when a photo has no holdMs of its own', () => {
    const plain = [{ file: 'quick.png', token: 'bl' as const }];
    expect(pickRealCatPhoto({ seed: 0, stage: 'adult' }, plain)?.holdMs).toBe(DEFAULT_REAL_CAT_HOLD_MS);
  });

  it('uses a photo\'s own scale when it has one', () => {
    const custom = [{ file: 'big.png', token: 'bl' as const, scale: 1.4 }];
    expect(pickRealCatPhoto({ seed: 0, stage: 'adult' }, custom)?.scale).toBe(1.4);
  });

  it('falls back to a scale of 1 when a photo has no scale of its own', () => {
    const plain = [{ file: 'plain.png', token: 'bl' as const }];
    expect(pickRealCatPhoto({ seed: 0, stage: 'adult' }, plain)?.scale).toBe(1);
  });
});

describe('isEnteringShooDuckGap', () => {
  const base = {
    companionVisible: false,
    ambientActivity: 'peeking' as const,
    ambientPeekUntil: 2000,
    lastCareAction: 'shoo' as const,
  };

  it('is true exactly when a shoo-triggered peek visit just ducked away', () => {
    expect(
      isEnteringShooDuckGap(base, { companionVisible: true, ambientPeekUntil: null }),
    ).toBe(true);
  });

  it('is false for an ordinary ambient duck (never shooed)', () => {
    expect(
      isEnteringShooDuckGap(
        { ...base, lastCareAction: null },
        { companionVisible: true, ambientPeekUntil: null },
      ),
    ).toBe(false);
  });

  it('is false while still visible', () => {
    expect(
      isEnteringShooDuckGap(
        { ...base, companionVisible: true },
        { companionVisible: true, ambientPeekUntil: null },
      ),
    ).toBe(false);
  });

  it('is false for a re-render of the same duck gap already scheduled', () => {
    expect(
      isEnteringShooDuckGap(base, { companionVisible: false, ambientPeekUntil: base.ambientPeekUntil }),
    ).toBe(false);
  });

  it('is false once she is peeking again (not a duck gap)', () => {
    expect(
      isEnteringShooDuckGap(
        { ...base, companionVisible: true, ambientActivity: 'peeking' },
        { companionVisible: false, ambientPeekUntil: 1000 },
      ),
    ).toBe(false);
  });
});
