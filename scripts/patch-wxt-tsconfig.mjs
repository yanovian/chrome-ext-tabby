import { readFileSync, writeFileSync } from 'node:fs';

const path = '.wxt/tsconfig.json';
const config = JSON.parse(readFileSync(path, 'utf8'));
const exclude = new Set(config.exclude ?? ['../.output']);
exclude.add('../website');
config.exclude = [...exclude];
writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
