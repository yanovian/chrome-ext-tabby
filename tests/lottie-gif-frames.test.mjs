import { describe, expect, it } from 'vitest';
import {
  outputFrameCount,
  resolveOutputFps,
  stabilizeFrameAlpha,
} from '../utils/lottie-gif-frames.mjs';

describe('lottie gif frame helpers', () => {
  it('uses native fps when target is unset', () => {
    expect(resolveOutputFps(30, 0)).toBe(30);
    expect(resolveOutputFps(29.97, -1)).toBe(29.97);
  });

  it('keeps an explicit target fps', () => {
    expect(resolveOutputFps(30, 60)).toBe(60);
  });

  it('rounds frame count from duration and fps', () => {
    expect(outputFrameCount(3.2, 30)).toBe(96);
    expect(outputFrameCount(0, 30)).toBe(1);
  });

  it('clears near-transparent fringe pixels', () => {
    const rgba = new Uint8ClampedArray([200, 100, 50, 4, 10, 20, 30, 200]);
    const out = stabilizeFrameAlpha(rgba, 8);
    expect(Array.from(out.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(out[7]).toBe(200);
  });
});
