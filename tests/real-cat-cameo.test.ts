import { afterEach, describe, expect, it, vi } from 'vitest';
import { enterTransformFor, RealCatCameoController } from '../entrypoints/content/overlay/real-cat-cameo';
import { DEFAULT_SETTINGS } from '../utils/types';
import type { CatPresentation } from '../utils/types';

describe('enterTransformFor', () => {
  it('slides bl/br up from the bottom for a "b" group photo (not composed for one specific corner)', () => {
    expect(enterTransformFor('bl', 'b')).toBe('translateY(115%)');
    expect(enterTransformFor('br', 'b')).toBe('translateY(115%)');
  });

  it('slides in from the left only when the slot AND the photo\'s own token are exactly bl', () => {
    expect(enterTransformFor('bl', 'bl')).toBe('translateX(-115%)');
  });

  it('slides in from the right only when the slot AND the photo\'s own token are exactly br', () => {
    expect(enterTransformFor('br', 'br')).toBe('translateX(115%)');
  });

  it('still slides bl up from the bottom for a photo composed for the other bottom corner (br)', () => {
    // Guards against matching on "any concrete bl/br token", not the exact resolved slot.
    expect(enterTransformFor('bl', 'br')).toBe('translateY(115%)');
    expect(enterTransformFor('br', 'bl')).toBe('translateY(115%)');
  });

  it('always slides left-edge slots from the left and right-edge slots from the right', () => {
    expect(enterTransformFor('lb', 'l')).toBe('translateX(-115%)');
    expect(enterTransformFor('lt', 'l')).toBe('translateX(-115%)');
    expect(enterTransformFor('rb', 'r')).toBe('translateX(115%)');
    expect(enterTransformFor('rt', 'r')).toBe('translateX(115%)');
  });
});

// Exercises only the scheduling/cancellation logic (setTimeout/clearTimeout bookkeeping), not
// the actual DOM mount — this project's tests run in a Node environment with no `document`,
// and the pure "should a cameo start here at all" decision is already covered end to end by
// isEnteringShooDuckGap in real-cats.test.ts. As long as fake timers are never advanced past
// the scheduled delay, the DOM-touching show() callback never actually runs.

const NOW = Date.parse('2026-07-05T14:00:00.000Z');

function shooDuckGap(overrides: Partial<CatPresentation> = {}): CatPresentation {
  return {
    companionVisible: false,
    ambientActivity: 'peeking',
    ambientPeekUntil: NOW + 100_000,
    lastCareAction: 'shoo',
    ...overrides,
  } as CatPresentation;
}

const context = {
  settings: DEFAULT_SETTINGS,
  hostname: undefined,
  resolveUrl: (path: string) => path,
  setCompanionHidden: vi.fn(),
  onReveal: vi.fn(),
  render: vi.fn(),
};

describe('RealCatCameoController.sync', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules exactly one timer for a shoo duck gap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const controller = new RealCatCameoController();

    controller.sync(shooDuckGap(), { companionVisible: true, ambientPeekUntil: null }, context);

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reschedule for a re-render of the same duck gap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const controller = new RealCatCameoController();
    const presentation = shooDuckGap();

    controller.sync(presentation, { companionVisible: true, ambientPeekUntil: null }, context);
    controller.sync(presentation, { companionVisible: false, ambientPeekUntil: presentation.ambientPeekUntil }, context);

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('never schedules for an ordinary ambient duck gap (never shooed)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const controller = new RealCatCameoController();

    controller.sync(
      shooDuckGap({ lastCareAction: null }),
      { companionVisible: true, ambientPeekUntil: null },
      context,
    );

    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('cancels the pending timer once she becomes visible again', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const controller = new RealCatCameoController();

    controller.sync(shooDuckGap(), { companionVisible: true, ambientPeekUntil: null }, context);
    controller.sync(shooDuckGap({ companionVisible: true }), { companionVisible: false, ambientPeekUntil: null }, context);

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('cancel() clears a pending timer directly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const controller = new RealCatCameoController();
    controller.sync(shooDuckGap(), { companionVisible: true, ambientPeekUntil: null }, context);

    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    controller.cancel();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('never hides her over just a scheduled (not yet shown) cameo', () => {
    // setCompanionHidden must only fire once show() actually mounts something — cancelling a
    // merely-scheduled timer shouldn't un-hide her, since this controller never hid her yet.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const setCompanionHidden = vi.fn();
    const controller = new RealCatCameoController();

    controller.sync(
      shooDuckGap(),
      { companionVisible: true, ambientPeekUntil: null },
      { ...context, setCompanionHidden },
    );
    controller.cancel();

    expect(setCompanionHidden).not.toHaveBeenCalled();
  });
});
