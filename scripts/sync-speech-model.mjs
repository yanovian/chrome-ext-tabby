#!/usr/bin/env node
/**
 * Download the local speech model into public/models/ for fully offline inference.
 */
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_ID = 'Xenova/flan-t5-small';
const BASE = `https://huggingface.co/${MODEL_ID}/resolve/main`;
const OUT = join(ROOT, 'public', 'models', MODEL_ID);

const FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'generation_config.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
];

async function download(file) {
  const dest = join(OUT, file);
  if (existsSync(dest) && statSync(dest).size > 0) {
    console.log(`[sync-speech-model] have ${file}`);
    return;
  }

  mkdirSync(dirname(dest), { recursive: true });
  const url = `${BASE}/${file}`;
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }

  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  const mb = (statSync(dest).size / 1_048_576).toFixed(1);
  console.log(`[sync-speech-model] downloaded ${file} (${mb} MB)`);
}

for (const file of FILES) {
  await download(file);
}
console.log('[sync-speech-model] model ready in public/models/');
