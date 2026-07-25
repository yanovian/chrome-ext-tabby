/**
 * The bookkeeping every timed care "moment" (feeding, playing, petting — a short,
 * self-contained interruption of her normal look kicked off by a care action, tracked as an
 * "until" timestamp on CatPresentation plus a background alarm to settle it when due) needs,
 * factored out so each moment's own file only has to hold what's actually specific to it: its
 * duration range, and any speech.
 */
export interface MomentTimer {
  pickDurationMs(seed: number): number;
  isActive(until: number | null | undefined, now: number): boolean;
  momentDue(until: number | null | undefined, now: number): boolean;
  scheduleCompleteAlarm(whenMs: number): Promise<void>;
  clearCompleteAlarm(): Promise<void>;
}

export function createMomentTimer(alarmName: string, minMs: number, maxMs: number): MomentTimer {
  const span = maxMs - minMs + 1;
  return {
    pickDurationMs(seed) {
      return minMs + (Math.abs(seed) % span);
    },
    isActive(until, now) {
      return until != null && now < until;
    },
    momentDue(until, now) {
      return until != null && now >= until;
    },
    async scheduleCompleteAlarm(whenMs) {
      await browser.alarms.clear(alarmName);
      await browser.alarms.create(alarmName, { when: whenMs });
    },
    async clearCompleteAlarm() {
      await browser.alarms.clear(alarmName);
    },
  };
}
