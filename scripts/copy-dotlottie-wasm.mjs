#!/usr/bin/env node
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@lottiefiles', 'dotlottie-web', 'dist', 'dotlottie-player.wasm');
const dest = join(root, 'public', 'dotlottie-player.wasm');

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
