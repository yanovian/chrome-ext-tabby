#!/usr/bin/env node
/**
 * Convert lottie-json/*.json to public/gif/*.gif using a pinned Docker image.
 *
 * WARNING: Overwrites public/gif/. Shipped GIFs are manual Lottiefiles exports today.
 * See public/gif/README.md before running.
 *
 * Image:    tabby-lottie-gif:4 (built from docker/lottie-gif/)
 *
 * Requires Docker. Does not run during `pnpm assets` (optional, slower).
 *
 * Usage:
 *   pnpm gif:convert
 *   pnpm gif:convert -- --stage adult
 *   pnpm gif:convert -- --dry-run
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOTTIE_GIF_DOCKER_IMAGE,
  LOTTIE_GIF_DOCKERFILE_DIR,
  LOTTIE_GIF_STAGES,
  convertStagePlan,
} from '../utils/lottie-gif-convert.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOTTIE_DIR = join(ROOT, 'lottie-json');

function parseArgs(argv) {
  const stages = [];
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--stage') {
      const value = argv[i + 1];
      if (!value || !LOTTIE_GIF_STAGES.includes(value)) {
        console.error(`[gif:convert] unknown stage "${value ?? ''}"`);
        process.exit(1);
      }
      stages.push(value);
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: pnpm gif:convert [--dry-run] [--stage newborn|playful|adult]`);
      process.exit(0);
    }
  }
  return {
    dryRun,
    stages: stages.length > 0 ? stages : LOTTIE_GIF_STAGES,
  };
}

function dockerAvailable() {
  return spawnSync('docker', ['version'], { stdio: 'ignore' }).status === 0;
}

function dockerImageExists(image) {
  const result = spawnSync('docker', ['image', 'inspect', image], { stdio: 'ignore' });
  return result.status === 0;
}

function ensureDockerImage(dryRun) {
  if (dockerImageExists(LOTTIE_GIF_DOCKER_IMAGE)) {
    return;
  }

  console.log(`[gif:convert] building ${LOTTIE_GIF_DOCKER_IMAGE} from ${LOTTIE_GIF_DOCKERFILE_DIR}`);
  if (dryRun) {
    console.log(
      `[gif:convert] dry-run: docker build -t ${LOTTIE_GIF_DOCKER_IMAGE} ${LOTTIE_GIF_DOCKERFILE_DIR}`,
    );
    return;
  }

  const result = spawnSync(
    'docker',
    ['build', '-t', LOTTIE_GIF_DOCKER_IMAGE, '-f', join(ROOT, LOTTIE_GIF_DOCKERFILE_DIR, 'Dockerfile'), ROOT],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runDockerConvert(stage, size, dryRun, plan) {
  const sourceDir = join(LOTTIE_DIR, stage);
  const outputDir = join(ROOT, 'public', 'gif', stage);
  const fps = process.env.TABBY_GIF_FPS ?? '60';
  const tempDir = join(tmpdir(), `tabby-gif-${stage}-${process.pid}`);
  const maxAttempts = Number(process.env.TABBY_GIF_RETRIES ?? 25);
  const convertScript = join(ROOT, 'docker/lottie-gif/convert.mjs');
  const encodeHelpers = join(ROOT, 'utils/gif-alpha-encode.mjs');
  mkdirSync(tempDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  console.log(
    `[gif:convert] ${stage}: ${size}×${size}px @ ${fps} fps via ${LOTTIE_GIF_DOCKER_IMAGE}`,
  );
  if (dryRun) {
    for (const jsonName of plan.jsonFiles) {
      console.log(
        `[gif:convert] dry-run: docker run … -e CONVERT_ONLY=${jsonName} ${LOTTIE_GIF_DOCKER_IMAGE}`,
      );
    }
    return;
  }

  for (const jsonName of plan.jsonFiles) {
    const gifName = jsonName.replace(/\.json$/, '.gif');
    const outputPath = join(tempDir, gifName);
    if (existsSync(outputPath)) {
      continue;
    }

    let converted = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const args = [
        'run',
        '--rm',
        '--memory',
        '4g',
        '--shm-size',
        '256m',
        '-e',
        `WIDTH=${size}`,
        '-e',
        `HEIGHT=${size}`,
        '-e',
        `FPS=${fps}`,
        '-e',
        `TABBY_GIF_COLORS=${process.env.TABBY_GIF_COLORS ?? '256'}`,
        '-e',
        'INPUT_DIR=/input',
        '-e',
        'OUTPUT_DIR=/output',
        '-e',
        `CONVERT_ONLY=${jsonName}`,
        '-v',
        `${convertScript}:/app/convert.mjs:ro`,
        '-v',
        `${encodeHelpers}:/app/gif-alpha-encode.mjs:ro`,
        '-v',
        `${sourceDir}:/input:ro`,
        '-v',
        `${tempDir}:/output`,
        LOTTIE_GIF_DOCKER_IMAGE,
      ];

      const result = spawnSync('docker', args, { stdio: 'inherit' });
      if (result.status === 0 && existsSync(outputPath)) {
        converted = true;
        break;
      }
      if (attempt < maxAttempts) {
        console.warn(`[gif:convert] retry ${jsonName} (${attempt}/${maxAttempts})`);
        spawnSync('sleep', ['0.4']);
      }
    }

    if (!converted) {
      console.error(`[gif:convert] failed ${jsonName} after ${maxAttempts} attempts`);
      rmSync(tempDir, { recursive: true, force: true });
      process.exit(1);
    }
  }

  const gifNames = readdirSync(tempDir).filter((name) => name.endsWith('.gif'));
  if (gifNames.length !== plan.jsonFiles.length) {
    console.error(
      `[gif:convert] expected ${plan.jsonFiles.length} GIFs in ${tempDir}, found ${gifNames.length}`,
    );
    rmSync(tempDir, { recursive: true, force: true });
    process.exit(1);
  }

  for (const name of gifNames) {
    copyFileSync(join(tempDir, name), join(outputDir, name));
  }
  rmSync(tempDir, { recursive: true, force: true });

  console.log(`[gif:convert] shipped ${gifNames.length} GIFs to public/gif/${stage}/`);
}

function main() {
  const { dryRun, stages } = parseArgs(process.argv.slice(2));

  if (!existsSync(LOTTIE_DIR)) {
    console.error('[gif:convert] missing lottie-json/ — run pnpm animations first');
    process.exit(1);
  }

  if (!dryRun && !dockerAvailable()) {
    console.error('[gif:convert] Docker is required. Install Docker or use --dry-run.');
    process.exit(1);
  }

  ensureDockerImage(dryRun);

  for (const stage of stages) {
    const plan = convertStagePlan(stage, ROOT);
    if (plan.jsonFiles.length === 0) {
      console.error(`[gif:convert] no JSON in ${plan.sourceDir} — run pnpm animations`);
      process.exit(1);
    }
    runDockerConvert(stage, plan.size, dryRun, plan);
  }

  if (dryRun) {
    console.log('[gif:convert] dry-run complete');
    return;
  }

  console.log('[gif:convert] done');
}

main();
