#!/usr/bin/env bun
/**
 * Convert Lottie JSON to transparent GIFs (dotlottie-web, 2× supersample).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { DotLottie } from '@lottiefiles/dotlottie-web';
import { createCanvas } from '@napi-rs/canvas';
// @ts-expect-error gifenc has no types in this context
import { GIFEncoder, quantize, applyPalette, snapColorsToPalette } from 'gifenc';
import {
  GIF_DISPOSE_BACKGROUND,
  GIF_PIXEL_FORMAT,
  GIF_QUANTIZE_OPTIONS,
  TABBY_GIF_DEFAULT_FPS,
  TABBY_GIF_RENDER_SCALE,
  downsampleRgbaFrame,
  gifFrameDelayMs,
  mergeRgbaFrames,
  outputFrameCount,
  resolveOutputFps,
  stabilizeFrameAlpha,
  transparentPaletteIndex,
} from './gif-alpha-encode.mjs';

const inputDir = process.env.INPUT_DIR ?? '/input';
const outputDir = process.env.OUTPUT_DIR ?? '/output';
const width = Number(process.env.WIDTH ?? 140);
const height = Number(process.env.HEIGHT ?? width);
const maxFps = Number(process.env.FPS ?? TABBY_GIF_DEFAULT_FPS);
const renderScale = Math.max(1, Number(process.env.TABBY_GIF_SCALE ?? TABBY_GIF_RENDER_SCALE));
const convertOnly = process.env.CONVERT_ONLY;
const colors = Number(process.env.TABBY_GIF_COLORS ?? 256);

const renderWidth = Math.round(width * renderScale);
const renderHeight = Math.round(height * renderScale);

function gifRepeatFor(jsonName) {
  return jsonName === 'peek_duck.json' ? -1 : 0;
}

function listJsonFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

async function loadDotLottie(jsonPath) {
  const data = await readFile(jsonPath, 'utf8');
  const canvas = createCanvas(renderWidth, renderHeight);
  const lottie = new DotLottie({
    useFrameInterpolation: true,
    autoplay: false,
    canvas,
    data,
  });
  await new Promise((resolve, reject) => {
    lottie.addEventListener('load', resolve, { once: true });
    lottie.addEventListener('loadError', reject, { once: true });
  });
  return { lottie, canvas };
}

function renderFrames(lottie, canvas) {
  const sourceFps = lottie.totalFrames / lottie.duration;
  const outputFps = resolveOutputFps(sourceFps, maxFps);
  const frameCount = outputFrameCount(lottie.duration, outputFps);
  const ctx = canvas.getContext('2d');
  const frames = [];

  for (let i = 0; i < frameCount; i += 1) {
    const timeSec = i / outputFps;
    const sourceFrame = Math.min(lottie.totalFrames - 1, timeSec * sourceFps);
    lottie.setFrame(sourceFrame);
    const raw = new Uint8ClampedArray(ctx.getImageData(0, 0, renderWidth, renderHeight).data);
    const sample =
      renderScale > 1
        ? downsampleRgbaFrame(raw, renderWidth, renderHeight, width, height, createCanvas)
        : raw;
    frames.push(sample);
  }

  return { frames, outputFps };
}

async function encodeGif(frames, outputPath, opt) {
  const stabilized = frames.map((frame) => stabilizeFrameAlpha(frame));
  const palette = quantize(
    mergeRgbaFrames(stabilized),
    opt?.colors ?? 256,
    GIF_QUANTIZE_OPTIONS,
  );
  snapColorsToPalette(palette, [[0, 0, 0, 0]], 0);

  const transparentIndex = transparentPaletteIndex(palette);
  const delay = gifFrameDelayMs(opt?.outputFps ?? 60);
  const builder = new GIFEncoder();

  for (let i = 0; i < stabilized.length; i += 1) {
    const index = applyPalette(stabilized[i], palette, GIF_PIXEL_FORMAT);
    const frameOpts = {
      delay,
      dispose: GIF_DISPOSE_BACKGROUND,
      palette: i === 0 ? palette : undefined,
      transparent: transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
    };
    if (i === 0) {
      frameOpts.repeat = opt?.repeat ?? 0;
    }
    builder.writeFrame(index, width, height, frameOpts);
  }

  builder.finish();
  await writeFile(outputPath, Buffer.from(builder.bytes()));
}

async function convertFile(jsonPath, outputPath) {
  const { lottie, canvas } = await loadDotLottie(jsonPath);
  try {
    const { frames, outputFps } = renderFrames(lottie, canvas);
    console.log(
      `[convert]   ${frames.length} frames @ ${outputFps.toFixed(2)} fps (${(frames.length / outputFps).toFixed(2)}s), palette target ${colors}`,
    );
    await encodeGif(frames, outputPath, {
      repeat: gifRepeatFor(basename(jsonPath)),
      colors,
      outputFps,
    });
  } finally {
    lottie.destroy();
  }
}

async function main() {
  if (!existsSync(inputDir)) {
    console.error(`[convert] missing input dir ${inputDir}`);
    process.exit(1);
  }
  mkdirSync(outputDir, { recursive: true });

  const jsonFiles = convertOnly
    ? listJsonFiles(inputDir).filter((name) => name === convertOnly)
    : listJsonFiles(inputDir);
  if (jsonFiles.length === 0) {
    console.error(
      convertOnly
        ? `[convert] missing ${convertOnly} in ${inputDir}`
        : `[convert] no JSON in ${inputDir}`,
    );
    process.exit(1);
  }

  let wrote = 0;
  for (const jsonName of jsonFiles) {
    const gifName = jsonName.replace(/\.json$/, '.gif');
    console.log(`[convert] ${jsonName} → ${gifName} (${renderWidth}×${renderHeight} → ${width}×${height})`);
    try {
      await convertFile(join(inputDir, jsonName), join(outputDir, gifName));
      wrote += 1;
    } catch (error) {
      console.error(`[convert] failed ${jsonName}:`, error);
      process.exit(1);
    }
  }

  console.log(`[convert] wrote ${wrote} GIFs to ${outputDir}`);
}

main().catch((error) => {
  console.error('[convert]', error);
  process.exit(1);
});
