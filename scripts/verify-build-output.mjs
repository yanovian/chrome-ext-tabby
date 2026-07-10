#!/usr/bin/env node
/**
 * Fail if a production build still contains legacy or removed assets.
 * Run after `pnpm build` or `pnpm zip`.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), '.output', 'chrome-mv3');

if (!existsSync(OUT)) {
  console.error('[verify-build-output] missing .output/chrome-mv3 — run pnpm build first');
  process.exit(1);
}

const forbidden = ['sprites', 'models', 'ort', 'animations', 'lottie-json'];
const problems = [];

function walk(dir, prefix = '') {
  for (const entry of readdirSync(dir)) {
    const rel = prefix ? `${prefix}/${entry}` : entry;
    const full = join(dir, entry);
    if (forbidden.includes(entry) && statSync(full).isDirectory()) {
      problems.push(rel);
      continue;
    }
    if (statSync(full).isDirectory()) {
      walk(full, rel);
    }
  }
}

walk(OUT);

if (problems.length > 0) {
  console.error('[verify-build-output] forbidden paths in build output:');
  for (const path of problems) {
    console.error(`  - ${path}`);
  }
  process.exit(1);
}

const wasmPath = join(OUT, 'dotlottie-player.wasm');
if (existsSync(wasmPath)) {
  console.error('[verify-build-output] legacy dotlottie-player.wasm must not ship — remove Lottie assets');
  process.exit(1);
}

const gifDir = join(OUT, 'gif');
if (!existsSync(gifDir)) {
  console.error('[verify-build-output] missing gif/ in build output — add GIFs under public/gif/');
  process.exit(1);
}

console.log('[verify-build-output] ok');
