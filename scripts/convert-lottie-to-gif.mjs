#!/usr/bin/env node
/**
 * Convert lottie-json/*.json to public/gif/*.gif using a pinned Docker image.
 *
 * Pipeline: dotlottie-web (transparent PNG frames) → gifski (temporal palette).
 * See public/gif/README.md and docker/lottie-gif/README.md.
 *
 * Image: tabby-lottie-gif:8 (built from docker/lottie-gif/)
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
  TABBY_GIF_DEFAULT_FPS,
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

function dockerRunArgs(stage, size, tempDir) {
  const sourceDir = join(LOTTIE_DIR, stage);
  const fps = process.env.TABBY_GIF_FPS ?? String(TABBY_GIF_DEFAULT_FPS);
  const convertScript = join(ROOT, 'docker/lottie-gif/convert.mjs');

  return [
    'run',
    '--rm',
    '--memory',
    '6g',
    '--shm-size',
    '1g',
    '-e',
    `WIDTH=${size}`,
    '-e',
    `HEIGHT=${size}`,
    '-e',
    `FPS=${fps}`,
    '-e',
    `TABBY_GIFSKI_QUALITY=${process.env.TABBY_GIFSKI_QUALITY ?? '100'}`,
    '-e',
    'INPUT_DIR=/input',
    '-e',
    'OUTPUT_DIR=/output',
    '-v',
    `${convertScript}:/app/convert.mjs:ro`,
    '-v',
    `${sourceDir}:/input:ro`,
    '-v',
    `${tempDir}:/output`,
    LOTTIE_GIF_DOCKER_IMAGE,
  ];
}

function runDockerConvert(stage, size, dryRun, plan) {
  const outputDir = join(ROOT, 'public', 'gif', stage);
  const fps = process.env.TABBY_GIF_FPS ?? String(TABBY_GIF_DEFAULT_FPS);
  const tempDir = join(tmpdir(), `tabby-gif-${stage}-${process.pid}`);
  const maxAttempts = Number(process.env.TABBY_GIF_RETRIES ?? 3);
  mkdirSync(tempDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  console.log(
    `[gif:convert] ${stage}: ${size}×${size}px @ ${fps === '0' ? 'native' : `${fps} fps`} via ${LOTTIE_GIF_DOCKER_IMAGE} (dotlottie + gifski)`,
  );
  if (dryRun) {
    console.log(`[gif:convert] dry-run: docker ${dockerRunArgs(stage, size, tempDir).join(' ')}`);
    return;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });

    const result = spawnSync('docker', dockerRunArgs(stage, size, tempDir), { stdio: 'inherit' });
    const gifNames = existsSync(tempDir)
      ? readdirSync(tempDir).filter((name) => name.endsWith('.gif'))
      : [];
    if (result.status === 0 && gifNames.length === plan.jsonFiles.length) {
      for (const name of gifNames) {
        copyFileSync(join(tempDir, name), join(outputDir, name));
      }
      rmSync(tempDir, { recursive: true, force: true });
      console.log(`[gif:convert] shipped ${gifNames.length} GIFs to public/gif/${stage}/`);
      return;
    }
    if (attempt < maxAttempts) {
      console.warn(`[gif:convert] retry ${stage} (${attempt}/${maxAttempts})`);
      spawnSync('sleep', ['2']);
    }
  }

  rmSync(tempDir, { recursive: true, force: true });
  console.error(`[gif:convert] failed ${stage} after ${maxAttempts} attempts`);
  process.exit(1);
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
