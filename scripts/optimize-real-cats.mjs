#!/usr/bin/env node
/**
 * Compress public/real-cats/*.png (palette quantization via sharp/libimagequant, same engine
 * pngquant itself uses) and record each result's hash in real-cats-optimized.json.
 *
 * Re-quantizing an already-quantized PNG keeps shrinking it slightly more each time rather than
 * converging — so this skips any file whose current hash still matches the manifest, instead of
 * re-running quantization on every invocation. That also makes `--check` cheap and reliable: it
 * only has to compare hashes, not re-derive output and diff bytes.
 *
 * `--check` (used in CI): fails if any photo doesn't match the manifest — new, changed, or
 * never optimized — without writing anything.
 */
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'public/real-cats');
const MANIFEST_PATH = join(ROOT, 'scripts/real-cats-optimized.json');
const CHECK = process.argv.includes('--check');

const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');

async function loadManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  } catch {
    return {};
  }
}

const manifest = await loadManifest();
const files = (await readdir(DIR)).filter((file) => file.endsWith('.png')).sort();

if (CHECK) {
  const stale = [];
  for (const file of files) {
    const current = hash(await readFile(join(DIR, file)));
    if (manifest[file] !== current) {
      stale.push(file);
    }
  }
  if (stale.length > 0) {
    console.error(`[optimize-real-cats] not optimized: ${stale.join(', ')}`);
    console.error('Run `make real-cats-optimize`, then commit the result.');
    process.exit(1);
  }
  console.log(`[optimize-real-cats] OK: ${files.length} photo(s) optimized`);
  process.exit(0);
}

const nextManifest = {};
let optimizedCount = 0;
for (const file of files) {
  const path = join(DIR, file);
  const before = await readFile(path);
  if (manifest[file] === hash(before)) {
    nextManifest[file] = manifest[file];
    continue;
  }
  const quantized = await sharp(before).png({ palette: true, quality: 80, effort: 10 }).toBuffer();
  const smallest = quantized.length < before.length ? quantized : before;
  if (!smallest.equals(before)) {
    await writeFile(path, smallest);
    optimizedCount += 1;
  }
  nextManifest[file] = hash(smallest);
}

await writeFile(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`);
console.log(`[optimize-real-cats] optimized ${optimizedCount}/${files.length} photo(s)`);
