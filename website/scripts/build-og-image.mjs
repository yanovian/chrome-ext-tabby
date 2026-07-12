import { mkdirSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const RTL_LOCALES = new Set(['ar', 'fa']);

const websiteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const localesRoot = join(websiteRoot, 'src', 'locales');
const staticRoot = join(websiteRoot, 'static');
const ogDir = join(staticRoot, 'og');
const defaultOutPath = join(staticRoot, 'og-image.png');
const publicRoot = join(websiteRoot, 'public');
const catGifPath = join(publicRoot, 'gif', 'happy.gif');
const iconPath = join(publicRoot, 'icon.png');

const CAT_LEFT = 100;
const TEXT_FONT =
  "'Noto Sans', 'Noto Sans Arabic', 'Noto Sans CJK SC', 'Noto Sans Devanagari', system-ui, sans-serif";

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

function layout(rtl) {
  // Cat stays on the left. Text uses the wide column to the right of the cat.
  if (rtl) {
    return {
      textX: 1175,
      anchor: 'start',
      direction: 'rtl',
      headlineMaxChars: 36,
      bodyMaxChars: 44,
      headlineLines: 2,
      bodyLines: 3,
    };
  }

  return {
    textX: 470,
    anchor: 'start',
    direction: 'ltr',
    headlineMaxChars: 28,
    bodyMaxChars: 38,
    headlineLines: 2,
    bodyLines: 3,
  };
}

function textBlock({ x, anchor, direction, y, size, weight, fill, lines, lineHeight }) {
  const spans = lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join('');
  return `<text x="${x}" y="${y}" fill="${fill}" direction="${direction}" text-anchor="${anchor}" font-family="${TEXT_FONT}" font-size="${size}" font-weight="${weight}">${spans}</text>`;
}

function buildSvg({ headlineLines, bodyLines, rtl }) {
  const { textX, anchor, direction } = layout(rtl);
  const longestHeadline = headlineLines.reduce((max, line) => Math.max(max, line.length), 0);
  const titleSize = rtl
    ? longestHeadline > 30
      ? 42
      : longestHeadline > 24
        ? 48
        : 54
    : longestHeadline > 24
      ? 46
      : longestHeadline > 18
        ? 52
        : 58;
  const titleY = rtl ? 210 : 220;
  const titleLineHeight = rtl ? 56 : 62;
  const bodyY = titleY + headlineLines.length * titleLineHeight + (rtl ? 28 : 32);
  const bodyLineHeight = rtl ? 48 : 52;

  const title = textBlock({
    x: textX,
    anchor,
    direction,
    y: titleY,
    size: titleSize,
    weight: 800,
    fill: '#ffffff',
    lines: headlineLines,
    lineHeight: titleLineHeight,
  });

  const body = textBlock({
    x: textX,
    anchor,
    direction,
    y: bodyY,
    size: rtl ? 28 : 28,
    weight: 500,
    fill: '#c9b8e8',
    lines: bodyLines,
    lineHeight: bodyLineHeight,
  });

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
  ${title}
  ${body}
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
  const { headlineMaxChars, bodyMaxChars, headlineLines: maxHeadlineLines, bodyLines: maxBodyLines } =
    layout(rtl);
  const headline = truncate(seo.title.replace(/^Tabby:\s*/i, ''), rtl ? 66 : 64);
  const headlineLines = wrapLines(headline, headlineMaxChars, maxHeadlineLines);
  const bodyLines = wrapLines(seo.description, bodyMaxChars, maxBodyLines);
  const svg = buildSvg({ headlineLines, bodyLines, rtl });
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
      { input: catImage, top: 165, left: CAT_LEFT },
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
