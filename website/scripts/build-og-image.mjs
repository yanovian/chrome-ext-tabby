import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const SITE_NAME = 'Tabby';
const SITE_TAGLINE = 'A cat that lives in your browser';
const SITE_DESCRIPTION =
  'A free Chrome extension. Pet her, feed her, and watch her grow from kitten to adult. Private, local, and free.';
const SITE_URL = 'https://yanovian.github.io/chrome-ext-tabby/';

const websiteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(websiteRoot, 'public', 'og-image.png');
const iconPath = join(websiteRoot, 'public', 'icon.png');

const iconBase64 = readFileSync(iconPath).toString('base64');

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2a1540"/>
      <stop offset="45%" stop-color="#1a0f2e"/>
      <stop offset="100%" stop-color="#12091f"/>
    </linearGradient>
    <radialGradient id="glow" cx="28%" cy="38%" r="55%">
      <stop offset="0%" stop-color="#ff7eb9" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#ff7eb9" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="78%" cy="72%" r="45%">
      <stop offset="0%" stop-color="#7cf0ff" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#7cf0ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#bg)"/>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#glow)"/>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#glow2)"/>
  <circle cx="930" cy="520" r="220" fill="#ff7eb9" fill-opacity="0.08"/>
  <image href="data:image/png;base64,${iconBase64}" x="120" y="170" width="290" height="290"/>
  <text x="470" y="250" fill="#ffffff" font-family="Segoe UI, system-ui, sans-serif" font-size="72" font-weight="800">${SITE_NAME}</text>
  <text x="470" y="330" fill="#f7c4e4" font-family="Segoe UI, system-ui, sans-serif" font-size="42" font-weight="700">${SITE_TAGLINE}</text>
  <text x="470" y="410" fill="#c9b8e8" font-family="Segoe UI, system-ui, sans-serif" font-size="28" font-weight="500">${escapeXml(SITE_DESCRIPTION)}</text>
  <text x="470" y="500" fill="#7cf0ff" font-family="Segoe UI, system-ui, sans-serif" font-size="24" font-weight="700">${escapeXml(SITE_URL)}</text>
  <text x="470" y="560" fill="#c9b8e8" font-family="Segoe UI, system-ui, sans-serif" font-size="22" font-weight="600">Yanovian LLC · yanovian.com · Pooyan Razian · pooyan.info</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(outPath);
console.log(`Wrote ${outPath} (${OG_IMAGE_WIDTH}x${OG_IMAGE_HEIGHT})`);
