import { describe, expect, it } from 'vitest';

function resolveOutputFps(sourceFps: number, targetFps: number) {
  if (!Number.isFinite(targetFps) || targetFps <= 0) {
    return sourceFps;
  }
  return targetFps;
}

function outputFrameCount(durationSec: number, outputFps: number) {
  return Math.max(1, Math.round(durationSec * outputFps));
}

function gifFrameDelayMs(outputFps: number) {
  return Math.max(1, Math.round(1000 / outputFps));
}

function transparentPaletteIndex(palette: number[][]) {
  const alphaIndex = palette.findIndex((color) => color.length >= 4 && color[3] === 0);
  if (alphaIndex >= 0) {
    return alphaIndex;
  }
  return palette.findIndex((color) => color[0] === 0 && color[1] === 0 && color[2] === 0);
}

function mergeRgbaFrames(frames: Uint8ClampedArray[]) {
  const totalBytes = frames.reduce((sum, frame) => sum + frame.length, 0);
  const merged = new Uint8ClampedArray(totalBytes);
  let offset = 0;
  for (const frame of frames) {
    merged.set(frame, offset);
    offset += frame.length;
  }
  return merged;
}

function stabilizeFrameAlpha(rgba: Uint8ClampedArray, transparentCutoff = 8) {
  const out = new Uint8ClampedArray(rgba);
  for (let i = 3; i < out.length; i += 4) {
    if (out[i] < transparentCutoff) {
      out[i - 3] = 0;
      out[i - 2] = 0;
      out[i - 1] = 0;
      out[i] = 0;
    }
  }
  return out;
}

describe('gif alpha encode', () => {
  it('keeps native Lottie fps when target is unset', () => {
    expect(resolveOutputFps(30, 0)).toBe(30);
  });

  it('upsamples to target fps when higher than source', () => {
    expect(resolveOutputFps(30, 60)).toBe(60);
    expect(resolveOutputFps(30, 24)).toBe(24);
  });

  it('counts output frames from duration', () => {
    expect(outputFrameCount(3.2, 60)).toBe(192);
    expect(outputFrameCount(3.2, 30)).toBe(96);
  });

  it('finds a transparent palette swatch', () => {
    expect(transparentPaletteIndex([[10, 20, 30], [0, 0, 0, 0], [1, 2, 3, 255]])).toBe(1);
    expect(transparentPaletteIndex([[0, 0, 0], [1, 2, 3]])).toBe(0);
    expect(transparentPaletteIndex([[1, 2, 3], [4, 5, 6]])).toBe(-1);
  });

  it('merges rgba buffers', () => {
    const merged = mergeRgbaFrames([
      new Uint8ClampedArray([1, 2, 3, 4]),
      new Uint8ClampedArray([5, 6, 7, 8]),
    ]);
    expect(Array.from(merged)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('clears only near-transparent fringe pixels', () => {
    const stabilized = stabilizeFrameAlpha(new Uint8ClampedArray([10, 20, 30, 6, 5, 6, 7, 200, 50, 60, 70, 82]));
    expect(Array.from(stabilized)).toEqual([0, 0, 0, 0, 5, 6, 7, 200, 50, 60, 70, 82]);
  });

  it('computes delay from output fps', () => {
    expect(gifFrameDelayMs(60)).toBe(17);
    expect(gifFrameDelayMs(30)).toBe(33);
    expect(gifFrameDelayMs(24)).toBe(42);
  });
});
