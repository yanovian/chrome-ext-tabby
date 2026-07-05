#!/usr/bin/env node
/**
 * Copy ONNX Runtime Web WASM into public/ort/ so it ships inside the extension.
 * No CDN at runtime — same approach as chrome-ext-breadcrumb.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'ort');

const FILES = [
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs',
];

function findDist() {
  const direct = join(ROOT, 'node_modules', 'onnxruntime-web', 'dist');
  if (existsSync(join(direct, FILES[0]))) {
    return direct;
  }

  const pnpm = join(ROOT, 'node_modules', '.pnpm');
  if (existsSync(pnpm)) {
    for (const name of readdirSync(pnpm)) {
      if (!name.startsWith('onnxruntime-web@')) {
        continue;
      }
      const dist = join(pnpm, name, 'node_modules', 'onnxruntime-web', 'dist');
      if (existsSync(join(dist, FILES[0]))) {
        return dist;
      }
    }
  }

  return null;
}

const dist = findDist();
if (!dist) {
  console.error('[sync-ort-wasm] onnxruntime-web dist not found. Run `pnpm install` first.');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
for (const file of FILES) {
  copyFileSync(join(dist, file), join(OUT, file));
  console.log(`[sync-ort-wasm] copied ${file}`);
}
