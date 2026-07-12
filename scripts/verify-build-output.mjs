#!/usr/bin/env node
/**
 * Fail if a production build still contains legacy or removed assets.
 * Run after `pnpm build` or `pnpm zip`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), '.output', 'chrome-mv3');
const ALLOWED_UNDERSCORE_DIRS = ['_locales'];

function isForbiddenPath(rel) {
  const top = rel.split('/')[0];
  if (top?.startsWith('_') && !ALLOWED_UNDERSCORE_DIRS.includes(top)) return true;
  if (rel === '__MACOSX' || rel.startsWith('__MACOSX/')) return true;
  if (rel === '.DS_Store' || rel.endsWith('/.DS_Store')) return true;
  return rel.split('/').some((part) => part.startsWith('._'));
}

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
    if (isForbiddenPath(rel)) {
      problems.push(rel);
    }
    if (statSync(full).isDirectory()) {
      walk(full, rel);
    }
  }
}

walk(OUT);

const outBase = join(process.cwd(), '.output');
if (existsSync(outBase)) {
  const zips = readdirSync(outBase).filter((name) => name.endsWith('-chrome.zip')).sort();
  const zipName = zips.at(-1);
  if (zipName) {
    const listing = execFileSync('unzip', ['-Z1', join(outBase, zipName)], { encoding: 'utf8' });
    for (const rel of listing.trim().split('\n').filter(Boolean)) {
      if (isForbiddenPath(rel)) {
        problems.push(`${zipName}:${rel}`);
      }
    }
  }
}

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
