#!/usr/bin/env node
/**
 * Lottie JSON → PNG frames (dotlottie-web) → GIF (gifski).
 * Gifski uses temporal palettes to avoid color flicker between frames.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { DotLottie } from '@lottiefiles/dotlottie-web';
import { createCanvas } from '@napi-rs/canvas';
import {
  downsampleRgbaFrame,
  outputFrameCount,
  resolveOutputFps,
  stabilizeFrameAlpha,
  writeRgbaPng,
} from './utils/lottie-gif-frames.mjs';

const inputDir = process.env.INPUT_DIR ?? '/input';
const outputDir = process.env.OUTPUT_DIR ?? '/output';
const width = Number(process.env.WIDTH ?? 150);
const height = Number(process.env.HEIGHT ?? width);
const maxFps = Number(process.env.FPS ?? 0);
const renderScale = Math.max(1, Number(process.env.TABBY_GIF_SCALE ?? 1));
const convertOnly = process.env.CONVERT_ONLY;
const gifskiQuality = process.env.TABBY_GIFSKI_QUALITY ?? '100';

const renderWidth = Math.round(width * renderScale);
const renderHeight = Math.round(height * renderScale);

function listJsonFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

function runGifski(args, label) {
  const result = spawnSync('gifski', args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${label ?? 'gifski'} failed (exit ${result.status ?? 'unknown'})`);
  }
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
    frames.push(stabilizeFrameAlpha(sample));
  }

  return { frames, outputFps };
}

async function convertFile(jsonPath, outputPath) {
  const jsonName = basename(jsonPath);
  const workDir = join(outputDir, `.work-${basename(jsonPath, '.json')}`);
  await rm(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });

  const { lottie, canvas } = await loadDotLottie(jsonPath);
  let frames;
  let outputFps;
  try {
    ({ frames, outputFps } = renderFrames(lottie, canvas));
  } finally {
    lottie.destroy();
  }

  console.log(`[convert]   ${frames.length} frames @ ${outputFps.toFixed(2)} fps`);
  const framePaths = [];
  for (let i = 0; i < frames.length; i += 1) {
    const framePath = join(workDir, `frame-${String(i + 1).padStart(4, '0')}.png`);
    await writeRgbaPng(createCanvas, frames[i], width, height, framePath);
    framePaths.push(framePath);
  }

  const gifskiArgs = [
    '-o',
    outputPath,
    '--width',
    String(width),
    '--height',
    String(height),
    '--fps',
    String(outputFps),
    '--quality',
    gifskiQuality,
    ...framePaths,
  ];
  if (jsonName === 'peek_duck.json' || jsonName === 'peek.json') {
    gifskiArgs.push('--repeat', '-1');
  }

  console.log(`[convert]   gifski ${framePaths.length} frames → ${basename(outputPath)}`);
  runGifski(gifskiArgs, 'gifski');
  await rm(workDir, { recursive: true, force: true });
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
    const scaleLabel =
      renderScale > 1 ? `${renderWidth}×${renderHeight} → ${width}×${height}` : `${width}×${height}`;
    console.log(`[convert] ${jsonName} → ${gifName} (${scaleLabel})`);
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
