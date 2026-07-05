import { describe, expect, it } from 'vitest';
import { createInitialCat } from '../utils/cat-sim';
import {
  evaluateEmotionalTrigger,
  previewTriggerSpeech,
} from '../utils/emotional-triggers';
import { mergeSettings } from '../utils/settings';
import type { MemorySeed } from '../utils/types';

const NOW = Date.parse('2026-07-05T14:00:00.000Z');

function productionSettings() {
  return mergeSettings(undefined, false);
}

function devSettings() {
  return mergeSettings({ devModeEnabled: true }, true);
}

function memory(topic: string): MemorySeed {
  return {
    id: 'memory-1',
    topic,
    kind: 'learning',
    firstSeenAt: NOW - 1000 * 60 * 60 * 24,
    lastSeenAt: NOW - 1000 * 60 * 60,
    sessionCount: 3,
    totalActiveMs: 1000 * 60 * 40,
    recallLine: `We learned ${topic} together.`,
    lastRecalledAt: null,
  };
}

function speechFrom(result: ReturnType<typeof evaluateEmotionalTrigger>): string | null {
  return result.speechContext ? previewTriggerSpeech(result.speechContext) : null;
}

describe('evaluateEmotionalTrigger', () => {
  it('asks for interesting learning when Tabby is hungry but still warm', () => {
    const cat = createInitialCat(NOW);
    const result = evaluateEmotionalTrigger({
      cat: { ...cat, lastSpeechAt: 0, nudgesToday: 0 },
      vitals: { hunger: 70, happiness: 50, stress: 20, energy: 60 },
      settings: productionSettings(),
      now: NOW,
      isUserIdle: false,
      recentMemory: null,
    });

    expect(result.shouldAppear).toBe(true);
    expect(result.triggerKind).toBe('hungry');
    expect(speechFrom(result)).toMatch(/fun|something|new/i);
    expect(result.mood).toBe('hungry');
  });

  it('uses the funny starving line when Tabby is basically fur and bones', () => {
    const cat = createInitialCat(NOW);
    const result = evaluateEmotionalTrigger({
      cat: { ...cat, lastSpeechAt: 0, nudgesToday: 0 },
      vitals: { hunger: 95, happiness: 35, stress: 15, energy: 40 },
      settings: productionSettings(),
      now: NOW,
      isUserIdle: false,
      recentMemory: null,
    });

    expect(result.shouldAppear).toBe(true);
    expect(result.triggerKind).toBe('starving');
    expect(result.mood).toBe('starving');
    expect(speechFrom(result)).toMatch(/hungry|good|something/i);
  });

  it('offers gentle calm when stressful pages pile up without guilt', () => {
    const cat = createInitialCat(NOW);
    const result = evaluateEmotionalTrigger({
      cat: { ...cat, lastSpeechAt: 0, nudgesToday: 0 },
      vitals: { hunger: 30, happiness: 45, stress: 85, energy: 35 },
      settings: productionSettings(),
      now: NOW,
      isUserIdle: false,
      recentMemory: null,
    });

    expect(result.shouldAppear).toBe(true);
    expect(result.triggerKind).toBe('stressed');
    expect(speechFrom(result)).toMatch(/calmer|loud/i);
  });

  it('recalls a shared memory when Tabby is content and a memory exists', () => {
    const cat = createInitialCat(NOW);
    const result = evaluateEmotionalTrigger({
      cat: {
        ...cat,
        lastSpeechAt: 0,
        nudgesToday: 0,
        vitals: { hunger: 25, happiness: 65, stress: 20, energy: 70 },
      },
      vitals: { hunger: 25, happiness: 65, stress: 20, energy: 70 },
      settings: productionSettings(),
      now: NOW,
      isUserIdle: false,
      recentMemory: memory('Kubernetes'),
    });

    expect(result.shouldAppear).toBe(true);
    expect(result.triggerKind).toBe('memory');
    expect(speechFrom(result)).toContain('Kubernetes');
  });

  it('celebrates the adoption milestone on day one together', () => {
    const adoptedAt = NOW - 1000 * 60 * 60 * 24;
    const cat = { ...createInitialCat(adoptedAt), adoptedAt, lastSpeechAt: 0 };
    const result = evaluateEmotionalTrigger({
      cat,
      vitals: cat.vitals,
      settings: productionSettings(),
      now: NOW,
      isUserIdle: false,
      recentMemory: null,
    });

    expect(result.shouldAppear).toBe(true);
    expect(result.triggerKind).toBe('milestone');
    expect(speechFrom(result)).toMatch(/First day/i);
  });

  it('stays quiet during production quiet hours instead of nagging', () => {
    const cat = createInitialCat(NOW);
    const lateNight = Date.parse('2026-07-05T23:30:00.000Z');
    const settings = mergeSettings(
      {
        quietHoursStart: 23,
        quietHoursEnd: 8,
      },
      false,
    );
    const localHour = new Date(lateNight).getHours();
    const shouldBeQuiet =
      localHour >= settings.quietHoursStart || localHour < settings.quietHoursEnd;

    const result = evaluateEmotionalTrigger({
      cat: { ...cat, lastSpeechAt: 0, nudgesToday: 0 },
      vitals: { hunger: 95, happiness: 30, stress: 10, energy: 20 },
      settings,
      now: lateNight,
      isUserIdle: false,
      recentMemory: null,
    });

    if (shouldBeQuiet) {
      expect(result.shouldAppear).toBe(false);
      expect(result.speechContext).toBeNull();
    } else {
      expect(result.shouldAppear).toBe(true);
    }
  });

  it('respects the daily appearance cap so Tabby does not spam the user', () => {
    const cat = {
      ...createInitialCat(NOW),
      nudgesToday: 5,
      nudgesDayKey: '2026-07-05',
      lastSpeechAt: 0,
    };
    const result = evaluateEmotionalTrigger({
      cat,
      vitals: { hunger: 95, happiness: 30, stress: 10, energy: 20 },
      settings: productionSettings(),
      now: NOW,
      isUserIdle: false,
      recentMemory: null,
    });

    expect(result.shouldAppear).toBe(false);
  });

  it('allows frequent dev speeches when dev mode is enabled for testing', () => {
    const cat = createInitialCat(NOW);
    const result = evaluateEmotionalTrigger({
      cat,
      vitals: cat.vitals,
      settings: devSettings(),
      now: NOW,
      isUserIdle: false,
      recentMemory: null,
      forceDevSpeech: true,
    });

    expect(result.shouldAppear).toBe(true);
    expect(result.triggerKind).toBe('dev');
    expect(speechFrom(result)).toMatch(/Dev mode/i);
  });

  it('force tick bypasses cooldown and speaks for the current mood', () => {
    const cat = createInitialCat(NOW);
    const result = evaluateEmotionalTrigger({
      cat: { ...cat, lastSpeechAt: NOW - 1000, nudgesToday: 99 },
      vitals: { hunger: 70, happiness: 50, stress: 20, energy: 60 },
      settings: productionSettings(),
      now: NOW,
      isUserIdle: false,
      recentMemory: null,
      forceTick: true,
    });

    expect(result.shouldAppear).toBe(true);
    expect(result.triggerKind).toBe('hungry');
    expect(result.speechContext).not.toBeNull();
  });
});
