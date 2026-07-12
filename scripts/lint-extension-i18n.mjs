#!/usr/bin/env node
/**
 * Validate extension locale JSON files match en.json key structure.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES_DIR = join(ROOT, 'locales');
const require = createRequire(import.meta.url);
const { APP_LOCALES } = require(join(ROOT, 'utils', 'locale-registry.ts'));

function collectPaths(value, prefix = '') {
  const paths = [];
  if (typeof value === 'string') {
    paths.push(prefix);
    return paths;
  }
  if (Array.isArray(value)) {
    paths.push(prefix);
    return paths;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const next = prefix ? `${prefix}.${key}` : key;
      paths.push(...collectPaths(child, next));
    }
    return paths;
  }
  paths.push(prefix);
  return paths;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const enPath = join(LOCALES_DIR, 'en.json');
if (!existsSync(enPath)) {
  console.error('[lint-extension-i18n] missing locales/en.json');
  process.exit(1);
}

const en = readJson(enPath);
const enPaths = new Set(collectPaths(en));
let failed = false;

for (const code of APP_LOCALES) {
  const path = join(LOCALES_DIR, `${code}.json`);
  if (!existsSync(path)) {
    console.error(`[lint-extension-i18n] missing ${path}`);
    failed = true;
    continue;
  }

  const bundle = readJson(path);
  const paths = new Set(collectPaths(bundle));

  for (const key of enPaths) {
    if (!paths.has(key)) {
      console.error(`[lint-extension-i18n] ${code}: missing key ${key}`);
      failed = true;
    }
  }

  for (const key of paths) {
    if (!enPaths.has(key)) {
      console.error(`[lint-extension-i18n] ${code}: extra key ${key}`);
      failed = true;
    }
  }

  const serialized = JSON.stringify(bundle);

  if (bundle.brand === 'Tabby' && code !== 'en') {
    console.error(`[lint-extension-i18n] ${code}: brand must be transliterated, not Latin "Tabby"`);
    failed = true;
  }

  if (code !== 'en' && /\bTabby\b/.test(serialized)) {
    console.error(`[lint-extension-i18n] ${code}: contains Latin "Tabby" in strings`);
    failed = true;
  }

  if (serialized.includes('—')) {
    console.error(`[lint-extension-i18n] ${code}: contains em dash`);
    failed = true;
  }
  if (serialized.includes('__PH')) {
    console.error(`[lint-extension-i18n] ${code}: contains untranslated placeholder`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`[lint-extension-i18n] OK: ${APP_LOCALES.length} locale files match en.json structure`);
