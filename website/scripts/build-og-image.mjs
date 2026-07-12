import { mkdirSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const SITE_URL = 'https://yanovian.github.io/chrome-ext-tabby/';
const RTL_LOCALES = new Set(['ar', 'fa']);

const websiteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const localesRoot = join(websiteRoot, 'src', 'locales');
const staticRoot = join(websiteRoot, 'static');
const ogDir = join(staticRoot, 'og');
const defaultOutPath = join(staticRoot, 'og-image.png');
const publicRoot = join(websiteRoot, 'public');
const catGifPath = join(publicRoot, 'gif', 'happy.gif');
const iconPath = join(publicRoot, 'icon.png');

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function truncate(value, max) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function wrapLines(text, maxChars, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
    if (lines.length >= maxLines) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = truncate(lines[maxLines - 1], maxChars);
  }

  return lines;
}

function loadLocales() {
  return readdirSync(localesRoot).filter((entry) =>
    existsSync(join(localesRoot, entry, 'seo.json')),
  );
}

function buildSvg({ headline, lines, rtl }) {
  const textX = rtl ? 1120 : 470;
  const anchor = rtl ? 'end' : 'start';
  const direction = rtl ? 'rtl' : 'ltr';
  const titleSize = headline.length > 42 ? 52 : headline.length > 32 ? 58 : 64;
  const lineYs = [360, 420, 480];
  const bodyLines = lines
    .map(
      (line, index) =>
        `<tspan x="${textX}" y="${lineYs[index]}">${escapeXml(line)}</tspan>`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
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
  <rect x="80" y="130" width="340" height="370" rx="28" fill="#ffffff" fill-opacity="0.04" stroke="#ffffff" stroke-opacity="0.08"/>
  <text x="${textX}" y="250" fill="#ffffff" direction="${direction}" text-anchor="${anchor}" font-family="'Noto Sans', 'Noto Sans Arabic', 'Noto Sans CJK SC', 'Noto Sans Devanagari', system-ui, sans-serif" font-size="${titleSize}" font-weight="800">${escapeXml(headline)}</text>
  <text x="${textX}" y="360" fill="#c9b8e8" direction="${direction}" text-anchor="${anchor}" font-family="'Noto Sans', 'Noto Sans Arabic', 'Noto Sans CJK SC', 'Noto Sans Devanagari', system-ui, sans-serif" font-size="28" font-weight="500">${bodyLines}</text>
  <text x="${textX}" y="560" fill="#7cf0ff" direction="${direction}" text-anchor="${anchor}" font-family="'Noto Sans', system-ui, sans-serif" font-size="24" font-weight="700">${escapeXml(SITE_URL)}</text>
</svg>`;
}

async function loadCatImage() {
  try {
    return await sharp(catGifPath, { pages: 1 })
      .resize(300, 300, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  } catch {
    return await sharp(iconPath).resize(300, 300, { fit: 'contain' }).png().toBuffer();
  }
}

async function renderOgImage({ locale, seo, catImage }) {
  const rtl = RTL_LOCALES.has(locale);
  const headline = truncate(seo.title.replace(/^Tabby:\s*/i, ''), 64);
  const lines = wrapLines(seo.description, rtl ? 34 : 42, 3);
  const svg = buildSvg({ headline, lines, rtl });
  const textLayer = await sharp(Buffer.from(svg)).png().toBuffer();

  return sharp({
    create: {
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      channels: 4,
      background: '#1a0f2e',
    },
  })
    .composite([
      { input: textLayer, top: 0, left: 0 },
      { input: catImage, top: 165, left: 100 },
    ])
    .png()
    .toBuffer();
}

async function main() {
  mkdirSync(ogDir, { recursive: true });
  if (!existsSync(catGifPath) && !existsSync(iconPath)) {
    console.warn('[build-og-image] Run copy-assets first (needs public/gif or public/icon).');
  }
  const catImage = await loadCatImage();
  const locales = loadLocales();
  let wrote = 0;

  for (const locale of locales) {
    const seo = JSON.parse(readFileSync(join(localesRoot, locale, 'seo.json'), 'utf8'));
    const png = await renderOgImage({ locale, seo, catImage });
    const outPath = join(ogDir, `${locale}.png`);
    await sharp(png).toFile(outPath);
    if (locale === 'en') {
      await sharp(png).toFile(defaultOutPath);
    }
    wrote += 1;
  }

  console.log(`[build-og-image] wrote ${wrote} OG images (${OG_IMAGE_WIDTH}x${OG_IMAGE_HEIGHT})`);
}

await main();
